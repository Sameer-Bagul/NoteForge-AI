import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InterviewTabProps {
    topicTitles: string[];
    fullContent: string;
}

interface IQuestion {
    id: string;
    category: 'conceptual' | 'technical' | 'practical';
    question: string;
    answer: string;
    followUp?: string;
    difficulty: 'junior' | 'mid' | 'senior';
    topic: string;
}

const CATEGORY_CONFIG = {
    conceptual: { label: 'Conceptual', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: '🧠' },
    technical: { label: 'Technical', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30', icon: '⚙️' },
    practical: { label: 'Practical', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: '🛠️' },
};

const LEVEL_COLOR = {
    junior: 'bg-emerald-500/15 text-emerald-400',
    mid: 'bg-amber-500/15 text-amber-400',
    senior: 'bg-red-500/15 text-red-400',
};

function IQCard({ q, index }: { q: IQuestion; index: number }) {
    const [open, setOpen] = useState(false);
    const cat = CATEGORY_CONFIG[q.category] || CATEGORY_CONFIG.conceptual;

    return (
        <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-card/80 transition-colors"
            >
                <span className="text-lg shrink-0 mt-0.5">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', cat.color)}>
                            {cat.label}
                        </Badge>
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border-0', LEVEL_COLOR[q.difficulty])}>
                            {q.difficulty}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">{q.topic}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-relaxed">{q.question}</p>
                </div>
                <div className="shrink-0 mt-1 text-muted-foreground">
                    {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/30">
                    <div className="mt-3 p-4 rounded-xl bg-card border border-border/40 text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                        {q.answer}
                    </div>
                    {q.followUp && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <span className="text-sm shrink-0">↩</span>
                            <div>
                                <p className="text-[10px] font-semibold text-amber-400 mb-0.5 uppercase tracking-wide">Follow-up</p>
                                <p className="text-xs text-amber-100/80 leading-relaxed">{q.followUp}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function InterviewTab({ topicTitles, fullContent }: InterviewTabProps) {
    const [questions, setQuestions] = useState<IQuestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'conceptual' | 'technical' | 'practical'>('all');

    const generate = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const data = await api.generateInterview(topicTitles, fullContent);
            setQuestions(Array.isArray(data) ? data : []);
            setGenerated(true);
        } catch {
            setError('Failed to generate interview Q&A. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [topicTitles, fullContent]);

    const categories = ['all', 'conceptual', 'technical', 'practical'] as const;
    const filtered = filter === 'all' ? questions : questions.filter(q => q.category === filter);

    if (!generated) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                    <h3 className="font-semibold text-foreground mb-1">Interview Prep</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Generate conceptual, technical, and practical interview questions with detailed answers.</p>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button onClick={generate} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {loading ? 'Generating Q&A…' : 'Generate Interview Q&A'}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-primary" />
                    <span className="font-semibold">{questions.length} Interview Questions</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize',
                                filter === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {cat === 'all' ? 'All' : CATEGORY_CONFIG[cat]?.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                {filtered.map((q, i) => <IQCard key={q.id || i} q={q} index={i} />)}
            </div>
        </div>
    );
}
