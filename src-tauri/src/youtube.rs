use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubtitleSegment {
    pub start: f64,
    pub duration: f64,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoMetadata {
    pub id: String,
    pub title: String,
    pub duration: Option<String>,
    pub channel: Option<String>,
    pub thumbnail: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractedTranscript {
    pub video_id: String,
    pub video_info: VideoMetadata,
    pub segments: Vec<SubtitleSegment>,
    pub full_text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistMetadata {
    pub id: String,
    pub title: String,
    pub video_count: usize,
    pub videos: Vec<VideoMetadata>,
}

pub struct YouTubeService;

impl YouTubeService {
    pub fn extract_video_id(input: &str) -> Option<String> {
        let pattern = Regex::new(
            r"(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/|^)([a-zA-Z0-9_-]{11})"
        ).ok()?;

        let caps = pattern.captures(input.trim())?;
        Some(caps.get(1)?.as_str().to_string())
    }

    pub fn extract_playlist_id(input: &str) -> Option<String> {
        let pattern = Regex::new(r"[?&]list=([a-zA-Z0-9_-]+)").ok()?;
        let caps = pattern.captures(input.trim())?;
        Some(caps.get(1)?.as_str().to_string())
    }

    pub fn is_valid_url(input: &str) -> bool {
        Self::extract_video_id(input).is_some() || Self::extract_playlist_id(input).is_some()
    }

    pub fn clean_text(text: &str) -> String {
        let re_brackets = Regex::new(r"\[.*?\]").unwrap();
        let re_parens = Regex::new(r"\(.*?\)").unwrap();
        let re_spaces = Regex::new(r"\s+").unwrap();

        let s = re_brackets.replace_all(text, "");
        let s = re_parens.replace_all(&s, "");
        let s = re_spaces.replace_all(&s, " ");
        s.trim().to_string()
    }

    pub async fn fetch_transcript(video_id: &str) -> Result<ExtractedTranscript, String> {
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .map_err(|e| e.to_string())?;

        let url = format!("https://www.youtube.com/watch?v={video_id}");
        let html = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Network error: {e}"))?
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {e}"))?;

        // Extract title
        let title_re = Regex::new(r#"<title>(.*?)(?: - YouTube)?</title>"#).unwrap();
        let title = title_re
            .captures(&html)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_else(|| format!("Video {video_id}"));

        // Look for captionTracks JSON in player response
        let caption_re = Regex::new(r#""captionTracks":\s*(\[.*?\])"#).unwrap();
        let mut segments = Vec::new();

        if let Some(caps) = caption_re.captures(&html) {
            if let Some(json_str) = caps.get(1) {
                if let Ok(tracks) = serde_json::from_str::<serde_json::Value>(json_str.as_str()) {
                    if let Some(arr) = tracks.as_array() {
                        // Prefer English or first track
                        let track_url = arr
                            .iter()
                            .find(|t| {
                                t["languageCode"]
                                    .as_str()
                                    .map(|s| s.starts_with("en"))
                                    .unwrap_or(false)
                            })
                            .or_else(|| arr.first())
                            .and_then(|t| t["baseUrl"].as_str());

                        if let Some(sub_url) = track_url {
                            let sub_url_json = format!("{sub_url}&fmt=json3");
                            if let Ok(resp) = client.get(&sub_url_json).send().await {
                                if let Ok(sub_json) = resp.json::<serde_json::Value>().await {
                                    if let Some(events) = sub_json["events"].as_array() {
                                        for ev in events {
                                            let start = ev["tStartMs"].as_f64().unwrap_or(0.0) / 1000.0;
                                            let duration = ev["dDurationMs"].as_f64().unwrap_or(0.0) / 1000.0;
                                            let mut text = String::new();

                                            if let Some(segs) = ev["segs"].as_array() {
                                                for s in segs {
                                                    if let Some(u) = s["utf8"].as_str() {
                                                        text.push_str(u);
                                                    }
                                                }
                                            }

                                            let clean = Self::clean_text(&text);
                                            if !clean.is_empty() {
                                                segments.push(SubtitleSegment {
                                                    start,
                                                    duration,
                                                    text: clean,
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        let full_text = segments
            .iter()
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        let video_info = VideoMetadata {
            id: video_id.to_string(),
            title,
            duration: None,
            channel: None,
            thumbnail: format!("https://img.youtube.com/vi/{video_id}/hqdefault.jpg"),
        };

        Ok(ExtractedTranscript {
            video_id: video_id.to_string(),
            video_info,
            segments,
            full_text,
        })
    }

    pub async fn fetch_playlist(playlist_id: &str) -> Result<PlaylistMetadata, String> {
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .map_err(|e| e.to_string())?;

        let url = format!("https://www.youtube.com/playlist?list={playlist_id}");
        let html = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Network error: {e}"))?
            .text()
            .await
            .map_err(|e| format!("Failed to read playlist response: {e}"))?;

        // Extract playlist title
        let title_re = Regex::new(r#"<title>(.*?)(?: - YouTube)?</title>"#).unwrap();
        let title = title_re
            .captures(&html)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_else(|| format!("Playlist {playlist_id}"));

        // Extract video IDs from playlist page
        let video_id_re = Regex::new(r#""videoId":\s*"([a-zA-Z0-9_-]{11})""#).unwrap();
        let mut seen_ids = std::collections::HashSet::new();
        let mut videos = Vec::new();

        for cap in video_id_re.captures_iter(&html) {
            if let Some(vid_match) = cap.get(1) {
                let vid = vid_match.as_str().to_string();
                if seen_ids.insert(vid.clone()) {
                    videos.push(VideoMetadata {
                        id: vid.clone(),
                        title: format!("Video {vid}"),
                        duration: None,
                        channel: None,
                        thumbnail: format!("https://img.youtube.com/vi/{vid}/hqdefault.jpg"),
                    });
                }
            }
        }

        let video_count = videos.len();

        Ok(PlaylistMetadata {
            id: playlist_id.to_string(),
            title,
            video_count,
            videos,
        })
    }
}

