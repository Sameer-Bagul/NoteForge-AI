use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobRecord {
    pub id: String,
    pub url: String,
    pub status: String,
    pub current_step: i32,
    pub options_json: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotebookRecord {
    pub id: String,
    pub job_id: Option<String>,
    pub title: String,
    pub content_json: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct TranscriptRecord {
    pub video_id: String,
    pub title: String,
    pub duration: Option<String>,
    pub full_text: String,
    pub segments_json: String,
    pub extracted_at: String,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("noteforge.db");
        let conn = Connection::open(&db_path)?;

        // Initialize schema
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                status TEXT NOT NULL,
                current_step INTEGER NOT NULL DEFAULT 0,
                options_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS notebooks (
                id TEXT PRIMARY KEY,
                job_id TEXT,
                title TEXT NOT NULL,
                content_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transcripts (
                video_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                duration TEXT,
                full_text TEXT NOT NULL,
                segments_json TEXT NOT NULL,
                extracted_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
            CREATE INDEX IF NOT EXISTS idx_notebooks_created ON notebooks(created_at DESC);
            ",
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn insert_job(&self, job: &JobRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO jobs (id, url, status, current_step, options_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                job.id,
                job.url,
                job.status,
                job.current_step,
                job.options_json,
                job.created_at,
                job.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_job(&self, id: &str) -> Result<Option<JobRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, status, current_step, options_json, created_at, updated_at
             FROM jobs WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(JobRecord {
                id: row.get(0)?,
                url: row.get(1)?,
                status: row.get(2)?,
                current_step: row.get(3)?,
                options_json: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_jobs(&self) -> Result<Vec<JobRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, status, current_step, options_json, created_at, updated_at
             FROM jobs ORDER BY updated_at DESC LIMIT 50",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(JobRecord {
                id: row.get(0)?,
                url: row.get(1)?,
                status: row.get(2)?,
                current_step: row.get(3)?,
                options_json: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn save_notebook(&self, notebook: &NotebookRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO notebooks (id, job_id, title, content_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                notebook.id,
                notebook.job_id,
                notebook.title,
                notebook.content_json,
                notebook.created_at
            ],
        )?;
        Ok(())
    }

    pub fn get_notebook(&self, id: &str) -> Result<Option<NotebookRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, job_id, title, content_json, created_at FROM notebooks WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(NotebookRecord {
                id: row.get(0)?,
                job_id: row.get(1)?,
                title: row.get(2)?,
                content_json: row.get(3)?,
                created_at: row.get(4)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_notebooks(&self) -> Result<Vec<NotebookRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, job_id, title, content_json, created_at FROM notebooks ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(NotebookRecord {
                id: row.get(0)?,
                job_id: row.get(1)?,
                title: row.get(2)?,
                content_json: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn delete_notebook(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        // Look up corresponding job_id if present
        let mut stmt = conn.prepare("SELECT job_id FROM notebooks WHERE id = ?1")?;
        let job_id: Option<String> = stmt
            .query_row(params![id], |row| row.get(0))
            .ok()
            .flatten();

        conn.execute("DELETE FROM notebooks WHERE id = ?1", params![id])?;
        if let Some(jid) = job_id {
            conn.execute("DELETE FROM jobs WHERE id = ?1", params![jid])?;
        }
        conn.execute("DELETE FROM jobs WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn delete_job(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM jobs WHERE id = ?1", params![id])?;
        conn.execute("DELETE FROM notebooks WHERE job_id = ?1 OR id = ?1", params![id])?;
        Ok(())
    }

    pub fn clear_all_data(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            DELETE FROM notebooks;
            DELETE FROM jobs;
            DELETE FROM transcripts;
            VACUUM;
            ",
        )?;
        Ok(())
    }
}

