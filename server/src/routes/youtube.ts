import { Router } from 'express';
import { YoutubeController } from '../controllers/youtube.controller.js';

const router = Router();

// Get video info
router.get('/video/:videoId', YoutubeController.getVideoInfo);

// Extract transcript for a single video
router.post('/transcript', YoutubeController.extractTranscript);

// Get playlist info
router.post('/playlist', YoutubeController.getPlaylistInfo);

// Validate URL
router.post('/validate', YoutubeController.validateUrl);

export default router;
