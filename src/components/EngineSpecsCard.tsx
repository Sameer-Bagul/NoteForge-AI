import { Cpu, HardDrive, ShieldCheck, Zap } from 'lucide-react';
import { getAIConfigForTask } from '@/services/nativePipeline';

export const EngineSpecsCard = () => {
  const notesConfig = getAIConfigForTask('notes');
  const providerLabel =
    notesConfig.provider === 'gemini'
      ? 'Google Gemini'
      : notesConfig.provider === 'ollama'
      ? 'Ollama (Local)'
      : notesConfig.provider === 'grok'
      ? 'xAI Grok'
      : 'LM Studio';

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <span className="font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary" />
          Runtime Environment
        </span>
        <span className="font-mono text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
          Native Core
        </span>
      </div>

      <div className="space-y-2 text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs">
            <Cpu className="w-3.5 h-3.5" />
            AI Model
          </span>
          <span className="font-mono text-[11px] text-foreground font-medium truncate max-w-[150px]">
            {notesConfig.model || providerLabel}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs">
            <HardDrive className="w-3.5 h-3.5" />
            Database
          </span>
          <span className="font-mono text-[11px] text-foreground">
            SQLite (Local Vault)
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            Key Vault
          </span>
          <span className="font-mono text-[11px] text-foreground">
            OS Keychain
          </span>
        </div>
      </div>
    </div>
  );
};
