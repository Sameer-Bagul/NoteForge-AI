import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizTabProps {
    topicTitles: string[];
    fullContent: string;
}

interface Question {
    id: string;
    type: 'mcq' | 'short';
    question: string;
    options?: string[];
    answer: string;
    explanation: string;
    topic: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

const DIFFICULTY_COLOR = {
    easy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    hard: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function MCQQuestion({ q, index }: { q: Question; index: number }) {
    const [selected, setSelected] = useState<string | null>(null);
    const [revealed, setReveal] = useState(false);

    const isCorrect = selected === q.answer;

    return (
        <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-4">
            <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm shrink-0 mt-0.5">
                    {index + 1}
                </span>
                <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', DIFFICULTY_COLOR[q.difficulty])}>
                            {q.difficulty}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{q.topic}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-relaxed">{q.question}</p>
                </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-10">
                {q.options?.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    let state: 'default' | 'correct' | 'wrong' | 'reveal' = 'default';
                    if (revealed || selected) {
                        if (opt === q.answer) state = 'correct';
                        else if (opt === selected) state = 'wrong';
                    }
                    return (
                        <button
                            key={i}
                            onClick={() => { if (!revealed) setSelected(opt); }}
                            disabled={!!selected && selected !== opt && state !== 'correct'}
                            className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all',
                                state === 'correct' ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' :
                                    state === 'wrong' ? 'border-red-500 bg-red-500/10 text-red-400' :
                                        selected === opt ? 'border-primary bg-primary/10 text-primary' :
                                            'border-border/50 hover:border-primary/50 hover:bg-primary/5 text-foreground/80',
                            )}
                        >
                            <span className="font-bold text-xs shrink-0">{letter}.</span>
                            {opt}
                            {state === 'correct' && <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0 text-emerald-400" />}
                            {state === 'wrong' && <XCircle className="w-3.5 h-3.5 ml-auto shrink-0 text-red-400" />}
                        </button>
                    );
                })}
            </div>

            {/* Reveal / Explanation */}
            {(selected || revealed) && (
                <div className={cn('ml-10 p-3 rounded-lg text-xs leading-relaxed border', isCorrect || revealed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200/90' : 'bg-red-500/10 border-red-500/20 text-red-200/90')}>
                    <strong>{isCorrect ? '✓ Correct! ' : !selected ? '' : '✗ Not quite. '}</strong>
                    {q.explanation}
                </div>
            )}

            {!selected && !revealed && (
                <button onClick={() => setReveal(true)} className="ml-10 text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2">
                    Show answer
                </button>
            )}
        </div>
    );
}

function ShortQuestion({ q, index }: { q: Question; index: number }) {
    const [showAnswer, setShowAnswer] = useState(false);

    return (
        <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-3">
            <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm shrink-0 mt-0.5">
                    {index + 1}
                </span>
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', DIFFICULTY_COLOR[q.difficulty])}>
                            {q.difficulty}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{q.topic}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Short Answer</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-relaxed">{q.question}</p>
                </div>
            </div>
            <button
                onClick={() => setShowAnswer(v => !v)}
                className="ml-10 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
                {showAnswer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showAnswer ? 'Hide answer' : 'Reveal answer'}
            </button>
            {showAnswer && (
                <div className="ml-10 p-3 rounded-lg bg-card border border-border/50 text-sm text-foreground/85 leading-relaxed">
                    {q.answer}
                    {q.explanation && (
                        <p className="mt-2 text-xs text-muted-foreground border-t border-border/30 pt-2">{q.explanation}</p>
                    )}
                </div>
            )}
        </div>
    );
}

export function QuizTab({ topicTitles, fullContent }: QuizTabProps) {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'mcq' | 'short'>('all');

    const generate = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const data = await api.generateQuiz(topicTitles, fullContent);
            setQuestions(Array.isArray(data) ? data : []);
            setGenerated(true);
        } catch {
            setError('Failed to generate quiz. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [topicTitles, fullContent]);

    const filtered = filter === 'all' ? questions : questions.filter(q => q.type === filter);

    if (!generated) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <HelpCircle className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                    <h3 className="font-semibold text-foreground mb-1">Test Your Knowledge</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Generate a quiz with mixed MCQ and short-answer questions covering all topics.</p>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button onClick={generate} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    {loading ? 'Generating Quiz…' : 'Generate Quiz'}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-primary" />
                    <span className="font-semibold">{questions.length} Questions</span>
                </div>
                <div className="flex gap-1">
                    {(['all', 'mcq', 'short'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground')}>
                            {f === 'all' ? 'All' : f === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                {filtered.map((q, i) =>
                    q.type === 'mcq'
                        ? <MCQQuestion key={q.id || i} q={q} index={i} />
                        : <ShortQuestion key={q.id || i} q={q} index={i} />
                )}
            </div>
        </div>
    );
}
