mod commands;
mod db;
mod keychain;
mod llm;
mod youtube;

use db::Database;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Get or create application data directory for SQLite database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("./storage"));

            let db = Database::new(app_data_dir)
                .expect("Failed to initialize NoteForge SQLite database");

            app.manage(Arc::new(db));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::validate_url,
            commands::fetch_transcript,
            commands::fetch_playlist,
            commands::save_api_key,
            commands::get_api_key,
            commands::delete_api_key,
            commands::list_jobs,
            commands::get_job,
            commands::save_job,
            commands::list_notebooks,
            commands::get_notebook,
            commands::save_notebook,
            commands::delete_notebook,
            commands::delete_job,
            commands::clear_all_data,
            commands::stream_llm,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
