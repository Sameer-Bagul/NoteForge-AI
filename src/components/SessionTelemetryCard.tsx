import { useState, useEffect } from 'react';
import { Timer, Cpu, Zap, HardDrive, Shield } from 'lucide-react';
import { ProcessingStatus } from '@/types';
import { getAIConfigForTask } from '@/services/nativePipeline';

interface SessionTelemetryCardProps {
  status: ProcessingStatus;
}

export const SessionTelemetryCard = ({ status }: SessionTelemetryCardProps) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status === 'complete' || status === 'error' || status === 'idle') return;

    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const aiConfig = getAIConfigForTask('notes');
  const isRunning = status !== 'complete' && status !== 'error' && status !== 'idle';

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4 transition-all">
      <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">
              Elapsed Time
            </span>
            <span className="text-sm font-mono font-bold text-foreground tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">
              Engine Status
            </span>
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              {status === 'complete'
                ? 'Ready'
                : status === 'awaiting-approval'
                ? 'Review'
                : status === 'error'
                ? 'Error'
                : 'Processing'}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
        <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
          <Cpu className="w-3.5 h-3.5 mx-auto mb-1 text-primary/80" />
          <span className="text-[10px] text-muted-foreground block truncate">AI Model</span>
          <span className="text-[11px] font-mono text-foreground font-medium truncate block">
            {aiConfig.model || 'Gemini Flash'}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
          <HardDrive className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-500/80" />
          <span className="text-[10px] text-muted-foreground block truncate">Storage</span>
          <span className="text-[11px] font-mono text-foreground font-medium truncate block">
            SQLite Vault
          </span>
        </div>

        <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
          <Shield className="w-3.5 h-3.5 mx-auto mb-1 text-sky-400/80" />
          <span className="text-[10px] text-muted-foreground block truncate">BYOK Key</span>
          <span className="text-[11px] font-mono text-foreground font-medium truncate block">
            OS Keychain
          </span>
        </div>
      </div>
    </div>
  );
};

