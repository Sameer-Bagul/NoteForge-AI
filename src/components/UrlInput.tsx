import { useState } from 'react';
import { Youtube, ArrowRight, List, Play, Brain, Lightbulb, BookOpen, Wand2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ─── Creativity Level Config ───────────────────────────────────────────────────

const CREATIVITY_LEVELS = [
  {
    level: 1 as const,
    name: 'Strict',
    icon: BookOpen,
    description: 'Only what\'s in the video. Pure transcript content, no AI additions.',
    color: 'border-blue-500/40 bg-blue-500/5 text-blue-400',
    activeColor: 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/30',
    badge: 'Transcript only',
  },
  {
    level: 2 as const,
    name: 'Balanced',
    icon: Brain,
    description: 'Transcript content with brief clarifications on unclear terms.',
    color: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400',
    activeColor: 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/30',
    badge: 'Recommended',
  },
  {
    level: 3 as const,
    name: 'Enhanced',
    icon: Lightbulb,
    description: 'Transcript + related concepts, examples, and diagrams for deeper understanding.',
    color: 'border-amber-500/40 bg-amber-500/5 text-amber-400',
    activeColor: 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/30',
    badge: 'More content',
  },
  {
    level: 4 as const,
    name: 'Creative',
    icon: Wand2,
    description: 'Deep dives, background theory, real-world applications, and advanced insights.',
    color: 'border-purple-500/40 bg-purple-500/5 text-purple-400',
    activeColor: 'border-purple-500 bg-purple-500/15 ring-2 ring-purple-500/30',
    badge: 'AI enriched',
  },
] as const;

type CreativityLevel = 1 | 2 | 3 | 4;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface UrlInputProps {
  onSubmit: (url: string, userNotes?: string, creativityLevel?: CreativityLevel) => void;
  isLoading?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const UrlInput = ({ onSubmit, isLoading }: UrlInputProps) => {
  const [url, setUrl] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [creativityLevel, setCreativityLevel] = useState<CreativityLevel>(2);
  const [inputType, setInputType] = useState<'video' | 'playlist' | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const detectInputType = (value: string) => {
    if (value.includes('playlist') || value.includes('list=')) {
      setInputType('playlist');
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
      onSubmit(url.trim(), userNotes.trim() || undefined, creativityLevel);
    }
  };

  const selectedLevel = CREATIVITY_LEVELS.find(l => l.level === creativityLevel)!;

  return (
    <div className="w-full max-w-2xl mx-auto slide-up">
      {/* Hero text */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full text-accent-foreground text-sm font-medium mb-6">
          <Brain className="w-4 h-4" />
          Transform videos into structured knowledge
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Turn YouTube into
          <span className="gradient-text block">Beautiful Notes</span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Paste any YouTube video or playlist URL and get organized, topic-wise notes ready to study.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* URL Input */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Youtube className="w-5 h-5" />
          </div>
          <Input
            type="url"
            placeholder="Paste YouTube video or playlist URL..."
            value={url}
            onChange={handleChange}
            className="pl-12 pr-4 h-14 text-base rounded-xl border-2 focus:border-primary bg-card shadow-sm"
            disabled={isLoading}
          />
          {inputType && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${inputType === 'playlist'
                ? 'bg-accent text-accent-foreground'
                : 'bg-secondary text-secondary-foreground'
                }`}>
                {inputType === 'playlist' ? (
                  <><List className="w-3 h-3" />Playlist</>
                ) : (
                  <><Play className="w-3 h-3" />Video</>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Advanced Options — collapsible */}
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="font-medium">Advanced Options</span>
              <span className="text-xs text-muted-foreground/60 ml-1">
                · {selectedLevel.name} mode
                {userNotes.trim() ? ' · Notes added' : ''}
              </span>
            </span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="px-4 pb-4 space-y-5 border-t border-border/40">
              {/* User Notes */}
              <div className="space-y-2 pt-4">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Notes for AI
                  <span className="text-xs text-muted-foreground font-normal ml-1">optional</span>
                </label>
                <Textarea
                  placeholder={`Give the AI extra context or instructions, e.g.:\n• "Focus on practical examples"\n• "Target audience: beginners. Explain all jargon"\n• "I already know Python basics, skip intro"`}
                  value={userNotes}
                  onChange={e => setUserNotes(e.target.value)}
                  className="resize-none h-24 text-sm bg-background/50 border-border/60 focus-visible:ring-primary/50 placeholder:text-muted-foreground/50"
                  disabled={isLoading}
                />
              </div>

              {/* Creativity Level */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" />
                  AI Creativity Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CREATIVITY_LEVELS.map(lvl => {
                    const Icon = lvl.icon;
                    const isActive = creativityLevel === lvl.level;
                    return (
                      <button
                        key={lvl.level}
                        type="button"
                        onClick={() => setCreativityLevel(lvl.level)}
                        disabled={isLoading}
                        className={cn(
                          'relative flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-all duration-150',
                          isActive ? lvl.activeColor : `${lvl.color} hover:opacity-80`,
                        )}
                      >
                        {/* Badge */}
                        {lvl.badge && (
                          <span className={cn(
                            'absolute top-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                            isActive ? 'bg-foreground/15 text-foreground' : 'bg-muted text-muted-foreground',
                          )}>
                            {lvl.badge}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="font-semibold text-sm text-foreground">{lvl.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug pr-8">{lvl.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <Button
          type="submit"
          size="xl"
          variant="hero"
          className="w-full"
          disabled={!url.trim() || isLoading}
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Generate Notes
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          Supports long videos
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          Playlist support
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          100% free
        </div>
      </div>
    </div>
  );
};

export default UrlInput;
