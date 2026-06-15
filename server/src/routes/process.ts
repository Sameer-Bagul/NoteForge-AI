import { Router } from 'express';
import { ProcessController } from '../controllers/process.controller.js';

const router = Router();

// Start a new processing job
router.post('/start', ProcessController.startJob);

// Stream job progress and note deltas via SSE
router.get('/stream/:jobId', ProcessController.streamJob);

// Get job status
router.get('/status/:jobId', ProcessController.getJobStatus);

// Update and approve index
router.put('/:jobId/approve-index', ProcessController.approveIndex);

// Resume a paused job
router.post('/:jobId/resume', ProcessController.resumeJob);

// Get all jobs
router.get('/jobs', ProcessController.listJobs);

// Delete a job
router.delete('/job/:jobId', ProcessController.deleteJob);

// Get notebook by ID
router.get('/notebook/:notebookId', ProcessController.getNotebook);

// Update notebook content (for persistent AI features)
router.patch('/notebook/:notebookId', ProcessController.updateNotebook);

// Get index by ID
router.get('/index/:indexId', ProcessController.getIndex);

// Export index and notes to PDF
router.get('/export/:indexId', ProcessController.exportPdf);

// Health check for LLM
router.get('/llm/health', ProcessController.getLlmHealth);

// Update LLM config
router.post('/llm/config', ProcessController.updateLlmConfig);

export default router;
