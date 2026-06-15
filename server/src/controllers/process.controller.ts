import { Request, Response } from 'express';
import { jobService } from '../services/job.service.js';
import { indexService } from '../services/index.service.js';
import { notesService } from '../services/notes.service.js';
import { llmService } from '../services/llm.service.js';
import { multiLlmService } from '../services/multi-llm.service.js';
import { SSEStream } from '../utils/sse.js';
import { pdfService } from '../services/pdf.service.js';

export class ProcessController {
  static async startJob(req: Request, res: Response) {
    try {
      const { url, title, userNotes, creativityLevel, generationMode } = req.body;

      console.log(`\n📨 Received processing request:`);
      console.log(`   URL: ${url}`);
      console.log(`   Title: ${title || 'N/A'}`);
      console.log(`   User Notes: ${userNotes ? userNotes.slice(0, 60) + '...' : 'None'}`);
      console.log(`   Creativity Level: ${creativityLevel ?? 2}`);
      console.log(`   Generation Mode: ${generationMode || 'topical'}`);

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
        generationMode: (generationMode === 'chronological' ? 'chronological' : 'topical') as 'topical' | 'chronological',
      };

      // Create job
      const job = jobService.createJob(url, options);
      console.log(`✅ Job created with ID: ${job.id}`);

      // Start processing in background
      console.log(`🚀 Starting background processing...`);
      jobService.processUrl(job.id, url, title).catch((err: Error) => {
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
  }

  static streamJob(req: Request, res: Response) {
    const { jobId } = req.params as { jobId: string };
    const job = jobService.getJob(jobId);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    console.log(`[SSE] Client connected for job ${jobId}`);
    const sse = new SSEStream(res);

    // Send current state immediately
    sse.sendEvent('job:update', job);

    // Listen for job updates
    const updateHandler = (updatedJob: any) => {
      sse.sendEvent('job:update', updatedJob);
    };

    // Listen for note deltas
    const deltaHandler = (data: { topicId: string, delta: string }) => {
      sse.sendEvent('note:delta', data);
    };

    const cleanup = () => {
      console.log(`[SSE] Client disconnected for job ${jobId}`);
      jobService.removeListener(`job:update:${jobId}`, updateHandler);
      jobService.removeListener(`note:delta:${jobId}`, deltaHandler);
    };

    jobService.on(`job:update:${jobId}`, updateHandler);
    jobService.on(`note:delta:${jobId}`, deltaHandler);

    req.on('close', cleanup);
  }

  static getJobStatus(req: Request, res: Response) {
    try {
      const { jobId } = req.params as { jobId: string };
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
          ...(job.index && { index: job.index }),
          ...(job.status === 'complete' && { notebook: job.notebook })
        }
      });
    } catch (error) {
      console.error(`❌ Error getting job status:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job status'
      });
    }
  }

  static async approveIndex(req: Request, res: Response) {
    try {
      const { jobId } = req.params as { jobId: string };
      const { index } = req.body;

      console.log(`\n📋 Index approval request for job: ${jobId}`);

      if (!index) {
        return res.status(400).json({
          success: false,
          error: 'Index is required'
        });
      }

      const updated = jobService.updateIndex(jobId, index);

      if (!updated) {
        return res.status(400).json({
          success: false,
          error: 'Job not found or not awaiting approval'
        });
      }

      console.log(`✅ Index updated successfully`);
      console.log(`🚀 Starting notes generation...`);

      jobService.continueAfterApproval(jobId).catch((err: Error) => {
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
  }

  static async resumeJob(req: Request, res: Response) {
    try {
      const { jobId } = req.params as { jobId: string };
      console.log(`\n▶️ Resume request for job: ${jobId}`);

      const job = jobService.getJob(jobId);
      if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      if (job.status !== 'paused-rate-limit') {
        return res.status(400).json({ success: false, error: `Job cannot be resumed from status: ${job.status}` });
      }

      // Start resume in background
      jobService.resumeJob(jobId).catch((err: Error) => {
        console.error(`❌ Failed to resume job ${jobId}:`, err);
      });

      res.json({
        success: true,
        message: 'Job resumed successfully'
      });
    } catch (error) {
      console.error(`❌ Error resuming job:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume job'
      });
    }
  }

  static listJobs(req: Request, res: Response) {
    try {
      const activeJobs = jobService.getAllJobs();
      const allNotebooks = notesService.getAllNotebooks();

      const activeNotebookIds = new Set(
        activeJobs.filter((j: any) => j.notebook).map((j: any) => j.notebook!.id)
      );

      const jobList = activeJobs.map((job: any) => ({
        id: job.id,
        status: job.status,
        currentStep: job.currentStep,
        steps: job.steps,
        videoCount: job.videos.length,
        videoInfo: job.videos[0],
        notebook: job.notebook,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        error: job.error
      }));

      const historicalJobs = allNotebooks
        .filter((nb: any) => !activeNotebookIds.has(nb.id))
        .map((nb: any) => ({
          id: nb.id,
          status: 'complete' as const,
          currentStep: 5,
          videoCount: nb.metadata.totalVideos,
          videoInfo: nb.metadata.sourceVideos[0],
          notebook: nb,
          createdAt: nb.createdAt,
          updatedAt: nb.updatedAt
        }));

      const combined = [...jobList, ...historicalJobs].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json({ success: true, data: combined });
    } catch (error) {
      console.error('Failed to get jobs:', error);
      res.status(500).json({ success: false, error: 'Failed to get jobs' });
    }
  }

  static deleteJob(req: Request, res: Response) {
    try {
      const { jobId } = req.params as { jobId: string };
      const deleted = jobService.deleteJob(jobId);

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      res.json({ success: true, message: 'Job deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to delete job' });
    }
  }

  static getNotebook(req: Request, res: Response) {
    try {
      const { notebookId } = req.params as { notebookId: string };
      const notebook = notesService.loadNotebook(notebookId);

      if (!notebook) {
        return res.status(404).json({ success: false, error: 'Notebook not found' });
      }

      res.json({ success: true, data: notebook });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get notebook' });
    }
  }

  static updateNotebook(req: Request, res: Response) {
    try {
      const { notebookId } = req.params as { notebookId: string };
      const updates = req.body;

      console.log(`📝 Update request for notebook: ${notebookId}`);
      const updated = notesService.updateNotebook(notebookId, updates);

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error(`❌ Error updating notebook:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update notebook'
      });
    }
  }

  static async exportPdf(req: Request, res: Response) {
    try {
      const { indexId } = req.params as { indexId: string };
      console.log(`\n📄 PDF Export request for index: ${indexId}`);

      const notebook = notesService.loadNotebook(indexId);
      if (!notebook) {
        return res.status(404).json({ success: false, error: 'Notebook not found' });
      }

      const index = notebook.index;

      const notesList = [];
      for (const chapter of notebook.chapters) {
        if (chapter.topics && Array.isArray(chapter.topics)) {
          notesList.push(...chapter.topics);
        }
      }

      if (notesList.length === 0) {
        return res.status(404).json({ success: false, error: 'No notes found for this index' });
      }

      const theme = (req.query.theme as string) || 'modern';
      const pdfBuffer = await pdfService.generatePDF(index, notesList, theme);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${index.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Notes.pdf"`);
      res.send(pdfBuffer);
      
      console.log(`✅ PDF generated and sent successfully`);
    } catch (error) {
      console.error(`❌ Error generating PDF:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate PDF'
      });
    }
  }

  static getIndex(req: Request, res: Response) {
    try {
      const { indexId } = req.params as { indexId: string };
      const index = indexService.loadIndex(indexId);

      if (!index) {
        return res.status(404).json({ success: false, error: 'Index not found' });
      }

      res.json({ success: true, data: index });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get index' });
    }
  }

  static async getLlmHealth(req: Request, res: Response) {
    try {
      const healthy = await llmService.checkHealth();
      const models = healthy ? await llmService.listModels() : [];

      res.json({
        success: true,
        data: { available: healthy, models, config: llmService.getConfig() }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to check LLM health' });
    }
  }

  static updateLlmConfig(req: Request, res: Response) {
    try {
      const { model, temperature, maxTokens, baseUrl } = req.body;

      llmService.updateConfig({
        ...(model && { model }),
        ...(temperature !== undefined && { temperature }),
        ...(maxTokens && { maxTokens }),
        ...(baseUrl && { baseUrl })
      });

      res.json({ success: true, data: llmService.getConfig() });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to update LLM config' });
    }
  }
}
