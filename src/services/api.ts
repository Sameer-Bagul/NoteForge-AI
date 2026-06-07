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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ENABLE_DEBUG = import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';

const log = (...args: any[]) => {
  if (ENABLE_DEBUG) {
    console.log('[API]', ...args);
  }
};

export const api = {
  async validateUrl(url: string): Promise<{ valid: boolean; type: string; videoId?: string }> {
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

  async getJobs(): Promise<JobStatus[]> {
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
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  },

  // ─── Settings API ──────────────────────────────────────────────────────────

  async updateSettings(settings: AppSettings): Promise<{ success: boolean }> {
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
    log('Getting settings (full)');
    const response = await fetch(`${API_BASE}/settings/full`);
    if (!response.ok) throw new Error('Failed to get settings');
    const result = await response.json();
    return result.data;
  },

  // ─── Generation API ────────────────────────────────────────────────────────

  async generateMindMap(topicTitle: string, subtopics: string[], notesContent: string): Promise<{ nodes: any[]; edges: any[] }> {
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
