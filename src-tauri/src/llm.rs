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
            client: Client::builder().build().unwrap(),
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

        let model = if config.model.is_empty() {
            "gemini-2.5-flash"
        } else {
            &config.model
        };

        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?key={}&alt=sse",
            model, api_key
        );

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

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Gemini connection error: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(format!("Gemini API error ({}): {}", status, err_text));
        }

        let mut stream = resp.bytes_stream();
        let mut full_output = String::new();

        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res.map_err(|e| format!("Stream read error: {e}"))?;
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

        Ok(full_output)
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

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Ollama connection error (check if Ollama is running): {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            return Err(format!("Ollama error ({}): {}", status, err_text));
        }

        let mut stream = resp.bytes_stream();
        let mut full_output = String::new();

        while let Some(chunk_res) = stream.next().await {
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

        Ok(full_output)
    }
}
