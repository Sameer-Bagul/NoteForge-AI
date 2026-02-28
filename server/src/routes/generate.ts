import { Router, Request, Response } from 'express';
import { multiLlmService as llmService } from '../services/multi-llm.service';

const router = Router();

// ─── Mind Map ──────────────────────────────────────────────────────────────────
// Returns React Flow–compatible nodes + edges for a single topic

router.post('/mindmap', async (req: Request, res: Response) => {
    try {
        const { topicTitle, subtopics = [], description = '', notesContent = '' } = req.body;

        if (!topicTitle) {
            return res.status(400).json({ success: false, error: 'topicTitle is required' });
        }

        const systemPrompt = `You are a mind-map data generator. Produce a structured JSON mind map.
The output MUST be valid JSON only — no markdown, no commentary.

Schema:
{
  "nodes": [
    { "id": "string", "label": "string", "type": "central|branch|leaf", "color": "string (hex)" }
  ],
  "edges": [
    { "source": "string (node id)", "target": "string (node id)" }
  ]
}

Rules:
- id must be simple slug-like strings (no spaces)
- Central node id = "root"
- Branch nodes = main subtopics (max 8)
- Leaf nodes = key points under each branch (max 4 per branch)
- colors: central="#6366f1", branch="#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6"
- Use branch color from the list cycling through for each branch`;

        const prompt = `Create a mind map for the topic: "${topicTitle}"
Description: ${description}

Subtopics: ${subtopics.join(', ')}

Notes excerpt:
"""
${notesContent.slice(0, 2000)}
"""

Generate a comprehensive mind map JSON with the central topic, main branches for each subtopic, and leaf nodes for key concepts.`;

        const data = await llmService.generateJSON<{ nodes: any[]; edges: any[] }>(prompt, systemPrompt);

        res.json({ success: true, data });
    } catch (error) {
        console.error('Mind map generation error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate mind map',
        });
    }
});

// ─── Quiz ──────────────────────────────────────────────────────────────────────

router.post('/quiz', async (req: Request, res: Response) => {
    try {
        const { topicTitles = [], fullContent = '', questionCount = 10 } = req.body;

        const systemPrompt = `You are an expert quiz generator. Return ONLY valid JSON — no markdown, no commentary.

Schema:
[
  {
    "id": "q1",
    "type": "mcq" | "short",
    "question": "string",
    "options": ["A", "B", "C", "D"],   // only for mcq
    "answer": "string",
    "explanation": "string",
    "topic": "string",
    "difficulty": "easy" | "medium" | "hard"
  }
]`;

        const prompt = `Create ${questionCount} quiz questions covering these topics: ${topicTitles.join(', ')}

Content:
"""
${fullContent.slice(0, 4000)}
"""

Mix of multiple-choice (70%) and short answer (30%). Cover easy, medium, and hard difficulty. Make questions test understanding, not just recall.`;

        const data = await llmService.generateJSON<any[]>(prompt, systemPrompt);

        res.json({ success: true, data });
    } catch (error) {
        console.error('Quiz generation error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate quiz',
        });
    }
});

// ─── Interview Q&A ─────────────────────────────────────────────────────────────

router.post('/interview', async (req: Request, res: Response) => {
    try {
        const { topicTitles = [], fullContent = '' } = req.body;

        const systemPrompt = `You are an expert technical interviewer. Return ONLY valid JSON — no markdown, no commentary.

Schema:
[
  {
    "id": "i1",
    "category": "conceptual" | "technical" | "practical",
    "question": "string",
    "answer": "string",
    "followUp": "string",
    "difficulty": "junior" | "mid" | "senior",
    "topic": "string"
  }
]`;

        const prompt = `Generate 15 interview questions for a candidate who studied: ${topicTitles.join(', ')}

Content reference:
"""
${fullContent.slice(0, 4000)}
"""

Include:
- 5 conceptual questions (understanding of concepts)
- 5 technical questions (implementation, code, architecture)
- 5 practical questions (real-world scenarios, problem-solving)
Mix junior, mid, and senior level questions. Include strong follow-up questions.`;

        const data = await llmService.generateJSON<any[]>(prompt, systemPrompt);

        res.json({ success: true, data });
    } catch (error) {
        console.error('Interview generation error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate interview Q&A',
        });
    }
});

export default router;
