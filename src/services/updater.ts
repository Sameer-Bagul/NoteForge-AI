import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error';
  version?: string;
  notes?: string;
  progress?: number; // 0 to 100
  error?: string;
}

export interface CheckUpdateOptions {
  silent?: boolean;
}

export async function checkForAppUpdates(
  onStatusChange?: (status: UpdateStatus) => void,
  options?: CheckUpdateOptions
): Promise<Update | null> {
  try {
    onStatusChange?.({ state: 'checking' });
    const update = await check();

    if (!update || !update.available) {
      onStatusChange?.({ state: 'up-to-date' });
      return null;
    }

    onStatusChange?.({
      state: 'available',
      version: update.version,
      notes: update.body || '',
    });
    return update;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.debug('[Updater] Check error:', errorMsg);
    if (!options?.silent) {
      onStatusChange?.({ state: 'error', error: errorMsg });
      throw err;
    } else {
      onStatusChange?.({ state: 'idle' });
      return null;
    }
  }
}

export async function downloadAndInstallUpdate(
  update: Update,
  onStatusChange?: (status: UpdateStatus) => void
): Promise<void> {
  let downloadedBytes = 0;
  let totalBytes = 0;

  onStatusChange?.({ state: 'downloading', progress: 0, version: update.version });

  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      totalBytes = event.data.contentLength || 0;
    } else if (event.event === 'Progress') {
      downloadedBytes += event.data.chunkLength;
      const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
      onStatusChange?.({ state: 'downloading', progress, version: update.version });
    } else if (event.event === 'Finished') {
      onStatusChange?.({ state: 'ready', version: update.version });
    }
  });

  onStatusChange?.({ state: 'ready', version: update.version });
}

export async function restartApp(): Promise<void> {
  await relaunch();
}

