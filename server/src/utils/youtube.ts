import { VideoInfo, PlaylistInfo } from '../types';

// Extract video ID from various YouTube URL formats
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract playlist ID from YouTube URL
export function extractPlaylistId(url: string): string | null {
  const pattern = /[?&]list=([a-zA-Z0-9_-]+)/;
  const match = url.match(pattern);
  return match ? match[1] : null;
}

// Check if URL is a playlist
export function isPlaylistUrl(url: string): boolean {
  return url.includes('list=');
}

// Check if URL is a single video
export function isVideoUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

// Format duration from seconds to readable format
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Get thumbnail URL for a video
export function getThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'high'): string {
  const qualityMap = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    maxres: 'maxresdefault'
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

// Clean transcript text (remove filler words, fix formatting)
export function cleanTranscriptText(text: string): string {
  return text
    .replace(/\[.*?\]/g, '') // Remove [Music], [Applause], etc.
    .replace(/\(.*?\)/g, '') // Remove (laughing), (coughing), etc.
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    .trim();
}

// Build clean continuous transcript from subtitle segments
export function buildCleanTranscript(segments: Array<{ text: string }>): string {
  if (!segments || segments.length === 0) {
    return '';
  }

  // Merge all segment text
  let fullText = segments
    .map(s => s.text)
    .join(' ')
    .trim();

  // Clean up the text
  fullText = fullText
    .replace(/\[.*?\]/g, '')  // Remove [Music], [Applause], etc.
    .replace(/\(.*?\)/g, '')  // Remove (laughing), etc.
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .replace(/([.!?])\s*([A-Z])/g, '$1 $2')  // Ensure space after sentence ends
    .trim();

  return fullText;
}

// Split text into chunks for LLM processing (smarter sentence-based chunking)
export function chunkText(text: string, maxChunkSize: number = 4000): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  if (text.length <= maxChunkSize) {
    return [text];
  }

  // Split by sentences (improved regex)
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    // If single sentence exceeds max size, split it by clauses
    if (trimmedSentence.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // Split long sentence by commas or semicolons
      const parts = trimmedSentence.split(/[,;]/);
      let longChunk = '';
      
      for (const part of parts) {
        if ((longChunk + part).length > maxChunkSize) {
          if (longChunk) chunks.push(longChunk.trim());
          longChunk = part;
        } else {
          longChunk += (longChunk ? ', ' : '') + part;
        }
      }
      if (longChunk) chunks.push(longChunk.trim());
      continue;
    }

    // Would adding this sentence exceed the limit?
    if ((currentChunk + ' ' + trimmedSentence).length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Filter out empty chunks
  return chunks.filter(chunk => chunk.length > 0);
}

// Estimate reading time in minutes
export function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

// Count words in text
export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}
