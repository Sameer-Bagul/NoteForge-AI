import { v4 as uuidv4 } from 'uuid';
import {
  ProcessingJob,
  ProcessingStep,
  ProcessingStatus,
  VideoTranscript,
  UnifiedIndex,
  Notebook
} from '../types';
import { transcriptService } from './transcript.service';
import { indexService } from './index.service';
import { notesService } from './notes.service';
import { isPlaylistUrl, extractVideoId } from '../utils/youtube';

// In-memory job storage (use Redis for production)
const jobs = new Map<string, ProcessingJob>();

const PROCESSING_STEPS: Omit<ProcessingStep, 'status'>[] = [
  { id: 'extract', label: 'Extracting Transcripts', description: 'Fetching video transcripts from YouTube' },
  { id: 'analyze', label: 'Analyzing Content', description: 'Analyzing transcript content and structure' },
  { id: 'index', label: 'Generating Index', description: 'Creating unified topic index' },
  { id: 'notes', label: 'Generating Notes', description: 'Writing detailed notes for each topic' },
  { id: 'assemble', label: 'Assembling Notebook', description: 'Compiling final notebook' }
];

export class JobService {

  // Create a new processing job
  createJob(url: string): ProcessingJob {
    const job: ProcessingJob = {
      id: uuidv4(),
      status: 'idle',
      steps: PROCESSING_STEPS.map(step => ({ ...step, status: 'pending' as const })),
      currentStep: 0,
      videos: [],
      transcripts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    jobs.set(job.id, job);
    return job;
  }

  // Get job by ID
  getJob(jobId: string): ProcessingJob | null {
    return jobs.get(jobId) || null;
  }

  // Update job status
  private updateJob(jobId: string, updates: Partial<ProcessingJob>): void {
    const job = jobs.get(jobId);
    if (job) {
      Object.assign(job, updates, { updatedAt: new Date().toISOString() });
      jobs.set(jobId, job);
    }
  }

  // Update step status
  public updateStep(
    jobId: string,
    stepIndex: number,
    status: 'pending' | 'active' | 'complete' | 'error',
    details?: string,
    metadata?: ProcessingStep['metadata']
  ): void {
    const job = jobs.get(jobId);
    if (job && job.steps[stepIndex]) {
      job.steps[stepIndex].status = status;
      if (details) {
        job.steps[stepIndex].details = details;
      }
      if (metadata) {
        job.steps[stepIndex].metadata = {
          ...job.steps[stepIndex].metadata,
          ...metadata
        };
      }
      job.updatedAt = new Date().toISOString();
      jobs.set(jobId, job);
    }
  }

  // Process a URL (video or playlist)
  async processUrl(jobId: string, url: string, title?: string): Promise<void> {
    console.log(`\n🚀 Starting job ${jobId} for URL: ${url}`);
    const job = this.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    try {
      // Step 1: Extract transcripts
      console.log(`📝 Step 1: Extracting transcripts...`);
      this.updateStep(jobId, 0, 'active');
      this.updateJob(jobId, { status: 'extracting-transcripts', currentStep: 0 });

      let transcripts: VideoTranscript[];

      if (isPlaylistUrl(url)) {
        const { playlist, transcripts: playlistTranscripts } = await transcriptService.fetchPlaylist(url, (progress) => {
          this.updateStep(jobId, 0, 'active', undefined, progress);
        });
        transcripts = playlistTranscripts;
        title = title || playlist.title;
        this.updateJob(jobId, {
          videos: playlist.videos
        });
      } else {
        const videoId = extractVideoId(url);
        if (!videoId) {
          throw new Error('Invalid YouTube URL');
        }
        const transcript = await transcriptService.fetchTranscript(videoId);
        transcripts = [transcript];
        title = title || transcript.videoInfo.title;
        this.updateJob(jobId, {
          videos: [transcript.videoInfo]
        });
      }

      this.updateJob(jobId, { transcripts });
      this.updateStep(jobId, 0, 'complete', `Extracted ${transcripts.length} transcript(s)`);
      console.log(`✅ Step 1 complete: Extracted ${transcripts.length} transcript(s)`);

      // Step 2: Analyze content
      console.log(`🔍 Step 2: Analyzing content...`);
      this.updateStep(jobId, 1, 'active');
      this.updateJob(jobId, { status: 'analyzing-content', currentStep: 1 });

      // Brief analysis delay (content analysis happens as part of indexing)
      await this.delay(1000);
      this.updateStep(jobId, 1, 'complete', 'Content analysis complete');
      console.log(`✅ Step 2 complete: Content analyzed`);

      // Step 3: Generate unified index
      console.log(`📚 Step 3: Generating unified index...`);
      this.updateStep(jobId, 2, 'active');
      this.updateJob(jobId, { status: 'generating-index', currentStep: 2 });

      const index = await indexService.generateUnifiedIndex(transcripts, title || 'Untitled');
      this.updateJob(jobId, { index });
      this.updateStep(jobId, 2, 'complete', `Generated index with ${index.topicCount} topics`);
      console.log(`✅ Step 3 complete: Generated index with ${index.topicCount} topics`);

      // PAUSE HERE - Wait for user approval
      console.log(`⏸️  Pausing for user approval of index...`);
      this.updateJob(jobId, { status: 'awaiting-approval', currentStep: 3 });
      console.log(`📋 Index ready for review. Waiting for approval via /api/process/${jobId}/approve-index`);

      // Processing will continue when continueAfterApproval() is called
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);

      const currentStep = job.currentStep;
      this.updateStep(jobId, currentStep, 'error', error instanceof Error ? error.message : 'Unknown error');
      this.updateJob(jobId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get all jobs (for admin/debugging)
  getAllJobs(): ProcessingJob[] {
    return Array.from(jobs.values());
  }

  // Delete a job
  deleteJob(jobId: string): boolean {
    return jobs.delete(jobId);
  }

  // Update index after user modifications
  updateIndex(jobId: string, updatedIndex: UnifiedIndex): boolean {
    const job = jobs.get(jobId);
    if (!job || job.status !== 'awaiting-approval') {
      return false;
    }

    console.log(`📝 Updating index for job ${jobId}`);
    console.log(`   Topics: ${updatedIndex.topicCount}`);

    this.updateJob(jobId, { index: updatedIndex });
    return true;
  }

  // Continue processing after index approval
  async continueAfterApproval(jobId: string): Promise<void> {
    const job = this.getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'awaiting-approval') {
      throw new Error(`Job is not awaiting approval (current status: ${job.status})`);
    }

    if (!job.index || !job.transcripts) {
      throw new Error('Job missing index or transcripts');
    }

    console.log(`\n✅ Index approved for job ${jobId}`);
    console.log(`📝 Continuing with notes generation...`);

    const { index, transcripts } = job;
    const title = index.title;

    try {
      // Step 4: Generate notes for each topic
      console.log(`📝 Step 4: Generating notes for ${index.topicCount} topics...`);
      this.updateStep(jobId, 3, 'active');
      this.updateJob(jobId, { status: 'generating-notes', currentStep: 3 });

      const allNotes = await notesService.generateAllNotes(index, transcripts, (progress) => {
        this.updateStep(jobId, 3, 'active', undefined, progress);
      });
      this.updateStep(jobId, 3, 'complete', `Generated notes for ${allNotes.length} topics`);
      console.log(`✅ Step 4 complete: Generated notes for ${allNotes.length} topics`);

      // Step 5: Assemble notebook
      console.log(`📖 Step 5: Assembling notebook...`);
      this.updateStep(jobId, 4, 'active');
      this.updateJob(jobId, { status: 'assembling-notebook', currentStep: 4 });

      const notebook = await notesService.assembleNotebook(
        title || 'Untitled Notebook',
        index,
        allNotes,
        transcripts
      );

      this.updateJob(jobId, {
        notebook,
        status: 'complete',
        currentStep: 5
      });
      this.updateStep(jobId, 4, 'complete', 'Notebook assembled successfully');
      console.log(`✅ Step 5 complete: Notebook assembled`);

      console.log(`\n🎉 Job ${jobId} completed successfully!\n`);

    } catch (error) {
      console.error(`Job ${jobId} continuation failed:`, error);

      const currentStep = job.currentStep;
      this.updateStep(jobId, currentStep, 'error', error instanceof Error ? error.message : 'Unknown error');
      this.updateJob(jobId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const jobService = new JobService();
