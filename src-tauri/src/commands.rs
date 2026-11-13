use crate::db::{Database, JobRecord, NotebookRecord};
use crate::keychain::KeychainVault;
use crate::llm::{LLMConfig, LLMService};
use crate::youtube::{ExtractedTranscript, YouTubeService};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize)]
pub struct ValidateUrlResult {
    pub valid: bool,
    pub video_id: Option<String>,
    pub playlist_id: Option<String>,
}

#[tauri::command]
pub fn validate_url(url: String) -> ValidateUrlResult {
    let video_id = YouTubeService::extract_video_id(&url);
    let playlist_id = YouTubeService::extract_playlist_id(&url);
    let valid = video_id.is_some() || playlist_id.is_some();

    ValidateUrlResult {
        valid,
        video_id,
        playlist_id,
    }
}

#[tauri::command]
pub async fn fetch_transcript(video_id: String) -> Result<ExtractedTranscript, String> {
    YouTubeService::fetch_transcript(&video_id).await
}

#[tauri::command]
pub fn save_api_key(provider: String, key: String) -> Result<(), String> {
    KeychainVault::set_key(&provider, &key)
}

#[tauri::command]
pub fn get_api_key(provider: String) -> Result<Option<String>, String> {
    KeychainVault::get_key(&provider)
}

#[tauri::command]
pub fn delete_api_key(provider: String) -> Result<(), String> {
    KeychainVault::delete_key(&provider)
}

#[tauri::command]
pub fn list_jobs(db: State<Arc<Database>>) -> Result<Vec<JobRecord>, String> {
    db.list_jobs().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_job(id: String, db: State<Arc<Database>>) -> Result<Option<JobRecord>, String> {
    db.get_job(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_notebooks(db: State<Arc<Database>>) -> Result<Vec<NotebookRecord>, String> {
    db.list_notebooks().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_notebook(id: String, db: State<Arc<Database>>) -> Result<Option<NotebookRecord>, String> {
    db.get_notebook(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_notebook(notebook: NotebookRecord, db: State<Arc<Database>>) -> Result<(), String> {
    db.save_notebook(&notebook).map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
pub struct GeneratePromptRequest {
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
}

#[tauri::command]
pub async fn stream_llm(
    app: AppHandle,
    request: GeneratePromptRequest,
    event_channel: String,
) -> Result<String, String> {
    // Attempt to load API key from keychain if provider is gemini and not provided
    let api_key = KeychainVault::get_key(&request.provider).ok().flatten();

    let config = LLMConfig {
        provider: request.provider,
        model: request.model,
        api_key,
        base_url: request.base_url,
    };

    let llm = LLMService::new();
    let channel = event_channel.clone();

    llm.stream_generate(
        &config,
        &request.prompt,
        request.system_prompt.as_deref(),
        move |token| {
            app.emit(&channel, token).ok();
        },
    )
    .await
}
