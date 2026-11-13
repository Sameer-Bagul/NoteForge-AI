import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const isTauri = () =>
  typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);

export interface ValidateUrlResult {
  valid: boolean;
  video_id: string | null;
  playlist_id: string | null;
}

export interface ExtractedTranscript {
  video_id: string;
  video_info: {
    id: string;
    title: string;
    thumbnail: string;
    duration?: string;
    channel?: string;
  };
  segments: Array<{
    start: number;
    duration: number;
    text: string;
  }>;
  full_text: string;
}

export interface JobRecord {
  id: string;
  url: string;
  status: string;
  current_step: number;
  options_json?: string;
  created_at: string;
  updated_at: string;
}

export interface NotebookRecord {
  id: string;
  job_id?: string;
  title: string;
  content_json: string;
  created_at: string;
}

export const tauriApi = {
  async validateUrl(url: string): Promise<ValidateUrlResult> {
    return invoke<ValidateUrlResult>('validate_url', { url });
  },

  async fetchTranscript(videoId: string): Promise<ExtractedTranscript> {
    return invoke<ExtractedTranscript>('fetch_transcript', { videoId });
  },

  async saveApiKey(provider: string, key: string): Promise<void> {
    return invoke<void>('save_api_key', { provider, key });
  },

  async getApiKey(provider: string): Promise<string | null> {
    return invoke<string | null>('get_api_key', { provider });
  },

  async deleteApiKey(provider: string): Promise<void> {
    return invoke<void>('delete_api_key', { provider });
  },

  async listJobs(): Promise<JobRecord[]> {
    return invoke<JobRecord[]>('list_jobs');
  },

  async listNotebooks(): Promise<NotebookRecord[]> {
    return invoke<NotebookRecord[]>('list_notebooks');
  },

  async getNotebook(id: string): Promise<NotebookRecord | null> {
    return invoke<NotebookRecord | null>('get_notebook', { id });
  },

  async saveNotebook(notebook: NotebookRecord): Promise<void> {
    return invoke<void>('save_notebook', { notebook });
  },

  async streamLLM(
    prompt: string,
    systemPrompt: string | undefined,
    provider: string,
    model: string,
    baseUrl: string | undefined,
    onToken: (token: string) => void
  ): Promise<string> {
    const channel = `llm-stream-${Math.random().toString(36).substring(2, 9)}`;
    const unlisten = await listen<string>(channel, (event) => {
      onToken(event.payload);
    });

    try {
      const fullResponse = await invoke<string>('stream_llm', {
        request: {
          prompt,
          system_prompt: systemPrompt,
          provider,
          model,
          base_url: baseUrl,
        },
        eventChannel: channel,
      });
      return fullResponse;
    } finally {
      unlisten();
    }
  },
};
