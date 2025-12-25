const API_BASE = 'http://localhost:3001/api';

export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
}

export interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  progress?: number;
}

export interface NoteSection {
  type: 'paragraph' | 'bullets' | 'code' | 'mermaid' | 'special' | 'heading';
  content: string;
  language?: string;
  level?: number;
}

export interface TopicNotes {
  topicId: string;
  topicTitle: string;
  sections: NoteSection[];
  keyTakeaways: string[];
  relatedTopics: string[];
}

export interface TopicNode {
  id: string;
  title: string;
  description: string;
  subtopics: { id: string; title: string; description: string }[];
  videoSources: string[];
  order: number;
}

export interface UnifiedIndex {
  id: string;
  title: string;
  description: string;
  topics: TopicNode[];
  createdAt: string;
  videoCount: number;
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  index: UnifiedIndex;
  notes: TopicNotes[];
  createdAt: string;
  wordCount: number;
  readingTime: number;
}

export interface JobStatus {
  id: string;
  status: string;
  type: 'video' | 'playlist';
  currentStep: number;
  steps: ProcessingStep[];
  videoInfo?: VideoInfo;
  error?: string;
  notebook?: Notebook;
  createdAt: string;
  updatedAt: string;
}

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

  async startProcessing(url: string): Promise<{ jobId: string; status: string }> {
    const response = await fetch(`${API_BASE}/process/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error('Failed to start processing');
    return response.json();
  },

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await fetch(`${API_BASE}/process/status/${jobId}`);
    if (!response.ok) throw new Error('Failed to get job status');
    return response.json();
  },

  async checkHealth(): Promise<{ status: string; services: { llm: string } }> {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  },
};
