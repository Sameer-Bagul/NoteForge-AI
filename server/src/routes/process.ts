import { Router, Request, Response } from 'express';
import { jobService } from '../services/job.service';
import { indexService } from '../services/index.service';
import { notesService } from '../services/notes.service';
import { llmService } from '../services/llm.service';

const router = Router();

// Start a new processing job
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { url, title } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Check LLM availability
    const llmAvailable = await llmService.checkHealth();
    if (!llmAvailable) {
      return res.status(503).json({
        success: false,
        error: 'LLM service (Ollama) is not available. Please ensure Ollama is running.'
      });
    }

    // Create job
    const job = jobService.createJob(url);
    
    // Start processing in background
    jobService.processUrl(job.id, url, title).catch(err => {
      console.error(`Background job ${job.id} failed:`, err);
    });

    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        message: 'Processing started'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start processing'
    });
  }
});

// Get job status
router.get('/status/:jobId', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = jobService.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        currentStep: job.currentStep,
        steps: job.steps,
        videos: job.videos,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        // Include results if complete
        ...(job.status === 'complete' && {
          index: job.index,
          notebook: job.notebook
        })
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get job status'
    });
  }
});

// Get all jobs
router.get('/jobs', (req: Request, res: Response) => {
  try {
    const jobs = jobService.getAllJobs();
    
    res.json({
      success: true,
      data: jobs.map(job => ({
        id: job.id,
        status: job.status,
        currentStep: job.currentStep,
        videoCount: job.videos.length,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get jobs'
    });
  }
});

// Delete a job
router.delete('/job/:jobId', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const deleted = jobService.deleteJob(jobId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      message: 'Job deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete job'
    });
  }
});

// Get notebook by ID
router.get('/notebook/:notebookId', (req: Request, res: Response) => {
  try {
    const { notebookId } = req.params;
    const notebook = notesService.loadNotebook(notebookId);
    
    if (!notebook) {
      return res.status(404).json({
        success: false,
        error: 'Notebook not found'
      });
    }

    res.json({
      success: true,
      data: notebook
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get notebook'
    });
  }
});

// Get index by ID
router.get('/index/:indexId', (req: Request, res: Response) => {
  try {
    const { indexId } = req.params;
    const index = indexService.loadIndex(indexId);
    
    if (!index) {
      return res.status(404).json({
        success: false,
        error: 'Index not found'
      });
    }

    res.json({
      success: true,
      data: index
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get index'
    });
  }
});

// Health check for LLM
router.get('/llm/health', async (req: Request, res: Response) => {
  try {
    const healthy = await llmService.checkHealth();
    const models = healthy ? await llmService.listModels() : [];
    
    res.json({
      success: true,
      data: {
        available: healthy,
        models,
        config: llmService.getConfig()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check LLM health'
    });
  }
});

// Update LLM config
router.post('/llm/config', (req: Request, res: Response) => {
  try {
    const { model, temperature, maxTokens, baseUrl } = req.body;
    
    llmService.updateConfig({
      ...(model && { model }),
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens && { maxTokens }),
      ...(baseUrl && { baseUrl })
    });

    res.json({
      success: true,
      data: llmService.getConfig()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update LLM config'
    });
  }
});

export default router;
