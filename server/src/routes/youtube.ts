import { Router, Request, Response } from 'express';
import { transcriptService } from '../services/transcript.service';
import { extractVideoId, extractPlaylistId, isPlaylistUrl } from '../utils/youtube';

const router = Router();

// Get video info
router.get('/video/:videoId', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    
    // Check if we have a cached transcript
    const cached = transcriptService.loadTranscript(videoId);
    
    if (cached) {
      res.json({
        success: true,
        data: {
          videoInfo: cached.videoInfo,
          hasTranscript: true,
          transcriptLength: cached.segments.length
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          videoInfo: {
            id: videoId,
            title: 'Unknown',
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          },
          hasTranscript: false
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get video info'
    });
  }
});

// Extract transcript for a single video
router.post('/transcript', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube video URL'
      });
    }

    const transcript = await transcriptService.fetchTranscript(videoId);
    
    res.json({
      success: true,
      data: {
        videoId: transcript.videoId,
        videoInfo: transcript.videoInfo,
        segmentCount: transcript.segments.length,
        textLength: transcript.fullText.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract transcript'
    });
  }
});

// Get playlist info
router.post('/playlist', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    if (!isPlaylistUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid playlist URL'
      });
    }

    const { playlist, transcripts } = await transcriptService.fetchPlaylist(url);
    
    res.json({
      success: true,
      data: {
        playlist,
        transcriptsExtracted: transcripts.length,
        transcriptsFailed: playlist.videoCount - transcripts.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch playlist'
    });
  }
});

// Validate URL
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    const videoId = extractVideoId(url);
    const playlistId = extractPlaylistId(url);
    const isPlaylist = isPlaylistUrl(url);

    res.json({
      success: true,
      data: {
        valid: !!(videoId || playlistId),
        type: isPlaylist ? 'playlist' : (videoId ? 'video' : 'unknown'),
        videoId,
        playlistId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
});

export default router;
