// Load environment variables first
require('dotenv').config();

import express from 'express';
import cors from 'cors';
import youtubeRoutes from './routes/youtube.js';
import processRoutes from './routes/process.js';
import settingsRoutes from './routes/settings.js';
import { multiLlmService } from './services/multi-llm.service.js';
import { llmService } from './services/llm.service.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/youtube', youtubeRoutes);
app.use('/api/process', processRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  const llmHealth = await multiLlmService.checkHealth();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      llm: llmHealth.healthy ? 'connected' : 'disconnected',
      activeProvider: llmHealth.provider,
      ...(llmHealth.error && { llmError: llmHealth.error }),
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'NoteForge API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      youtube: {
        validate: 'POST /api/youtube/validate',
        transcript: 'POST /api/youtube/transcript',
        playlist: 'POST /api/youtube/playlist',
        videoInfo: 'GET /api/youtube/video/:videoId'
      },
      process: {
        start: 'POST /api/process/start',
        status: 'GET /api/process/status/:jobId',
        jobs: 'GET /api/process/jobs',
        notebook: 'GET /api/process/notebook/:notebookId',
        index: 'GET /api/process/index/:indexId',
        llmHealth: 'GET /api/process/llm/health',
        llmConfig: 'POST /api/process/llm/config'
      }
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 NoteForge Server Started                             ║
║                                                           ║
║   Server:  http://localhost:${PORT}                          ║
║   API:     http://localhost:${PORT}/api                      ║
║                                                           ║
║   Ensure Ollama is running:                               ║
║   $ ollama run mistral                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
