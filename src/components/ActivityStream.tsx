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
    <div className="rounded-xl border border-border/70 bg-card/60 flex flex-col h-[340px] overflow-hidden transition-all">
      {/* Header */}
      <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold tracking-tight text-foreground">Activity Stream</span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/40">
            {logs.length}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
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
              <span className="text-[11px]">Copy Log</span>
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
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 group leading-relaxed"
            >
              <span className="text-muted-foreground/60 text-[11px] tabular-nums shrink-0 select-none">
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
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 py-12 gap-2 font-sans">
            <Activity className="w-5 h-5 stroke-1" />
            <span className="text-xs">Awaiting pipeline events...</span>
          </div>
        )}
      </div>

      {/* Subtle Footer Bar */}
      <div className="px-4 py-2 bg-muted/20 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate">{logs.length > 0 ? logs[0].message : 'Pipeline ready'}</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider shrink-0 ml-2">
          {status || 'Running'}
        </span>
      </div>
    </div>
  );
};
