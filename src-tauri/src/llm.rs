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

        let model = if config.model.is_empty() {
            "llama3.2"
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
        let resp = match tokio::time::timeout(std::time::Duration::from_secs(15), send_fut).await {
            Ok(Ok(r)) => r,
            Ok(Err(e)) => return Err(format!("Ollama connection error (check if Ollama is running): {e}")),
            Err(_) => return Err("Ollama connection timed out after 15s".to_string()),
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
            match tokio::time::timeout(std::time::Duration::from_secs(20), chunk_fut).await {
                Ok(Some(chunk_res)) => {
                    let chunk = chunk_res.map_err(|e| format!("Stream read error: {e}"))?;
                    let text = String::from_utf8_lossy(&chunk);

                    for line in text.lines() {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                            if let Some(token) = val["response"].as_str() {
                                full_output.push_str(token);
                                on_token(token);
                            }
                        }
                    }
                }
                Ok(None) => break,
                Err(_) => return Err("Ollama stream stalled for 20s".to_string()),
            }
        }

        Ok(full_output)
    }
}
