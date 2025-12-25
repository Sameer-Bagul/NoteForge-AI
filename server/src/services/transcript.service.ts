import YTDlpWrap from 'yt-dlp-wrap';
import { VideoInfo, VideoTranscript, TranscriptSegment, PlaylistInfo } from '../types';
import { extractVideoId, extractPlaylistId, getThumbnailUrl, cleanTranscriptText, formatDuration, buildCleanTranscript } from '../utils/youtube';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = path.join(__dirname, '../../storage/transcripts');
const ytDlpWrap = new YTDlpWrap();

// Type definitions for yt-dlp output structures
interface YtDlpSubtitleSegment {
  utf8?: string;
}

interface YtDlpSubtitleEvent {
  segs?: YtDlpSubtitleSegment[];
  tStartMs?: number;
  dDurationMs?: number;
}

interface YtDlpSubtitleData {
  events?: YtDlpSubtitleEvent[];
}

interface YtDlpPlaylistEntry {
  id?: string;
  url?: string;
  title?: string;
  duration?: number;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string }>;
  uploader?: string;
  channel?: string;
  uploader_id?: string;
}

interface YtDlpPlaylistData {
  title?: string;
  playlist_title?: string;
  entries?: YtDlpPlaylistEntry[];
  items?: YtDlpPlaylistEntry[];
}

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export class TranscriptService {
  
  // Fetch transcript for a single video using yt-dlp
  async fetchTranscript(videoIdOrUrl: string): Promise<VideoTranscript> {
    const videoId = extractVideoId(videoIdOrUrl) || videoIdOrUrl;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    console.log(`Fetching transcript for video: ${videoId}`);
    
    try {
      // Fetch video metadata
      const metadataStdout = await ytDlpWrap.execPromise([
        videoUrl,
        '--dump-json',
        '--skip-download',
        '--no-warnings'
      ]);
      const metadata = JSON.parse(metadataStdout);
      
      const videoInfo: VideoInfo = {
        id: videoId,
        title: metadata.title || `Video ${videoId}`,
        duration: formatDuration(metadata.duration || 0),
        thumbnail: metadata.thumbnail || getThumbnailUrl(videoId),
        channelName: metadata.uploader || metadata.channel
      };

      console.log(`  📹 ${videoInfo.title} (${videoInfo.duration})`);

      // Try to get subtitles
      let segments: TranscriptSegment[] = [];
      let fullText = '';

      try {
        const tempFile = path.join(STORAGE_DIR, `temp_${videoId}`);
        
        // Download subtitles
        await ytDlpWrap.execPromise([
          videoUrl,
          '--write-auto-sub',
          '--write-sub',
          '--sub-lang', 'en',
          '--sub-format', 'json3',
          '--skip-download',
          '--output', tempFile,
          '--no-warnings'
        ]);
        
        // Look for subtitle files
        const possibleFiles = [
          `${tempFile}.en.json3`,
          `${tempFile}.en-US.json3`,
          `${tempFile}.en-GB.json3`
        ];
        
        let subsData: YtDlpSubtitleData | null = null;
        for (const filename of possibleFiles) {
          if (fs.existsSync(filename)) {
            const subsContent = fs.readFileSync(filename, 'utf-8');
            subsData = JSON.parse(subsContent) as YtDlpSubtitleData;
            fs.unlinkSync(filename); // Clean up
            break;
          }
        }

        if (subsData && subsData.events) {
          // Parse JSON3 subtitle format
          segments = subsData.events
            .filter((event) => event.segs && event.tStartMs !== undefined)
            .map((event) => ({
              start: event.tStartMs! / 1000,
              duration: event.dDurationMs ? event.dDurationMs / 1000 : 0,
              text: cleanTranscriptText(
                event.segs!.map((seg) => seg.utf8 || '').join('')
              )
            }))
            .filter((seg: TranscriptSegment) => seg.text.trim().length > 0);

          // Build clean continuous transcript from segments
          fullText = buildCleanTranscript(segments);
        }
      } catch (subsError) {
        console.warn(`  ⚠️ No subtitles available for ${videoId}`);
        // If no subtitles, use description as fallback
        if (metadata.description) {
          const cleanDesc = cleanTranscriptText(metadata.description);
          fullText = cleanDesc;
          segments = [{
            start: 0,
            duration: metadata.duration || 0,
            text: cleanDesc
          }];
        }
      }

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
      console.error(`❌ Error fetching transcript for ${videoId}:`, error);
      throw new Error(`Failed to fetch transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fetch playlist info and all video transcripts using yt-dlp
  async fetchPlaylist(playlistUrl: string): Promise<{ playlist: PlaylistInfo; transcripts: VideoTranscript[] }> {
    const playlistId = extractPlaylistId(playlistUrl);
    
    if (!playlistId) {
      throw new Error('Invalid playlist URL');
    }

    console.log(`\n📺 Fetching playlist: ${playlistId}`);

    try {
      // Get playlist info using yt-dlp with flat-playlist option
      const playlistData: YtDlpPlaylistData = await ytDlpWrap.execPromise([
        playlistUrl,
        '--flat-playlist',
        '--dump-single-json',
        '--no-warnings'
      ]).then(stdout => JSON.parse(stdout) as YtDlpPlaylistData);
      
      console.log(`  🔍 Playlist data received, processing...`);
      
      // Extract video entries
      const entries = playlistData.entries || playlistData.items || [];
      
      if (!Array.isArray(entries)) {
        console.error('Unexpected playlist structure:', playlistData);
        throw new Error('Playlist entries is not an array');
      }
      
      const videos: VideoInfo[] = entries.map((entry) => ({
        id: entry.id || entry.url?.split('v=')[1] || '',
        title: entry.title || `Video ${entry.id || 'unknown'}`,
        duration: entry.duration ? formatDuration(entry.duration) : undefined,
        thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url || getThumbnailUrl(entry.id || ''),
        channelName: entry.uploader || entry.channel || entry.uploader_id
      })).filter((v: VideoInfo) => v.id); // Filter out any invalid entries
      
      const playlist: PlaylistInfo = {
        id: playlistId,
        title: playlistData.title || playlistData.playlist_title || 'Unknown Playlist',
        videoCount: videos.length,
        videos
      };

      console.log(`  📋 ${playlist.title}`);
      console.log(`  📊 ${playlist.videoCount} videos\n`);

      if (playlist.videoCount === 0) {
        throw new Error('No videos found in playlist');
      }

      // Fetch transcripts for all videos
      const transcripts: VideoTranscript[] = [];
      let successCount = 0;
      
      // Get max videos from environment or use all videos
      const maxVideos = process.env.MAX_PLAYLIST_VIDEOS 
        ? parseInt(process.env.MAX_PLAYLIST_VIDEOS, 10) 
        : playlist.videos.length; // Process ALL videos by default
      
      const videosToProcess = Math.min(playlist.videos.length, maxVideos);
      console.log(`📊 Processing ${videosToProcess} out of ${playlist.videoCount} videos`);
      
      for (let i = 0; i < videosToProcess; i++) {
        const video = playlist.videos[i];
        try {
          console.log(`[${i + 1}/${videosToProcess}] Fetching: ${video.title}`);
          const transcript = await this.fetchTranscript(video.id);
          transcripts.push(transcript);
          successCount++;
          
          // Small delay to avoid rate limiting
          await this.delay(1500);
        } catch (error) {
          console.warn(`  ⚠️ Skipping ${video.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log(`\n✅ Successfully fetched ${successCount}/${videosToProcess} transcripts\n`);

      if (transcripts.length === 0) {
        throw new Error('No transcripts could be fetched from the playlist');
      }

      return { playlist, transcripts };
    } catch (error) {
      console.error('❌ Error fetching playlist:', error);
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
