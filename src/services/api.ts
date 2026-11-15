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
import { PIPELINE_STEPS, nativePipeline } from './nativePipeline';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ENABLE_DEBUG = import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';

const log = (...args: any[]) => {
  if (ENABLE_DEBUG) {
    console.log('[API]', ...args);
  }
};

function getAIForTask(task: 'notes' | 'indexing' | 'features'): { provider: string; model: string; baseUrl?: string; apiKey?: string } {
  try {
    const raw = localStorage.getItem('noteforge_ai_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const assigned = parsed.taskMapping?.[task];
      let providerConfig = (assigned && assigned !== 'auto')
        ? parsed.providers?.find((p: any) => p.provider === assigned && p.enabled)
        : null;

      if (!providerConfig) {
        providerConfig = parsed.providers?.find((p: any) => p.enabled && (p.provider === 'ollama' || p.provider === 'lmstudio' || Boolean(p.apiKey?.trim())));
      }

      if (!providerConfig) {
        providerConfig = parsed.providers?.find((p: any) => p.enabled) || parsed.providers?.[0];
      }

      if (providerConfig && (providerConfig.provider === 'gemini' || providerConfig.provider === 'grok') && !providerConfig.apiKey?.trim()) {
        const ollamaCandidate = parsed.providers?.find((p: any) => p.provider === 'ollama');
        if (ollamaCandidate) {
          providerConfig = ollamaCandidate;
        }
      }

      if (providerConfig) {
        let model = (task === 'indexing' && providerConfig.indexingModel)
          ? providerConfig.indexingModel
          : (providerConfig.model || (providerConfig.provider === 'ollama' ? 'llama3.2:1b' : 'gemini-flash-lite-latest'));
        if (model === 'gemini-flash-latest' || model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash') {
          model = 'gemini-flash-lite-latest';
        }
        return {
          provider: providerConfig.provider,
          model,
          baseUrl: providerConfig.baseUrl,
          apiKey: providerConfig.apiKey,
        };
      }
    }
  } catch {}
  return { provider: 'ollama', model: 'llama3.2:1b', baseUrl: 'http://localhost:11434' };
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
        log('Tauri validateUrl error:', err);
        return { valid: false, type: 'video' };
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
    if (isTauri()) {
      return { jobId: `job-${Date.now()}`, status: 'extracting' };
    }
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
    return data.data || data;
  },

  async getJobStatus(jobId: string): Promise<JobStatus> {
    if (isTauri()) {
      const job = await tauriApi.getJob(jobId).catch(() => null);
      if (job) {
        let options: any = {};
        try { options = JSON.parse(job.options_json || '{}'); } catch {}
        const currentStep = job.current_step || 0;
        const mappedSteps: ProcessingStep[] = PIPELINE_STEPS.map((s, idx) => ({
          ...s,
          status:
            idx < currentStep
              ? 'complete'
              : idx === currentStep
              ? (job.status === 'error' ? 'error' : 'active')
              : 'pending',
          details: idx < currentStep ? 'Completed' : idx === currentStep ? s.description : undefined,
        }));

        return {
          id: job.id,
          jobId: job.id,
          notebookId: job.id,
          url: job.url,
          status: job.status as any,
          type: 'video',
          currentStep,
          steps: mappedSteps,
          videos: options.videoSources || [],
          createdAt: job.created_at,
          updatedAt: job.updated_at,
          index: options.index,
        };
      }
      const notebook = await tauriApi.getNotebook(jobId).catch(() => null);
      if (notebook) {
        let parsed: any = {};
        try { parsed = JSON.parse(notebook.content_json); } catch {}
        const mappedSteps: ProcessingStep[] = PIPELINE_STEPS.map((s) => ({
          ...s,
          status: 'complete',
          details: 'Completed',
        }));

        return {
          id: notebook.id,
          jobId: notebook.job_id || notebook.id,
          notebookId: notebook.id,
          url: parsed.url || '',
          status: 'complete',
          type: 'video',
          currentStep: PIPELINE_STEPS.length,
          steps: mappedSteps,
          videos: parsed.metadata?.sourceVideos || [],
          notebook: parsed,
          createdAt: notebook.created_at,
          updatedAt: notebook.created_at,
        };
      }
      throw new Error(`Job not found: ${jobId}`);
    }
    log('Getting job status for:', jobId);
    const response = await fetch(`${API_BASE}/process/status/${jobId}`);
    if (!response.ok) {
      console.error('API Error: Failed to get job status');
      throw new Error('Failed to get job status');
    }
    const result = await response.json();
    log('Job status response:', result);
    return result.data || result;
  },

  async exportPdf(indexId: string, theme: string = 'modern'): Promise<{ data: Blob }> {
    if (isTauri()) {
      window.print();
      return { data: new Blob() };
    }
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
    if (isTauri()) {
      return { success: true, message: 'Index approved' };
    }
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
    if (isTauri()) {
      return { success: true, message: 'Job resumed' };
    }
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
        const notebooks = await tauriApi.listNotebooks().catch(() => []);
        const jobs = await tauriApi.listJobs().catch(() => []);

        const mappedNotebooks: JobStatus[] = notebooks.map(nb => {
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

        const activeJobs: JobStatus[] = jobs
          .filter(j => {
            if (j.status === 'complete') return false;
            // Check if notebook with exact id or job_id already exists
            if (notebooks.some(nb => nb.id === j.id || nb.job_id === j.id)) return false;

            // Check if job is actively running in the in-memory pipeline session
            const isLive = nativePipeline.isJobActive(j.id);
            if (!isLive) {
              // If not active in memory, check if a newer completed notebook exists for the exact same video URL
              const hasCompletedNotebookForUrl = notebooks.some(nb => {
                try {
                  const p = JSON.parse(nb.content_json);
                  return (
                    (p.url && j.url && p.url === j.url) ||
                    p.metadata?.sourceVideos?.some((v: any) => v.id && j.url && j.url.includes(v.id))
                  );
                } catch {
                  return false;
                }
              });

              if (hasCompletedNotebookForUrl) {
                // Stale job that was already superseded by a completed notebook; prune it from SQLite
                tauriApi.deleteJob(j.id).catch(() => {});
                return false;
              }
            }
            return true;
          })
          .map(j => {
            let options: any = {};
            try { options = JSON.parse(j.options_json || '{}'); } catch {}
            const isLive = nativePipeline.isJobActive(j.id);
            const videoInfo = options.videoInfo || (options.videoSources && options.videoSources[0]) || undefined;
            return {
              id: j.id,
              jobId: j.id,
              notebookId: j.id,
              url: j.url,
              status: j.status as any,
              type: 'video' as const,
              currentStep: j.current_step,
              steps: [],
              videos: options.videoSources || (videoInfo ? [videoInfo] : []),
              videoInfo,
              index: options.index,
              createdAt: j.created_at,
              updatedAt: j.updated_at,
              isLive,
            };
          });

        return [...activeJobs, ...mappedNotebooks];
      } catch (err) {
        log('Tauri getJobs error:', err);
        return [];
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
      const record = await tauriApi.getNotebook(notebookId).catch(() => null);
      if (record && record.content_json) {
        return JSON.parse(record.content_json);
      }
      throw new Error(`Notebook not found: ${notebookId}`);
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
      const existing = await tauriApi.getNotebook(notebookId).catch(() => null);
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
      throw new Error(`Notebook not found: ${notebookId}`);
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

  async deleteNotebook(notebookId: string): Promise<void> {
    if (isTauri()) {
      await tauriApi.deleteNotebook(notebookId);
      return;
    }
    log('Deleting notebook:', notebookId);
    const response = await fetch(`${API_BASE}/process/notebook/${notebookId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete notebook');
    }
  },

  async deleteJob(jobId: string): Promise<void> {
    if (isTauri()) {
      await tauriApi.deleteJob(jobId);
      return;
    }
    log('Deleting job:', jobId);
    const response = await fetch(`${API_BASE}/process/job/${jobId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete job');
    }
  },

  async clearAllData(): Promise<void> {
    if (isTauri()) {
      await tauriApi.clearAllData();
      return;
    }
    log('Clearing all data');
    const response = await fetch(`${API_BASE}/process/clear-all`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to clear library data');
    }
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
      const ai = getAIForTask('features');
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

      const raw = await tauriApi.streamLLM(prompt, systemPrompt, ai.provider, ai.model, ai.baseUrl, () => {}, ai.apiKey);
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
      const ai = getAIForTask('features');
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

      const raw = await tauriApi.streamLLM(prompt, systemPrompt, ai.provider, ai.model, ai.baseUrl, () => {}, ai.apiKey);
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
      const ai = getAIForTask('features');
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

      const raw = await tauriApi.streamLLM(prompt, systemPrompt, ai.provider, ai.model, ai.baseUrl, () => {}, ai.apiKey);
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
