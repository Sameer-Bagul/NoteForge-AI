import { Router } from 'express';
import { GenerateController } from '../controllers/generate.controller.js';

const router = Router();

// ─── Mind Map ──────────────────────────────────────────────────────────────────
// Returns React Flow–compatible nodes + edges for a single topic
router.post('/mindmap', GenerateController.generateMindMap);

// ─── Quiz ──────────────────────────────────────────────────────────────────────
router.post('/quiz', GenerateController.generateQuiz);

// ─── Interview Q&A ─────────────────────────────────────────────────────────────
router.post('/interview', GenerateController.generateInterview);

export default router;
