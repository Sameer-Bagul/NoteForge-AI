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

    pub fn unescape_html(s: &str) -> String {
        let mut result = s
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&#x27;", "'")
            .replace("&apos;", "'")
            .replace("&nbsp;", " ");

        if result.contains("&#") {
            if let Ok(num_re) = Regex::new(r"&#(\d+);") {
                result = num_re
                    .replace_all(&result, |caps: &regex::Captures| {
                        if let Ok(code) = caps[1].parse::<u32>() {
                            if let Some(c) = char::from_u32(code) {
                                return c.to_string();
                            }
                        }
                        caps[0].to_string()
                    })
                    .to_string();
            }
        }
        result
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

    pub fn format_duration(seconds_str: Option<&str>) -> Option<String> {
        let total_secs: u64 = seconds_str?.parse().ok()?;
        let hours = total_secs / 3600;
        let mins = (total_secs % 3600) / 60;
        let secs = total_secs % 60;
        if hours > 0 {
            Some(format!("{hours}:{mins:02}:{secs:02}"))
        } else {
            Some(format!("{mins}:{secs:02}"))
        }
    }

    pub fn parse_description_chapters(description: &str, total_duration_secs: f64) -> Vec<SubtitleSegment> {
        let chapter_re = Regex::new(r#"(?m)^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+([^\n]+)"#).unwrap();
        let mut raw_chapters: Vec<(f64, String)> = Vec::new();

        for cap in chapter_re.captures_iter(description) {
            let h: f64 = cap.get(1).map_or(0.0, |m| m.as_str().parse().unwrap_or(0.0));
            let m: f64 = cap.get(2).map_or(0.0, |m| m.as_str().parse().unwrap_or(0.0));
            let s: f64 = cap.get(3).map_or(0.0, |m| m.as_str().parse().unwrap_or(0.0));
            let start = h * 3600.0 + m * 60.0 + s;
            let title = cap.get(4).map_or("", |m| m.as_str()).trim().to_string();
            if !title.is_empty() {
                raw_chapters.push((start, title));
            }
        }

        if raw_chapters.is_empty() {
            // Fall back to paragraphs
            let paragraphs: Vec<&str> = description
                .split("\n\n")
                .map(|p| p.trim())
                .filter(|p| !p.is_empty() && p.len() > 10)
                .collect();
            if paragraphs.is_empty() {
                if !description.trim().is_empty() {
                    return vec![SubtitleSegment {
                        start: 0.0,
                        duration: total_duration_secs,
                        text: Self::clean_text(description),
                    }];
                }
                return Vec::new();
            }

            let dur_per_p = if !paragraphs.is_empty() {
                total_duration_secs / (paragraphs.len() as f64)
            } else {
                0.0
            };

            return paragraphs
                .into_iter()
                .enumerate()
                .map(|(i, p)| SubtitleSegment {
                    start: (i as f64) * dur_per_p,
                    duration: dur_per_p,
                    text: Self::clean_text(p),
                })
                .collect();
        }

        let mut segments = Vec::new();
        for i in 0..raw_chapters.len() {
            let (start, ref text) = raw_chapters[i];
            let next_start = if i + 1 < raw_chapters.len() {
                raw_chapters[i + 1].0
            } else {
                total_duration_secs.max(start + 60.0)
            };
            let duration = (next_start - start).max(1.0);
            segments.push(SubtitleSegment {
                start,
                duration,
                text: Self::clean_text(text),
            });
        }
        segments
    }

    pub async fn fetch_transcript(video_id: &str) -> Result<ExtractedTranscript, String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .map_err(|e| e.to_string())?;

        let mut title = format!("Video {video_id}");
        let mut channel: Option<String> = None;
        let mut duration: Option<String> = None;
        let mut thumbnail = format!("https://img.youtube.com/vi/{video_id}/hqdefault.jpg");
        let mut short_description = String::new();
        let mut segments: Vec<SubtitleSegment> = Vec::new();

        // ── Method 1: Android InnerTube API (Bypasses PO-token / bot checks) ───
        let innertube_payload = serde_json::json!({
            "context": {
                "client": {
                    "clientName": "ANDROID",
                    "clientVersion": "20.10.38",
                    "hl": "en",
                    "gl": "US"
                }
            },
            "videoId": video_id
        });

        let innertube_res = client
            .post("https://www.youtube.com/youtubei/v1/player")
            .header("Content-Type", "application/json")
            .header("User-Agent", "com.google.android.youtube/20.10.38 (Linux; U; Android 14)")
            .json(&innertube_payload)
            .send()
            .await;

        let mut total_duration_secs = 0.0;

        if let Ok(resp) = innertube_res {
            if let Ok(player_data) = resp.json::<serde_json::Value>().await {
                // Extract video metadata from videoDetails
                if let Some(vd) = player_data.get("videoDetails") {
                    if let Some(t) = vd.get("title").and_then(|v| v.as_str()) {
                        title = t.to_string();
                    }
                    if let Some(a) = vd.get("author").and_then(|v| v.as_str()) {
                        channel = Some(a.to_string());
                    }
                    if let Some(l) = vd.get("lengthSeconds").and_then(|v| v.as_str()) {
                        duration = Self::format_duration(Some(l));
                        total_duration_secs = l.parse::<f64>().unwrap_or(0.0);
                    }
                    if let Some(d) = vd.get("shortDescription").and_then(|v| v.as_str()) {
                        short_description = d.to_string();
                    }
                    if let Some(thumbs) = vd.pointer("/thumbnail/thumbnails").and_then(|t| t.as_array()) {
                        if let Some(last_thumb) = thumbs.last().and_then(|t| t.get("url")).and_then(|u| u.as_str()) {
                            thumbnail = last_thumb.to_string();
                        }
                    }
                }

                // Extract caption tracks
                if let Some(tracks) = player_data
                    .pointer("/captions/playerCaptionsTracklistRenderer/captionTracks")
                    .and_then(|v| v.as_array())
                {
                    // Prioritize English non-asr, then English any, then first track
                    let selected_track = tracks
                        .iter()
                        .find(|t| {
                            let lang = t.get("languageCode").and_then(|l| l.as_str()).unwrap_or("");
                            let is_asr = t.get("kind").and_then(|k| k.as_str()).map_or(false, |k| k == "asr");
                            lang.starts_with("en") && !is_asr
                        })
                        .or_else(|| {
                            tracks.iter().find(|t| {
                                let lang = t.get("languageCode").and_then(|l| l.as_str()).unwrap_or("");
                                lang.starts_with("en")
                            })
                        })
                        .or_else(|| tracks.first());

                    if let Some(track) = selected_track {
                        if let Some(base_url) = track.get("baseUrl").and_then(|u| u.as_str()) {
                            // Sub-attempt A: Try JSON format (fmt=json3)
                            let fmt_re = Regex::new(r"fmt=[^&]+").unwrap();
                            let json_url = if fmt_re.is_match(base_url) {
                                fmt_re.replace(base_url, "fmt=json3").to_string()
                            } else {
                                format!("{base_url}&fmt=json3")
                            };

                            if let Ok(sub_resp) = client.get(&json_url).send().await {
                                if let Ok(sub_json) = sub_resp.json::<serde_json::Value>().await {
                                    if let Some(events) = sub_json.get("events").and_then(|e| e.as_array()) {
                                        for ev in events {
                                            let start = ev.get("tStartMs").and_then(|v| v.as_f64()).unwrap_or(0.0) / 1000.0;
                                            let duration = ev.get("dDurationMs").and_then(|v| v.as_f64()).unwrap_or(0.0) / 1000.0;
                                            let mut text = String::new();

                                            if let Some(segs) = ev.get("segs").and_then(|s| s.as_array()) {
                                                for s in segs {
                                                    if let Some(u) = s.get("utf8").and_then(|u| u.as_str()) {
                                                        text.push_str(u);
                                                    }
                                                }
                                            }

                                            let clean = Self::clean_text(&Self::unescape_html(&text));
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

                            // Sub-attempt B: Fall back to raw timedtext XML (fmt=srv3)
                            if segments.is_empty() {
                                if let Ok(xml_resp) = client.get(base_url).send().await {
                                    if let Ok(xml_text) = xml_resp.text().await {
                                        let p_re = Regex::new(r#"<p t="(\d+)"(?: d="(\d+)")?[^>]*>(.*?)</p>"#).unwrap();
                                        for cap in p_re.captures_iter(&xml_text) {
                                            let start_ms: f64 = cap.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0.0);
                                            let dur_ms: f64 = cap.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0.0);
                                            let raw_text = cap.get(3).map_or("", |m| m.as_str());
                                            let clean = Self::clean_text(&Self::unescape_html(raw_text));
                                            if !clean.is_empty() {
                                                segments.push(SubtitleSegment {
                                                    start: start_ms / 1000.0,
                                                    duration: dur_ms / 1000.0,
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

        // ── Method 2: Watch page scrape fallback (if InnerTube didn't fetch segments) ───
        if segments.is_empty() {
            let web_client = reqwest::Client::builder()
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .map_err(|e| e.to_string())?;

            let url = format!("https://www.youtube.com/watch?v={video_id}");
            if let Ok(html_resp) = web_client.get(&url).send().await {
                if let Ok(html) = html_resp.text().await {
                    if title == format!("Video {video_id}") {
                        let title_re = Regex::new(r#"<title>(.*?)(?: - YouTube)?</title>"#).unwrap();
                        if let Some(caps) = title_re.captures(&html) {
                            if let Some(t) = caps.get(1) {
                                title = t.as_str().to_string();
                            }
                        }
                    }

                    let caption_re = Regex::new(r#""captionTracks":\s*(\[.*?\])"#).unwrap();
                    if let Some(caps) = caption_re.captures(&html) {
                        if let Some(json_str) = caps.get(1) {
                            if let Ok(tracks) = serde_json::from_str::<serde_json::Value>(json_str.as_str()) {
                                if let Some(arr) = tracks.as_array() {
                                    let track_url = arr
                                        .iter()
                                        .find(|t| t["languageCode"].as_str().map(|s| s.starts_with("en")).unwrap_or(false))
                                        .or_else(|| arr.first())
                                        .and_then(|t| t["baseUrl"].as_str());

                                    if let Some(sub_url) = track_url {
                                        let sub_url_json = format!("{sub_url}&fmt=json3");
                                        if let Ok(resp) = web_client.get(&sub_url_json).send().await {
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
                                                        let clean = Self::clean_text(&Self::unescape_html(&text));
                                                        if !clean.is_empty() {
                                                            segments.push(SubtitleSegment { start, duration, text: clean });
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
                }
            }
        }

        // ── Method 3: Fall back to description / chapters if creator disabled subtitles ───
        if segments.is_empty() && !short_description.trim().is_empty() {
            let dur = if total_duration_secs > 0.0 { total_duration_secs } else { 300.0 };
            segments = Self::parse_description_chapters(&short_description, dur);
        }

        let full_text = segments
            .iter()
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        if segments.is_empty() || full_text.trim().is_empty() {
            return Err("No captions, transcripts, or video description could be retrieved for this YouTube video.".to_string());
        }

        let video_info = VideoMetadata {
            id: video_id.to_string(),
            title,
            duration,
            channel,
            thumbnail,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fetch_transcript() {
        let res = YouTubeService::fetch_transcript("aircAruvnKk").await;
        assert!(res.is_ok(), "Failed to fetch transcript: {:?}", res.err());
        let transcript = res.unwrap();
        assert!(!transcript.segments.is_empty(), "Segments should not be empty");
        assert!(!transcript.full_text.is_empty(), "Full text should not be empty");
        println!("Title: {}", transcript.video_info.title);
        println!("Channel: {:?}", transcript.video_info.channel);
        println!("Duration: {:?}", transcript.video_info.duration);
        println!("Segment count: {}", transcript.segments.len());
        println!("First segment: {:?}", transcript.segments.first());
    }
}


