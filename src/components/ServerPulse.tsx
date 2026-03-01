import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Cpu, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface LogEntry {
    id: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'ai';
    timestamp: string;
}

interface ServerPulseProps {
    logs: LogEntry[];
}

export const ServerPulse = ({ logs }: ServerPulseProps) => {
    return (
        <div className="glass-morphism rounded-xl overflow-hidden flex flex-col h-[300px] border border-white/5">
            <div className="bg-black/40 px-4 py-2 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-accent" />
                    <span className="text-xs font-mono font-bold tracking-wider text-muted-foreground uppercase">Server Pulse</span>
                </div>
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                </div>
            </div>

            <ScrollArea className="flex-1 p-4 bg-black/20 font-mono text-xs">
                <div className="space-y-2">
                    <AnimatePresence initial={false}>
                        {logs.map((log) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-start gap-3 group"
                            >
                                <span className="text-white/20 shrink-0 select-none">[{log.timestamp}]</span>

                                <span className="shrink-0 mt-0.5">
                                    {log.type === 'ai' && <Cpu className="w-3.5 h-3.5 text-primary animate-pulse" />}
                                    {log.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                                    {log.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                                    {log.type === 'info' && <Zap className="w-3.5 h-3.5 text-accent" />}
                                </span>

                                <span className={`
                  ${log.type === 'ai' ? 'text-primary' : ''}
                  ${log.type === 'success' ? 'text-green-400' : ''}
                  ${log.type === 'error' ? 'text-red-400 font-bold' : ''}
                  ${log.type === 'info' ? 'text-cyan-400' : ''}
                  break-words
                `}>
                                    {log.message}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {logs.length === 0 && (
                        <div className="text-white/20 flex flex-col items-center justify-center h-[200px] gap-2">
                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center animate-pulse">
                                <Terminal className="w-4 h-4" />
                            </div>
                            <p>Waiting for server pulse...</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <div className="bg-black/40 px-4 py-1.5 flex items-center border-t border-white/10 overflow-hidden">
                <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                    <span className="text-[10px] text-accent/70 font-mono">LIVE_STREAMING_ACTIVE</span>
                    <span className="text-[10px] text-white/20 font-mono ml-4 truncate">
                        {logs.length > 0 ? `LATEST: ${logs[0].message.slice(0, 40)}...` : 'IDLE'}
                    </span>
                </div>
            </div>
        </div>
    );
};
