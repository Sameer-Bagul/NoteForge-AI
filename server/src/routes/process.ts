import { Router, Request, Response } from 'express';
import { jobService } from '../services/job.service';
import { indexService } from '../services/index.service';
import { notesService } from '../services/notes.service';
import { llmService } from '../services/llm.service';
import { multiLlmService } from '../services/multi-llm.service';

const router = Router();

// Start a new processing job
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { url, title, userNotes, creativityLevel } = req.body;

    console.log(`\n📨 Received processing request:`);
    console.log(`   URL: ${url}`);
    console.log(`   Title: ${title || 'N/A'}`);
    console.log(`   User Notes: ${userNotes ? userNotes.slice(0, 60) + '...' : 'None'}`);
    console.log(`   Creativity Level: ${creativityLevel ?? 2}`);

    if (!url) {
      console.log(`❌ Error: URL is required`);
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Check LLM availability
    console.log(`🔍 Checking LLM availability...`);
    const llmAvailable = await multiLlmService.checkHealth();
    console.log(`   LLM Status: ${llmAvailable.healthy ? '✅ Available' : '❌ Not Available'} (${llmAvailable.provider})`);

    if (!llmAvailable.healthy) {
      return res.status(503).json({
        success: false,
        error: `No AI provider is available. ${llmAvailable.error || 'Please configure a provider in Settings.'}`
      });
    }

    const options = {
      userNotes: typeof userNotes === 'string' && userNotes.trim() ? userNotes.trim() : undefined,
      creativityLevel: [1, 2, 3, 4].includes(creativityLevel) ? creativityLevel : 2,
    };

    // Create job
    const job = jobService.createJob(url, options);
    console.log(`✅ Job created with ID: ${job.id}`);

    // Start processing in background
    console.log(`🚀 Starting background processing...`);
    jobService.processUrl(job.id, url, title).catch(err => {
      console.error(`❌ Background job ${job.id} failed:`, err);
    });

    console.log(`✅ Responding to client with job ID\n`);
    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        message: 'Processing started'
      }
    });
  } catch (error) {
    console.error(`❌ Error in /start endpoint:`, error);
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
    console.log(`📊 Status request for job: ${jobId}`);

    const job = jobService.getJob(jobId);

    if (!job) {
      console.log(`❌ Job not found: ${jobId}`);
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    console.log(`✅ Job status: ${job.status} (Step ${job.currentStep}/${job.steps.length})`);

    res.json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        currentStep: job.currentStep,
        steps: job.steps,
        videos: job.videos,
        videoInfo: job.videos.length > 0 ? job.videos[0] : undefined,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        // Include index if available (for approval)
        ...(job.index && { index: job.index }),
        // Include results if complete
        ...(job.status === 'complete' && {
          notebook: job.notebook
        })
      }
    });
  } catch (error) {
    console.error(`❌ Error getting job status:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get job status'
    });
  }
});

// Update and approve index
router.put('/:jobId/approve-index', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { index } = req.body;

    console.log(`\n📋 Index approval request for job: ${jobId}`);

    if (!index) {
      return res.status(400).json({
        success: false,
        error: 'Index is required'
      });
    }

    // Update the index if modified
    const updated = jobService.updateIndex(jobId, index);

    if (!updated) {
      return res.status(400).json({
        success: false,
        error: 'Job not found or not awaiting approval'
      });
    }

    console.log(`✅ Index updated successfully`);
    console.log(`🚀 Starting notes generation...`);

    // Continue processing in background
    jobService.continueAfterApproval(jobId).catch(err => {
      console.error(`❌ Failed to continue job ${jobId}:`, err);
    });

    res.json({
      success: true,
      message: 'Index approved, continuing with notes generation'
    });
  } catch (error) {
    console.error(`❌ Error approving index:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve index'
    });
  }
});

// Get all jobs
router.get('/jobs', (req: Request, res: Response) => {
  try {
    const activeJobs = jobService.getAllJobs();
    const allNotebooks = notesService.getAllNotebooks();

    // Create a map of notebook IDs associated with active jobs to avoid duplicates
    const activeNotebookIds = new Set(
      activeJobs
        .filter(j => j.notebook)
        .map(j => j.notebook!.id)
    );

    // Map active jobs to required format
    const jobList = activeJobs.map(job => ({
      id: job.id,
      status: job.status,
      currentStep: job.currentStep,
      steps: job.steps,
      videoCount: job.videos.length,
      videoInfo: job.videos[0], // Primary video for thumbnail
      notebook: job.notebook,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error
    }));

    // Add notebooks from disk that aren't in active jobs
    const historicalJobs = allNotebooks
      .filter(nb => !activeNotebookIds.has(nb.id))
      .map(nb => ({
        id: nb.id,
        status: 'complete' as const,
        currentStep: 5,
        videoCount: nb.metadata.totalVideos,
        videoInfo: nb.metadata.sourceVideos[0],
        notebook: nb,
        createdAt: nb.createdAt,
        updatedAt: nb.updatedAt
      }));

    // Combine and sort by date (newest first)
    const combined = [...jobList, ...historicalJobs].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({
      success: true,
      data: combined
    });
  } catch (error) {
    console.error('Failed to get jobs:', error);
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
