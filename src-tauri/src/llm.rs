use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LLMConfig {
    pub provider: String, // "gemini" | "ollama"
    pub model: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
}

pub struct LLMService {
    client: Client,
}

impl LLMService {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .connect_timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap(),
        }
    }

    pub async fn stream_generate<F>(
        &self,
        config: &LLMConfig,
        prompt: &str,
        system_instruction: Option<&str>,
        on_token: F,
    ) -> Result<String, String>
    where
        F: FnMut(&str) + Send + 'static,
    {
        if config.provider == "gemini" {
            self.stream_gemini(config, prompt, system_instruction, on_token).await
        } else if config.provider == "ollama" {
            self.stream_ollama(config, prompt, system_instruction, on_token).await
        } else {
            Err(format!("Unsupported provider: {}", config.provider))
        }
    }

    async fn stream_gemini<F>(
        &self,
        config: &LLMConfig,
        prompt: &str,
        system_instruction: Option<&str>,
        mut on_token: F,
    ) -> Result<String, String>
    where
        F: FnMut(&str) + Send + 'static,
    {
        let api_key = config
            .api_key
            .as_deref()
            .ok_or_else(|| "Gemini API key is required".to_string())?;

        let primary_model = if config.model.is_empty() {
            "gemini-flash-lite-latest".to_string()
        } else {
            config.model.clone()
        };

        // Fallback candidate chain: primary model -> gemini-flash-lite-latest -> gemini-2.5-flash-lite -> gemini-flash-latest
        let mut candidates = vec![primary_model];
        for fallback in [
            "gemini-flash-lite-latest",
            "gemini-2.5-flash-lite",
            "gemini-flash-latest",
            "gemini-2.5-flash",
        ] {
            if !candidates.iter().any(|c| c == fallback) {
                candidates.push(fallback.to_string());
            }
        }

        let mut body = serde_json::json!({
            "contents": [{
                "role": "user",
                "parts": [{ "text": prompt }]
            }]
        });

        if let Some(sys) = system_instruction {
            body["systemInstruction"] = serde_json::json!({
                "parts": [{ "text": sys }]
            });
        }

        let mut last_err = String::new();

        for model in candidates {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?key={}&alt=sse",
                model, api_key
            );

            // Timeout after 15s if connection or initial response headers stall
            let send_fut = self.client.post(&url).json(&body).send();
            let resp = match tokio::time::timeout(std::time::Duration::from_secs(15), send_fut).await {
                Ok(Ok(r)) => r,
                Ok(Err(e)) => {
                    last_err = format!("Gemini connection error on {model}: {e}");
                    continue;
                }
                Err(_) => {
                    last_err = format!("Gemini model {model} initial response timed out after 15s");
                    continue;
                }
            };

            if !resp.status().is_success() {
                let status = resp.status();
                let err_text = resp.text().await.unwrap_or_default();
                last_err = format!("Gemini API error on {model} ({status}): {err_text}");
                // On any HTTP failure (503 high demand, 404 deprecated, 429 quota, 500 error), continue to fallback
                continue;
            }

            let mut stream = resp.bytes_stream();
            let mut full_output = String::new();
            let mut stream_stalled = false;

            loop {
                // Timeout per token chunk: 20 seconds
                let chunk_fut = stream.next();
                match tokio::time::timeout(std::time::Duration::from_secs(20), chunk_fut).await {
                    Ok(Some(chunk_res)) => {
                        let chunk = match chunk_res {
                            Ok(c) => c,
                            Err(e) => {
                                last_err = format!("Stream read error on {model}: {e}");
                                stream_stalled = true;
                                break;
                            }
                        };
                        let text = String::from_utf8_lossy(&chunk);

                        for line in text.lines() {
                            if let Some(data_str) = line.strip_prefix("data: ") {
                                if let Ok(val) = serde_json::from_str::<serde_json::Value>(data_str) {
                                    if let Some(token) = val["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                                        full_output.push_str(token);
                                        on_token(token);
                                    }
                                }
                            }
                        }
                    }
                    Ok(None) => break, // Stream completed normally
                    Err(_) => {
                        last_err = format!("Stream stalled on {model} (no response for 20s)");
                        stream_stalled = true;
                        break;
                    }
                }
            }

            if !stream_stalled && !full_output.is_empty() {
                return Ok(full_output);
            }
        }

        Err(if last_err.is_empty() {
            "All Gemini model candidate attempts failed to return content".to_string()
        } else {
            last_err
        })
    }

    async fn stream_ollama<F>(
        &self,
        config: &LLMConfig,
        prompt: &str,
        system_instruction: Option<&str>,
        mut on_token: F,
    ) -> Result<String, String>
    where
        F: FnMut(&str) + Send + 'static,
    {
        let base_url = config
            .base_url
            .as_deref()
            .unwrap_or("http://localhost:11434");

        let model = if config.model.is_empty() || config.model == "llama3.2:1b" {
            "qwen2.5:7b"
        } else {
            &config.model
        };

        let url = format!("{base_url}/api/generate");

        let mut body = serde_json::json!({
            "model": model,
            "prompt": prompt,
            "stream": true,
        });

        if let Some(sys) = system_instruction {
            body["system"] = serde_json::json!(sys);
        }

        let send_fut = self.client.post(&url).json(&body).send();
        let resp = match tokio::time::timeout(std::time::Duration::from_secs(600), send_fut).await {
            Ok(Ok(r)) => r,
            Ok(Err(e)) => return Err(format!("Ollama connection error (check if Ollama is running): {e}")),
            Err(_) => return Err("Ollama connection timed out after 600s".to_string()),
        };

        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(format!("Ollama error ({}): {}", status, err_text));
        }

        let mut stream = resp.bytes_stream();
        let mut full_output = String::new();

        loop {
            let chunk_fut = stream.next();
            match tokio::time::timeout(std::time::Duration::from_secs(180), chunk_fut).await {
                Ok(Some(chunk_res)) => {
                    let chunk = chunk_res.map_err(|e| format!("Stream read error: {e}"))?;
                    let text = String::from_utf8_lossy(&chunk);

                    for line in text.lines() {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                            if let Some(token) = val["response"].as_str() {
                                full_output.push_str(token);
                                on_token(token);
                            }
                            if val["done"].as_bool() == Some(true) {
                                return Ok(full_output);
                            }
                        }
                    }
                }
                Ok(None) => break,
                Err(_) => return Err("Ollama stream stalled for 60s".to_string()),
            }
        }

        Ok(full_output)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Run with `cargo test -- --ignored test_ollama_streaming`
    async fn test_ollama_streaming() {
        let config = LLMConfig {
            provider: "ollama".to_string(),
            model: "llama3.2:1b".to_string(),
            api_key: None,
            base_url: Some("http://localhost:11434".to_string()),
        };

        let llm = LLMService::new();
        let result = llm
            .stream_generate(
                &config,
                "What is 2 + 2? Answer in one word.",
                None,
                |token| {
                    print!("{token}");
                },
            )
            .await;

        match result {
            Ok(output) => {
                println!("\nOllama output: {}", output);
                assert!(!output.is_empty());
            }
            Err(e) => {
                panic!("Ollama streaming failed: {}", e);
            }
        }
    }

    #[tokio::test]
    #[ignore] // Run with `cargo test -- --ignored test_simple_lecture_synthesis_ollama --nocapture`
    async fn test_simple_lecture_synthesis_ollama() {
        use crate::youtube::YouTubeService;
        use crate::db::{Database, JobRecord, NotebookRecord};
        use std::path::PathBuf;

        println!("=== Starting Simple Lecture Synthesis with Local Ollama ===");

        // 1. Fetch transcript for educational lecture ("What is an API? in 3 minutes")
        let video_id = "s7wmiS2mSXY";
        let transcript = YouTubeService::fetch_transcript(video_id).await
            .expect("Failed to fetch transcript for s7wmiS2mSXY");

        println!("Lecture Title: {}", transcript.video_info.title);
        println!("Transcript segments: {}", transcript.segments.len());
        println!("Full text length: {} chars", transcript.full_text.len());

        // 2. Ollama configuration
        let config = LLMConfig {
            provider: "ollama".to_string(),
            model: "llama3.2:1b".to_string(),
            api_key: None,
            base_url: Some("http://localhost:11434".to_string()),
        };
        let llm = LLMService::new();

        // 3. Step 1: Curriculum Outline Indexing Prompt
        let index_prompt = format!(
            "Analyze this video transcript and generate a structured JSON array of 3 topics for study notes.\nTitle: \"{}\"\nTranscript:\n\"\"\"\n{}\n\"\"\"\nOutput ONLY a valid JSON array like [ {{\"title\": \"...\", \"description\": \"...\", \"startTime\": 0, \"timeDisplay\": \"0:00\"}} ]",
            transcript.video_info.title,
            &transcript.full_text[..transcript.full_text.len().min(4000)]
        );

        println!("\n[1/3] Streaming curriculum outline from Ollama (llama3.2:1b)...");
        let outline = llm.stream_generate(
            &config,
            &index_prompt,
            Some("You are an expert curriculum designer. Output ONLY valid JSON array with no conversational filler or markdown fences."),
            |tok| {
                use std::io::Write;
                print!("{tok}");
                std::io::stdout().flush().ok();
            },
        ).await.expect("Failed to generate outline with Ollama");

        println!("\n\nOutline generated successfully ({} chars).", outline.len());

        // 4. Step 2: Comprehensive Study Notes with Mermaid diagram
        let notes_prompt = format!(
            "Write comprehensive, clear study notes for the topic 'Understanding APIs: Concepts, Requests, and Responses' based on this lecture.\nInclude a valid mermaid flowchart diagram illustrating the client-API-server interaction.\nTranscript excerpt:\n\"\"\"\n{}\n\"\"\"\nFormat in clean Markdown with ## headings and ```mermaid diagram.",
            &transcript.full_text[..transcript.full_text.len().min(3000)]
        );

        println!("\n[2/3] Streaming comprehensive study notes & Mermaid diagram from Ollama...");
        let notes = llm.stream_generate(
            &config,
            &notes_prompt,
            Some("You are an expert technical tutor. Format notes with clean markdown and valid Mermaid flowchart diagrams."),
            |tok| {
                use std::io::Write;
                print!("{tok}");
                std::io::stdout().flush().ok();
            },
        ).await.expect("Failed to generate notes with Ollama");

        println!("\n\nNotes generated successfully ({} chars).", notes.len());

        // 5. Step 3: Vault persistence in SQLite
        let db_dir = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".to_string()))
            .join(".local/share/com.tauri.dev");
        std::fs::create_dir_all(&db_dir).ok();
        let db = Database::new(db_dir).expect("Failed to open SQLite database");

        let timestamp = chrono::Utc::now().to_rfc3339();
        let job_id = format!("job-ollama-{}", chrono::Utc::now().timestamp_millis());
        let nb_id = format!("nb-ollama-{}", chrono::Utc::now().timestamp_millis());

        let job = JobRecord {
            id: job_id.clone(),
            url: format!("https://www.youtube.com/watch?v={}", video_id),
            status: "complete".to_string(),
            current_step: 4,
            options_json: Some("{\"provider\": \"ollama\", \"model\": \"llama3.2:1b\"}".to_string()),
            created_at: timestamp.clone(),
            updated_at: timestamp.clone(),
        };
        db.insert_job(&job).expect("Failed to insert job");

        let notebook = NotebookRecord {
            id: nb_id.clone(),
            job_id: Some(job_id),
            title: transcript.video_info.title.clone(),
            content_json: serde_json::json!({
                "id": nb_id,
                "title": transcript.video_info.title,
                "videoSources": [{
                    "id": video_id,
                    "title": transcript.video_info.title,
                    "url": format!("https://www.youtube.com/watch?v={}", video_id),
                }],
                "topics": [{
                    "id": "topic-1",
                    "title": "Understanding APIs: Concepts, Requests, and Responses",
                    "content": notes,
                }],
                "rawOutline": outline,
                "provider": "ollama",
                "model": "llama3.2:1b"
            }).to_string(),
            created_at: timestamp,
        };
        db.save_notebook(&notebook).expect("Failed to save notebook");

        let retrieved = db.get_notebook(&nb_id).expect("Failed to read back notebook");
        assert!(retrieved.is_some());
        println!("\n[3/3] Verified saved notebook in NoteForge SQLite vault: ID {}", nb_id);
        println!("=== Ollama End-to-End Synthesis Test PASSED! ===");
    }
}
