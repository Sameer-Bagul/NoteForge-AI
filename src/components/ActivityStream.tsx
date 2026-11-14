import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, AlertCircle, Info, Copy, Check, Activity } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';

export interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'ai';
  timestamp: string;
}

interface ActivityStreamProps {
  logs: LogEntry[];
  status?: string;
}

export const ActivityStream = ({ logs, status }: ActivityStreamProps) => {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs on new entry
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'ai':
        return <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />;
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 flex flex-col h-[220px] overflow-hidden transition-all">
      {/* Header */}
      <div className="px-4 py-2 bg-muted/40 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold tracking-tight text-foreground">Pipeline Events</span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded border border-border/40">
            {logs.length}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          disabled={logs.length === 0}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-[11px] text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </Button>
      </div>

      {/* Log list */}
      <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-2 font-mono text-xs">
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 group leading-relaxed"
            >
              <span className="text-muted-foreground/60 text-[10px] tabular-nums shrink-0 select-none">
                [{log.timestamp}]
              </span>

              {getLogIcon(log.type)}

              <span
                className={`text-xs break-words ${
                  log.type === 'ai'
                    ? 'text-foreground/90 font-sans'
                    : log.type === 'success'
                    ? 'text-emerald-400 font-sans'
                    : log.type === 'error'
                    ? 'text-rose-400 font-sans font-medium'
                    : 'text-muted-foreground font-sans'
                }`}
              >
                {log.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {logs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 py-6 gap-1.5 font-sans">
            <Activity className="w-4 h-4 stroke-1 animate-pulse" />
            <span className="text-xs">Processing video stream in background...</span>
          </div>
        )}
      </div>
    </div>
  );
};

