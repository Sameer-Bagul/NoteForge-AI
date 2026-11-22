import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const isTauri = () =>
  typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);

export interface ValidateUrlResult {
  valid: boolean;
  video_id: string | null;
  playlist_id: string | null;
}

export interface PlaylistMetadata {
  id: string;
  title: string;
  video_count: number;
  videos: Array<{
    id: string;
    title: string;
    thumbnail: string;
    duration?: string;
    channel?: string;
  }>;
}

export interface VideoChapter {
  title: string;
  start_seconds: number;
  end_seconds?: number;
  time_display: string;
}

export interface ExtractedTranscript {
  video_id: string;
  video_info: {
    id: string;
    title: string;
    thumbnail: string;
    duration?: string;
    channel?: string;
    chapters?: VideoChapter[];
  };
  segments: Array<{
    start: number;
    duration: number;
    text: string;
  }>;
  full_text: string;
  chapters?: VideoChapter[];
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

  async fetchPlaylist(playlistId: string): Promise<PlaylistMetadata> {
    return invoke<PlaylistMetadata>('fetch_playlist', { playlistId });
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

  async getJob(id: string): Promise<JobRecord | null> {
    return invoke<JobRecord | null>('get_job', { id });
  },

  async saveJob(job: JobRecord): Promise<void> {
    return invoke<void>('save_job', { job });
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

  async deleteNotebook(id: string): Promise<void> {
    return invoke<void>('delete_notebook', { id });
  },

  async deleteJob(id: string): Promise<void> {
    return invoke<void>('delete_job', { id });
  },

  async clearAllData(): Promise<void> {
    return invoke<void>('clear_all_data');
  },

  async exportNotebookFolder(basePath: string, folderName: string, files: Record<string, string>): Promise<string> {
    return invoke<string>('export_notebook_folder', { basePath, folderName, files });
  },

  async revealFolder(path: string): Promise<void> {
    return invoke<void>('reveal_folder', { path });
  },

  async pickDirectory(): Promise<string | null> {
    if (isTauri()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Destination Folder for Study Vault',
        });
        if (typeof selected === 'string') return selected;
        if (Array.isArray(selected) && typeof selected[0] === 'string') return selected[0];
        return null;
      } catch (err) {
        console.warn('Tauri open dialog error:', err);
      }
    }
    return null;
  },

  async streamLLM(
    prompt: string,
    systemPrompt: string | undefined,
    provider: string,
    model: string,
    baseUrl: string | undefined,
    onToken: (token: string) => void,
    apiKey?: string
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
          api_key: apiKey || null,
        },
        eventChannel: channel,
      });
      return fullResponse;
    } finally {
      unlisten();
    }
  },
};

