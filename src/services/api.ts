import {
  VideoInfo,
  ProcessingStep,
  UnifiedIndex,
  Notebook,
  TopicNode,
  TopicNotes,
  NoteSection,
  JobStatus
} from '@/types';
import { AppSettings } from '@/types/settings';
import { tauriApi, isTauri } from './tauri';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ENABLE_DEBUG = import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';

const log = (...args: any[]) => {
  if (ENABLE_DEBUG) {
    console.log('[API]', ...args);
  }
};

function getActiveAI(): { provider: string; model: string; baseUrl?: string } {
  try {
    const raw = localStorage.getItem('noteforge_ai_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const active = parsed.providers?.find((p: any) => p.enabled) || parsed.providers?.[0];
      if (active) {
        return {
          provider: active.provider,
          model: active.model || 'gemini-flash-latest',
          baseUrl: active.baseUrl,
        };
      }
    }
  } catch {}
  return { provider: 'gemini', model: 'gemini-flash-latest' };
}

export const api = {
  async validateUrl(url: string): Promise<{ valid: boolean; type: string; videoId?: string }> {
    if (isTauri()) {
      try {
        const res = await tauriApi.validateUrl(url);
        return {
          valid: res.valid,
          type: res.playlist_id ? 'playlist' : 'video',
          videoId: res.video_id || undefined,
        };
      } catch (err) {
        log('Tauri validateUrl fallback:', err);
      }
    }
    const response = await fetch(`${API_BASE}/youtube/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error('Invalid URL');
    return response.json();
  },

  async startProcessing(url: string, userNotes?: string, creativityLevel?: number, generationMode?: 'topical' | 'chronological'): Promise<{ jobId: string; status: string }> {
    log('Starting processing for:', url);
    const response = await fetch(`${API_BASE}/process/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, userNotes, creativityLevel, generationMode }),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', error);
      throw new Error('Failed to start processing');
    }
    const data = await response.json();
    log('Response:', data);
    // Backend returns {success: true, data: {jobId, status}}
    return data.data || data;
  },

  async getJobStatus(jobId: string): Promise<JobStatus> {
    log('Getting job status for:', jobId);
    const response = await fetch(`${API_BASE}/process/status/${jobId}`);
    if (!response.ok) {
      console.error('API Error: Failed to get job status');
      throw new Error('Failed to get job status');
    }
    const result = await response.json();
    log('Job status response:', result);
    // Backend returns {success: true, data: {...}}
    return result.data || result;
  },

  async exportPdf(indexId: string, theme: string = 'modern'): Promise<{ data: Blob }> {
    log('Exporting PDF for index:', indexId, 'with theme:', theme);
    const response = await fetch(`${API_BASE}/process/export/${indexId}?theme=${theme}`);
    if (!response.ok) {
      console.error('API Error: Failed to export PDF');
      throw new Error('Failed to export PDF');
    }
    const blob = await response.blob();
    return { data: blob };
  },

  async approveIndex(jobId: string, index: any): Promise<{ success: boolean; message: string }> {
    log('Approving index for job:', jobId);
    const response = await fetch(`${API_BASE}/process/${jobId}/approve-index`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', error);
      throw new Error('Failed to approve index');
    }
    const data = await response.json();
    log('Approve response:', data);
    return data;
  },

  async resumeJob(jobId: string): Promise<{ success: boolean; message: string }> {
    log('Resuming job:', jobId);
    const response = await fetch(`${API_BASE}/process/${jobId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', error);
      throw new Error('Failed to resume job');
    }
    const data = await response.json();
    log('Resume response:', data);
    return data;
  },

  async getJobs(): Promise<JobStatus[]> {
    if (isTauri()) {
      try {
        const notebooks = await tauriApi.listNotebooks();
        if (notebooks.length > 0) {
          return notebooks.map(nb => {
            let parsed: any = {};
            try { parsed = JSON.parse(nb.content_json); } catch {}
            return {
              id: nb.id,
              jobId: nb.job_id || nb.id,
              notebookId: nb.id,
              url: parsed.url || '',
              status: 'complete' as const,
              type: ((parsed.metadata?.totalVideos || 0) > 1 ? 'playlist' : 'video') as 'video' | 'playlist',
              currentStep: 5,
              steps: [],
              videos: parsed.metadata?.sourceVideos || [{ id: parsed.videoId || '', title: nb.title }],
              notebook: parsed,
              createdAt: nb.created_at,
              updatedAt: nb.created_at,
            };
          });
        }
      } catch (err) {
        log('Tauri getJobs fallback:', err);
      }
    }
    log('Getting all jobs');
    const response = await fetch(`${API_BASE}/process/jobs`);
    if (!response.ok) {
      console.error('API Error: Failed to get jobs');
      throw new Error('Failed to get jobs');
    }
    const result = await response.json();
    return result.data || [];
  },

  async getNotebook(notebookId: string): Promise<Notebook> {
    if (isTauri()) {
      try {
        const record = await tauriApi.getNotebook(notebookId);
        if (record && record.content_json) {
          return JSON.parse(record.content_json);
        }
      } catch (err) {
        log('Tauri getNotebook fallback:', err);
      }
    }
    log('Getting notebook:', notebookId);
    const response = await fetch(`${API_BASE}/process/notebook/${notebookId}`);
    if (!response.ok) {
      console.error('API Error: Failed to get notebook');
      throw new Error('Failed to get notebook');
    }
    const result = await response.json();
    return result.data;
  },

  async updateNotebook(notebookId: string, updates: Partial<Notebook>): Promise<Notebook> {
    if (isTauri()) {
      try {
        const existing = await tauriApi.getNotebook(notebookId);
        if (existing) {
          const parsed = JSON.parse(existing.content_json);
          const updated = { ...parsed, ...updates, updatedAt: new Date().toISOString() };
          await tauriApi.saveNotebook({
            id: notebookId,
            job_id: existing.job_id,
            title: updated.title || existing.title,
            content_json: JSON.stringify(updated),
            created_at: existing.created_at,
          });
          return updated;
        }
      } catch (err) {
        log('Tauri updateNotebook fallback:', err);
      }
    }

    log('Updating notebook:', notebookId);
    const response = await fetch(`${API_BASE}/process/notebook/${notebookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', error);
      throw new Error('Failed to update notebook');
    }
    const result = await response.json();
    return result.data;
  },

  async checkHealth(): Promise<{ status: string; services: { llm: string; activeProvider?: string } }> {
    if (isTauri()) {
      return {
        status: 'ok',
        services: {
          llm: 'ready (Rust Native)',
          activeProvider: 'Tauri Core (SQLite + Keychain)',
        },
      };
    }
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  },

  // ─── Settings API ──────────────────────────────────────────────────────────

  async updateSettings(settings: AppSettings): Promise<{ success: boolean }> {
    if (isTauri()) {
      return { success: true };
    }
    log('Updating settings');
    const response = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to update settings');
    return response.json();
  },

  async getSettings(): Promise<AppSettings> {
    log('Getting settings');
    const response = await fetch(`${API_BASE}/settings`);
    if (!response.ok) throw new Error('Failed to get settings');
    const result = await response.json();
    return result.data;
  },

  // ─── Generation API ────────────────────────────────────────────────────────

  async generateMindMap(topicTitle: string, subtopics: string[], notesContent: string): Promise<{ nodes: any[]; edges: any[] }> {
    if (isTauri()) {
      const ai = getActiveAI();
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
- colors: central="#6366f1", branch="#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6"`;

      const prompt = `Create a mind map for topic: "${topicTitle}"
Subtopics: ${subtopics.join(', ')}
Notes excerpt:
"""
${notesContent.slice(0, 3000)}
"""`;

      const raw = await tauriApi.streamLLM(prompt, systemPrompt, ai.provider, ai.model, ai.baseUrl, () => {});
      let clean = raw.trim();
      if (clean.startsWith('```json')) clean = clean.slice(7);
      if (clean.startsWith('```')) clean = clean.slice(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);
      return JSON.parse(clean.trim());
    }

    const response = await fetch(`${API_BASE}/generate/mindmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicTitle, subtopics, notesContent }),
    });
    if (!response.ok) throw new Error('Mind map generation failed');
    const result = await response.json();
    return result.data;
  },

  async generateQuiz(topicTitles: string[], fullContent: string): Promise<any[]> {
    if (isTauri()) {
      const ai = getActiveAI();
      const systemPrompt = `You are an expert quiz generator. Return ONLY valid JSON array — no markdown fences.
Schema:
[
  {
    "id": "q1",
    "type": "mcq",
    "question": "string",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Option A",
    "explanation": "Why this answer is correct",
    "topic": "string",
    "difficulty": "easy" | "medium" | "hard"
  }
]`;

      const prompt = `Create 10 quiz questions covering: ${topicTitles.join(', ')}
Content:
"""
${fullContent.slice(0, 4000)}
"""`;

      const raw = await tauriApi.streamLLM(prompt, systemPrompt, ai.provider, ai.model, ai.baseUrl, () => {});
      let clean = raw.trim();
      if (clean.startsWith('```json')) clean = clean.slice(7);
      if (clean.startsWith('```')) clean = clean.slice(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);
      return JSON.parse(clean.trim());
    }

    const response = await fetch(`${API_BASE}/generate/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicTitles, fullContent }),
    });
    if (!response.ok) throw new Error('Quiz generation failed');
    const result = await response.json();
    return result.data;
  },

  async generateInterview(topicTitles: string[], fullContent: string): Promise<any[]> {
    if (isTauri()) {
      const ai = getActiveAI();
      const systemPrompt = `You are an expert technical interviewer. Return ONLY valid JSON array — no markdown fences.
Schema:
[
  {
    "id": "i1",
    "category": "conceptual" | "technical" | "practical",
    "question": "string",
    "answer": "Detailed answer",
    "followUp": "Follow-up probing question",
    "difficulty": "junior" | "mid" | "senior",
    "topic": "string"
  }
]`;

      const prompt = `Generate 12 interview questions for a candidate who studied: ${topicTitles.join(', ')}
Content reference:
"""
${fullContent.slice(0, 4000)}
"""`;

      const raw = await tauriApi.streamLLM(prompt, systemPrompt, ai.provider, ai.model, ai.baseUrl, () => {});
      let clean = raw.trim();
      if (clean.startsWith('```json')) clean = clean.slice(7);
      if (clean.startsWith('```')) clean = clean.slice(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);
      return JSON.parse(clean.trim());
    }

    const response = await fetch(`${API_BASE}/generate/interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicTitles, fullContent }),
    });
    if (!response.ok) throw new Error('Interview Q&A generation failed');
    const result = await response.json();
    return result.data;
  },
};
