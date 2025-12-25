import { YoutubeTranscript } from 'youtube-transcript';
import ytpl from 'ytpl';
import { VideoInfo, VideoTranscript, TranscriptSegment, PlaylistInfo } from '../types';
import { extractVideoId, extractPlaylistId, getThumbnailUrl, cleanTranscriptText, formatDuration } from '../utils/youtube';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = path.join(__dirname, '../../storage/transcripts');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export class TranscriptService {
  
  // Fetch transcript for a single video
  async fetchTranscript(videoIdOrUrl: string): Promise<VideoTranscript> {
    const videoId = extractVideoId(videoIdOrUrl) || videoIdOrUrl;
    
    console.log(`Fetching transcript for video: ${videoId}`);
    
    try {
      // Get transcript segments
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      
      const segments: TranscriptSegment[] = transcriptItems.map(item => ({
        start: item.offset / 1000, // Convert to seconds
        duration: item.duration / 1000,
        text: cleanTranscriptText(item.text)
      }));

      // Combine all text
      const fullText = segments.map(s => s.text).join(' ');

      // Get video info (basic info from transcript context)
      const videoInfo: VideoInfo = {
        id: videoId,
        title: `Video ${videoId}`, // Will be updated if we can get actual title
        thumbnail: getThumbnailUrl(videoId)
      };

      const transcript: VideoTranscript = {
        videoId,
        videoInfo,
        segments,
        fullText,
        extractedAt: new Date().toISOString()
      };

      // Store transcript
      this.storeTranscript(transcript);

      return transcript;
    } catch (error) {
      console.error(`Error fetching transcript for ${videoId}:`, error);
      throw new Error(`Failed to fetch transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fetch playlist info and all video transcripts
  async fetchPlaylist(playlistUrl: string): Promise<{ playlist: PlaylistInfo; transcripts: VideoTranscript[] }> {
    const playlistId = extractPlaylistId(playlistUrl);
    
    if (!playlistId) {
      throw new Error('Invalid playlist URL');
    }

    console.log(`Fetching playlist: ${playlistId}`);

    try {
      // Get playlist info
      const playlistData = await ytpl(playlistId, { limit: Infinity });
      
      const playlist: PlaylistInfo = {
        id: playlistId,
        title: playlistData.title,
        videoCount: playlistData.items.length,
        videos: playlistData.items.map(item => ({
          id: item.id,
          title: item.title,
          duration: item.duration || undefined,
          thumbnail: item.thumbnails[0]?.url || getThumbnailUrl(item.id),
          channelName: item.author?.name
        }))
      };

      // Fetch transcripts for all videos
      const transcripts: VideoTranscript[] = [];
      
      for (const video of playlist.videos) {
        try {
          console.log(`Fetching transcript for: ${video.title}`);
          const transcript = await this.fetchTranscript(video.id);
          // Update video info with actual title
          transcript.videoInfo = video;
          transcripts.push(transcript);
          
          // Small delay to avoid rate limiting
          await this.delay(500);
        } catch (error) {
          console.warn(`Skipping video ${video.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { playlist, transcripts };
    } catch (error) {
      console.error('Error fetching playlist:', error);
      throw new Error(`Failed to fetch playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Store transcript to disk
  private storeTranscript(transcript: VideoTranscript): void {
    const filePath = path.join(STORAGE_DIR, `${transcript.videoId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(transcript, null, 2));
    console.log(`Transcript stored: ${filePath}`);
  }

  // Load transcript from disk
  loadTranscript(videoId: string): VideoTranscript | null {
    const filePath = path.join(STORAGE_DIR, `${videoId}.json`);
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as VideoTranscript;
    }
    
    return null;
  }

  // Get all stored transcripts
  getAllTranscripts(): VideoTranscript[] {
    const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith('.json'));
    return files.map(file => {
      const data = fs.readFileSync(path.join(STORAGE_DIR, file), 'utf-8');
      return JSON.parse(data) as VideoTranscript;
    });
  }

  // Helper delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const transcriptService = new TranscriptService();
