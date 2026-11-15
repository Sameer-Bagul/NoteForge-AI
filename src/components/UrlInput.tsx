import { useState } from 'react';
import { Youtube, ArrowRight, List, Play, BookOpen, Brain, Lightbulb, Sparkles, FileText, ChevronDown, ChevronUp, Clock, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ─── Creativity Level Config ───────────────────────────────────────────────────

const CREATIVITY_LEVELS = [
  {
    level: 1 as const,
    name: 'Strict',
    description: 'Pure transcript content with zero AI additions.',
    badge: 'Transcript',
  },
  {
    level: 2 as const,
    name: 'Balanced',
    description: 'Transcript grounded with concise technical clarifications.',
    badge: 'Balanced',
  },
  {
    level: 3 as const,
    name: 'Enhanced',
    description: 'Enriched with diagrams, code snippets, and structured tables.',
    badge: 'Diagrams',
  },
  {
    level: 4 as const,
    name: 'Deep Dive',
    description: 'Publication-quality synthesis with background theory & takeaways.',
    badge: 'Mastery',
  },
] as const;

type CreativityLevel = 1 | 2 | 3 | 4;

interface UrlInputProps {
  onSubmit: (url: string, userNotes?: string, creativityLevel?: CreativityLevel, generationMode?: 'topical' | 'chronological') => void;
  isLoading?: boolean;
}

const UrlInput = ({ onSubmit, isLoading }: UrlInputProps) => {
  const [url, setUrl] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [creativityLevel, setCreativityLevel] = useState<CreativityLevel>(2);
  const [generationMode, setGenerationMode] = useState<'topical' | 'chronological'>('chronological');
  const [inputType, setInputType] = useState<'video' | 'playlist' | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const detectInputType = (value: string) => {
    if (value.includes('playlist') || value.includes('list=')) {
      setInputType('playlist');
      setGenerationMode('chronological');
    } else if (value.includes('youtube.com') || value.includes('youtu.be')) {
      setInputType('video');
    } else {
      setInputType(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    detectInputType(value);
    if (value && !showAdvanced) setShowAdvanced(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim(), userNotes.trim() || undefined, creativityLevel, generationMode);
    }
  };

  const selectedLevel = CREATIVITY_LEVELS.find(l => l.level === creativityLevel)!;

  return (
    <div className="w-full max-w-xl mx-auto space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Main URL Bar */}
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Youtube className="w-4 h-4" />
          </div>
          <Input
            type="url"
            placeholder="Paste YouTube video or playlist URL..."
            value={url}
            onChange={handleChange}
            className="pl-10 pr-24 h-11 text-sm rounded-lg border border-border/60 bg-card focus-visible:ring-1 focus-visible:ring-primary shadow-none"
            disabled={isLoading}
          />
          {inputType && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-muted text-muted-foreground border border-border/40">
                {inputType === 'playlist' ? <List className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {inputType}
              </span>
            </div>
          )}
        </div>

        {/* Collapsible Options Drawer */}
        <div className="rounded-lg border border-border/50 bg-card overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              <span className="font-medium text-foreground">Synthesis Settings</span>
              <span className="text-[11px] text-muted-foreground">
                · {selectedLevel.name}
                {userNotes.trim() ? ' · With instructions' : ''}
              </span>
            </span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAdvanced && (
            <div className="p-3.5 space-y-4 border-t border-border/40 bg-muted/10">
              {/* Creativity Level: Segmented Control */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Depth & Creativity
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-muted/30 border border-border/40 rounded-lg">
                  {CREATIVITY_LEVELS.map(lvl => {
                    const isActive = creativityLevel === lvl.level;
                    return (
                      <button
                        key={lvl.level}
                        type="button"
                        onClick={() => setCreativityLevel(lvl.level)}
                        disabled={isLoading}
                        className={cn(
                          'flex flex-col items-center justify-center py-2 px-1 rounded-md text-xs transition-colors',
                          isActive
                            ? 'bg-background text-foreground font-semibold shadow-xs border border-border/50'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <span>{lvl.name}</span>
                        <span className="text-[10px] text-muted-foreground/80 mt-0.5 font-normal">
                          {lvl.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground pt-0.5">
                  {selectedLevel.description}
                </p>
              </div>

              {/* Generation Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Organization Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenerationMode('topical')}
                    className={cn(
                      'flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors',
                      generationMode === 'topical'
                        ? 'border-border bg-background shadow-xs text-foreground'
                        : 'border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Network className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-xs text-foreground">Synthesis Mode</div>
                      <div className="text-[11px] text-muted-foreground leading-snug">Thematic, concepts grouped by topic</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenerationMode('chronological')}
                    className={cn(
                      'flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors',
                      generationMode === 'chronological'
                        ? 'border-border bg-background shadow-xs text-foreground'
                        : 'border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Clock className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-xs text-foreground">Lecture Mode</div>
                      <div className="text-[11px] text-muted-foreground leading-snug">Timeline-aligned sequential chapters</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* User Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Custom Instructions
                  </label>
                  <span className="text-[10px] text-muted-foreground">Optional</span>
                </div>
                <Textarea
                  placeholder="e.g. Focus on code examples, explain architecture trade-offs, skip sponsor segments..."
                  value={userNotes}
                  onChange={e => setUserNotes(e.target.value)}
                  className="resize-none h-20 text-xs bg-background border-border/50 placeholder:text-muted-foreground/60 rounded-md"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Action */}
        <Button
          type="submit"
          className="w-full h-10 text-xs font-semibold rounded-lg gap-2 justify-center"
          disabled={!url.trim() || isLoading}
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              <span>Synthesizing...</span>
            </>
          ) : (
            <>
              <span>Generate Study Notebook</span>
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-primary-foreground/15 rounded text-primary-foreground/90">
                ↵
              </kbd>
            </>
          )}
        </Button>
      </form>
    </div>
  );
};

export default UrlInput;

