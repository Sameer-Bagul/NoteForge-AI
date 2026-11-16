import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, Download, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { checkForAppUpdates, downloadAndInstallUpdate, restartApp, UpdateStatus } from '../services/updater';
import { Update } from '@tauri-apps/plugin-updater';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

export const UpdateNotification: React.FC = () => {
  const [updateObj, setUpdateObj] = useState<Update | null>(null);
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only check for updates when running inside desktop Tauri
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      // In development or regular startup, silently check in the background
      // If no release exists yet on remote (e.g. 404), fail silently without alerting the user
      checkForAppUpdates((s) => {
        if (s.state === 'available') {
          setStatus(s);
        }
      }, { silent: true }).then((up) => {
        if (up && up.available) {
          setUpdateObj(up);
          setStatus({
            state: 'available',
            version: up.version,
            notes: up.body || '',
          });
        }
      }).catch(() => {
        // Silently ignore background startup errors
      });
    }
  }, []);

  // Do not display if dismissed, idle, checking, up-to-date, or if error occurred without an active update object
  if (
    dismissed ||
    status.state === 'idle' ||
    status.state === 'checking' ||
    status.state === 'up-to-date' ||
    (status.state === 'error' && !updateObj)
  ) {
    return null;
  }

  const handleInstall = async () => {
    if (!updateObj) return;
    try {
      await downloadAndInstallUpdate(updateObj, setStatus);
    } catch (e: any) {
      setStatus({ state: 'error', error: e?.message || 'Failed to install update' });
    }
  };

  const handleRestart = async () => {
    try {
      await restartApp();
    } catch (e: any) {
      setStatus({ state: 'error', error: e?.message || 'Failed to restart' });
    }
  };

  const isError = status.state === 'error';

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-card/95 backdrop-blur-md border border-primary/30 shadow-2xl rounded-xl p-4 text-card-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isError ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
              {isError ? <AlertCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                {isError ? 'Update Download Failed' : 'NoteForge Update Available'}
                {status.version && (
                  <span className="font-mono text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                    v{status.version}
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {isError
                  ? (status.error || 'An error occurred during update installation.')
                  : (status.notes || 'A new version with performance improvements and features is ready.')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {status.state === 'downloading' && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                Downloading update...
              </span>
              <span className="font-mono font-medium">{status.progress || 0}%</span>
            </div>
            <Progress value={status.progress || 0} className="h-1.5 bg-muted" />
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-2">
          {status.state === 'available' && (
            <Button
              size="sm"
              onClick={handleInstall}
              className="h-7 text-xs px-3 gap-1.5 font-medium shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download & Install
            </Button>
          )}

          {isError && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleInstall}
              className="h-7 text-xs px-3 gap-1.5 font-medium shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Download
            </Button>
          )}

          {status.state === 'ready' && (
            <Button
              size="sm"
              onClick={handleRestart}
              className="h-7 text-xs px-3 gap-1.5 font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Restart to Apply
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

