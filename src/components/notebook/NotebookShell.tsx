import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    BookOpen, Layers, GitBranch, HelpCircle, Briefcase,
    ArrowLeft, ArrowRight, Download, Clock, FileText,
    Loader2, Tv, Trash2, Play, Search, X, Eye,
    Printer, Share2, Sparkles, RotateCcw
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { isTauri, tauriApi } from '@/services/tauri';
import { exportNotebookAsFolder } from '@/services/export/bundleExport';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RunningNotesViewer } from './RunningNotesViewer';
import { MindMapTab } from './MindMapTab';
import { QuizTab } from './QuizTab';
import { InterviewTab } from './InterviewTab';
import { EnhanceModal, EnhanceOptions } from './EnhanceModal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { VideoNotes, Notebook } from '@/types';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { useNavRail } from '@/context/NavRailContext';

interface NotebookShellProps {
    notes: VideoNotes;
    onReset: () => void;
}

type TabType = 'index' | 'notes' | 'mindmap' | 'quiz' | 'interview';

// ─── Compact Minimalist Topic Sidebar ──────────────────────────────────────────

function parseTimestampToSeconds(ts: string): number {
    const clean = ts.replace(/[[\]]/g, '').trim();
    const parts = clean.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

function TopicSidebar({
    topics,
    activeId,
    onSelect,
    onSeek,
}: {
    topics: { id: string; title: string; subtopics?: string[]; startTime?: number; timeDisplay?: string }[];
    activeId?: string;
    onSelect: (id: string) => void;
    onSeek?: (seconds: number) => void;
}) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return topics;
        const q = search.toLowerCase();
        return topics.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.subtopics?.some(st => st.toLowerCase().includes(q))
        );
    }, [topics, search]);

    return (
        <nav className="h-full flex flex-col overflow-hidden bg-card/10 select-none">
            <div className="p-2.5 border-b border-border/30 space-y-2 shrink-0">
                <div className="flex items-center justify-between text-xs px-0.5">
                    <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Chapters
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/70">
                        {topics.length} items
                    </span>
                </div>
                <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search chapters..."
                        className="w-full bg-secondary/30 border border-border/30 rounded-lg pl-7 pr-6 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border/80 font-mono transition-colors"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                {filtered.map((t) => {
                    const originalIndex = topics.findIndex(item => item.id === t.id);
                    const isActive = activeId === t.id;

                    return (
                        <div key={t.id} className="space-y-0.5">
                            <button
                                onClick={() => {
                                    onSelect(t.id);
                                    if (t.startTime !== undefined && onSeek) {
                                        onSeek(t.startTime);
                                    }
                                }}
                                className={cn(
                                    'w-full text-left px-3 py-2 rounded-lg text-xs transition-all group relative flex items-start justify-between gap-2',
                                    isActive
                                        ? 'bg-secondary/90 text-foreground font-semibold shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                )}
                            >
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <span className={cn(
                                        'text-[11px] font-mono shrink-0 mt-0.5',
                                        isActive ? 'text-primary font-bold' : 'text-muted-foreground/50'
                                    )}>
                                        {String(originalIndex + 1).padStart(2, '0')}
                                    </span>
                                    <span className="line-clamp-2 leading-snug text-xs">{t.title}</span>
                                </div>
                                {t.timeDisplay && (
                                    <span className={cn(
                                        "text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0",
                                        isActive ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground/60"
                                    )}>
                                        {t.timeDisplay}
                                    </span>
                                )}
                            </button>

                            {/* Nested Sub-chapters when chapter is active and has multiple parts */}
                            {isActive && t.subtopics && t.subtopics.length > 1 && (
                                <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-border/50 ml-3.5 my-0.5">
                                    {t.subtopics.map((st, sIdx) => {
                                        const timeMatch = st.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
                                        const secs = timeMatch ? parseTimestampToSeconds(timeMatch[1]) : undefined;
                                        const displayTitle = st.replace(/\s*\[\d{1,2}:\d{2}(?::\d{2})?\]/, '');

                                        return (
                                            <button
                                                key={sIdx}
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (secs !== undefined && onSeek) {
                                                        onSeek(secs);
                                                    }
                                                }}
                                                className="w-full text-left px-2 py-1 rounded-md text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center justify-between gap-1 group/sub"
                                            >
                                                <span className="truncate group-hover/sub:text-foreground transition-colors">
                                                    {displayTitle}
                                                </span>
                                                {timeMatch && (
                                                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                                        {timeMatch[1]}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </nav>
    );
}

// ─── Minimalist Editorial Index Hub ───────────────────────────────────────────

function IndexPanel({
    topics,
    notes,
    onSelectTopic,
    onSeek,
    onStartReading,
    onOpenMindMap,
    onOpenQuiz,
    onOpenInterview,
    onEnhanceNotebook,
}: {
    topics: VideoNotes['index'];
    notes: VideoNotes;
    onSelectTopic?: (id: string) => void;
    onSeek?: (seconds: number) => void;
    onStartReading?: () => void;
    onOpenMindMap?: () => void;
    onOpenQuiz?: () => void;
    onOpenInterview?: () => void;
    onEnhanceNotebook?: () => void;
}) {
    const [searchQuery, setSearchQuery] = useState('');

    const wordCount = useMemo(() => notes.fullContent.split(/\s+/).filter(Boolean).length, [notes.fullContent]);
    const readingTime = useMemo(() => Math.max(1, Math.ceil(wordCount / 200)), [wordCount]);

    const filteredTopics = useMemo(() => {
        if (!searchQuery.trim()) return topics;
        const q = searchQuery.toLowerCase();
        return topics.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.subtopics?.some(st => st.toLowerCase().includes(q))
        );
    }, [topics, searchQuery]);

    const chaptersCount = topics.length;

    return (
        <div className="max-w-5xl mx-auto w-full px-6 sm:px-8 py-8 sm:py-10 space-y-8">
            {/* ── Editorial Hero Header (Un-slopped, Minimalist) ───────────────── */}
            <div className="p-6 sm:p-8 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xs space-y-6 shadow-xs">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                            Curriculum index
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="text-xs font-mono text-muted-foreground">
                            {chaptersCount} {chaptersCount === 1 ? 'chapter' : 'chapters'}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="text-xs font-mono text-muted-foreground">
                            ~{readingTime} min read
                        </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                        {notes.title}
                    </h1>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">
                        Lecture curriculum structured into {chaptersCount} {chaptersCount === 1 ? 'chapter' : 'chapters'} with timestamps, technical notes, and concept diagrams.
                    </p>
                </div>

                {/* Metrics bar */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground pt-1 border-t border-border/25">
                    <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{chaptersCount} {chaptersCount === 1 ? 'chapter' : 'chapters'}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{wordCount.toLocaleString()} words</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>~{readingTime} min read</span>
                    </span>
                </div>

                {/* Primary Action Button */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                    <Button
                        onClick={onStartReading}
                        className="rounded-lg px-4 h-8 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 gap-2 shadow-xs transition-colors"
                    >
                        <span>Start reading</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                    {onEnhanceNotebook && (
                        <Button
                            variant="outline"
                            onClick={onEnhanceNotebook}
                            className="rounded-lg px-3.5 h-8 text-xs font-medium border-border/60 hover:bg-muted/30 text-foreground gap-1.5 transition-colors"
                        >
                            <span>Enhance notebook</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Interactive Study Suite (Eliminating Empty Space) ─────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Quiz Card */}
                <div
                    onClick={onOpenQuiz}
                    className="p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/70 hover:border-amber-500/40 transition-all cursor-pointer group space-y-2 shadow-xs"
                >
                    <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                            <HelpCircle className="w-4 h-4" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400">
                            {notes.quiz?.length || 0} Questions
                        </Badge>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-foreground group-hover:text-amber-400 transition-colors">
                            Self-Check Quiz
                        </h3>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Active recall questions to test your conceptual and syntax retention.
                        </p>
                    </div>
                </div>

                {/* Mind Map Card */}
                <div
                    onClick={onOpenMindMap}
                    className="p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/70 hover:border-cyan-500/40 transition-all cursor-pointer group space-y-2 shadow-xs"
                >
                    <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                            <GitBranch className="w-4 h-4" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono border-cyan-500/30 text-cyan-400">
                            Interactive Graph
                        </Badge>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-foreground group-hover:text-cyan-400 transition-colors">
                            Concept Mind Map
                        </h3>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Visual architecture graph illustrating key concepts and topic dependencies.
                        </p>
                    </div>
                </div>

                {/* Interview Prep Card */}
                <div
                    onClick={onOpenInterview}
                    className="p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/70 hover:border-emerald-500/40 transition-all cursor-pointer group space-y-2 shadow-xs"
                >
                    <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                            <Briefcase className="w-4 h-4" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">
                            {notes.interviewQA?.length || 0} Questions
                        </Badge>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                            Technical Q&A
                        </h3>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Interview preparation questions categorized by difficulty and domain.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Chapters Outline Header & Search ─────────────────────────────── */}
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                            <span>Curriculum Index</span>
                            <span className="text-xs font-mono text-muted-foreground font-normal">
                                ({filteredTopics.length} {filteredTopics.length === 1 ? 'Chapter' : 'Chapters'})
                            </span>
                        </h2>
                        <p className="text-[11px] text-muted-foreground">
                            Structured syllabus with direct timestamps, subtopics, and comprehensive study notes
                        </p>
                    </div>

                    <div className="relative w-56 sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search index..."
                            className="w-full bg-secondary/30 border border-border/40 rounded-xl pl-8 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border/80 font-mono transition-colors"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Clean Curriculum Index Rows (Table of Contents) ───────────── */}
                <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden divide-y divide-border/20 shadow-xs">
                    {filteredTopics.map((t) => {
                        const originalIndex = topics.findIndex(item => item.id === t.id);
                        const noteForTopic = notes.notes.find(n => n.topicId === t.id);
                        const topicWordCount = noteForTopic?.content
                            ? noteForTopic.content.split(/\s+/).filter(Boolean).length
                            : 0;
                        const topicReadingTime = Math.max(1, Math.ceil(topicWordCount / 200));
                        const summary = noteForTopic?.summary || (noteForTopic as any)?.description;

                        return (
                            <div
                                key={t.id}
                                onClick={() => onSelectTopic?.(t.id)}
                                className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-all cursor-pointer gap-3.5"
                            >
                                <div className="flex items-start gap-4 min-w-0 flex-1">
                                    <span className="font-mono font-bold text-xs text-primary/80 group-hover:text-primary shrink-0 mt-0.5 w-6">
                                        {String(originalIndex + 1).padStart(2, '0')}.
                                    </span>
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors tracking-tight">
                                                {t.title}
                                            </h3>
                                            {t.timeDisplay && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (t.startTime !== undefined && onSeek) {
                                                            onSeek(t.startTime);
                                                        }
                                                        onSelectTopic?.(t.id);
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary/70 hover:bg-primary/20 hover:text-primary text-muted-foreground transition-colors border border-border/30"
                                                    title={`Jump video to ${t.timeDisplay}`}
                                                >
                                                    <Play className="w-2.5 h-2.5 fill-current text-primary" />
                                                    <span>{t.timeDisplay}</span>
                                                </button>
                                            )}
                                        </div>

                                        {summary && summary !== t.title && (
                                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                                {summary}
                                            </p>
                                        )}

                                        {/* Subtopics Index taxonomy & nested sub-chapters */}
                                        {t.subtopics && t.subtopics.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-muted-foreground/75 font-mono">
                                                {t.subtopics.map((st, si) => {
                                                    const timeMatch = st.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
                                                    const secs = timeMatch ? parseTimestampToSeconds(timeMatch[1]) : undefined;

                                                    return (
                                                        <span key={si} className="inline-flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (secs !== undefined && onSeek) {
                                                                        onSeek(secs);
                                                                    }
                                                                    onSelectTopic?.(t.id);
                                                                }}
                                                                className="text-[11px] bg-secondary/40 hover:bg-secondary/80 px-2 py-0.5 rounded text-foreground/80 hover:text-foreground transition-colors cursor-pointer border border-transparent hover:border-border/40"
                                                                title={timeMatch ? `Jump to ${timeMatch[1]}` : undefined}
                                                            >
                                                                {st}
                                                            </button>
                                                            {si < (t.subtopics?.length || 0) - 1 && (
                                                                <span className="text-muted-foreground/30 text-[10px]">·</span>
                                                            )}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center pl-10 sm:pl-0">
                                    <span className="text-xs font-mono text-muted-foreground/70 hidden sm:inline">
                                        ~{topicReadingTime}m read
                                    </span>
                                    <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                                        <span>Read Notes</span>
                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredTopics.length === 0 && (
                        <div className="p-12 text-center text-xs text-muted-foreground font-mono">
                            No chapters found matching &quot;{searchQuery}&quot;
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── NotebookShell ─────────────────────────────────────────────────────────────

export function NotebookShell({ notes, onReset }: NotebookShellProps) {
    const [currentNotes, setCurrentNotes] = useState<VideoNotes>(notes);
    const [activeTopicId, setActiveTopicId] = useState(notes.index[0]?.id);
    const [activeTab, setActiveTab] = useState<TabType>('index');
    const [isStudioMode, setIsStudioMode] = useState(true);
    const [seekTime, setSeekTime] = useState<number | null>(null);

    useEffect(() => {
        setCurrentNotes(notes);
    }, [notes]);

    const handleUpdateNotes = useCallback((updates: Partial<Notebook>) => {
        setCurrentNotes(prev => ({
            ...prev,
            quiz: (updates.quiz as any) || prev.quiz,
            mindMaps: updates.mindMaps ? { ...(prev.mindMaps || {}), ...updates.mindMaps } : prev.mindMaps,
            interviewQA: (updates.interviewQA as any) || prev.interviewQA,
        }));
    }, []);

    const rawId = notes.videoId || (notes as any).id || (notes.notes?.[0] as any)?.videoSources?.[0]?.videoId || '';
    const videoId = rawId.includes('watch?v=')
        ? rawId.split('watch?v=')[1]?.split('&')[0]
        : rawId.includes('youtu.be/')
        ? rawId.split('youtu.be/')[1]?.split('?')[0]
        : rawId;

    const activeTopicIdx = notes.index.findIndex(t => t.id === activeTopicId);
    const activeTopic = notes.index[activeTopicIdx !== -1 ? activeTopicIdx : 0];
    const activeNote = notes.notes.find(n => n.topicId === activeTopicId);

    const prevTopic = activeTopicIdx > 0 ? notes.index[activeTopicIdx - 1] : undefined;
    const nextTopic = activeTopicIdx < notes.index.length - 1 ? notes.index[activeTopicIdx + 1] : undefined;

    const wordCount = useMemo(() => notes.fullContent.split(/\s+/).filter(Boolean).length, [notes.fullContent]);
    const readingTime = useMemo(() => Math.max(1, Math.ceil(wordCount / 200)), [wordCount]);

    const { settings } = useSettings();
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // ─── Enhancement State & Handlers ──────────────────────────────────────────
    const [isEnhanceModalOpen, setIsEnhanceModalOpen] = useState(false);
    const [enhanceMode, setEnhanceMode] = useState<'chapter' | 'notebook'>('chapter');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [streamingTopicId, setStreamingTopicId] = useState<string | null>(null);
    const [streamingContent, setStreamingContent] = useState<string>('');
    const [streamingStatus, setStreamingStatus] = useState<string>('');

    const handleEnhanceChapter = (topicId?: string) => {
        setEnhanceMode('chapter');
        if (topicId) setActiveTopicId(topicId);
        setIsEnhanceModalOpen(true);
    };

    const handleEnhanceNotebook = () => {
        setEnhanceMode('notebook');
        setIsEnhanceModalOpen(true);
    };

    const handleEnhanceConfirm = async (options: EnhanceOptions) => {
        setIsEnhancing(true);
        const provConfig = settings.providers.find(p => p.provider === options.provider);
        const apiKey = provConfig?.apiKey;
        const baseUrl = provConfig?.baseUrl;

        if (enhanceMode === 'chapter') {
            const targetTopic = currentNotes.notes.find(n => n.topicId === activeTopicId) || currentNotes.notes[0];
            if (!targetTopic) {
                setIsEnhancing(false);
                return;
            }

            const currentText = targetTopic.content || '';
            const topicInfo = currentNotes.index.find(t => t.id === targetTopic.topicId);
            const subtopics = topicInfo?.subtopics || [];

            setStreamingTopicId(targetTopic.topicId);
            setStreamingContent('');
            setStreamingStatus(`Enhancing with ${options.model}…`);

            try {
                let accumulated = '';
                const enhanced = await api.enhanceTopicNotes(
                    targetTopic.topicTitle || topicInfo?.title || 'Chapter',
                    subtopics,
                    currentText,
                    options.provider,
                    options.model,
                    apiKey,
                    baseUrl,
                    (token) => {
                        accumulated += token;
                        setStreamingContent(accumulated);
                    }
                );

                const finalContent = enhanced || accumulated;

                // Update notes array
                const updatedNotesList = currentNotes.notes.map(n => {
                    if (n.topicId === targetTopic.topicId) {
                        return {
                            ...n,
                            content: finalContent,
                            originalContent: n.originalContent || currentText,
                            isEnhanced: true,
                            enhancedAt: new Date().toISOString(),
                            enhancedWith: `${options.model}`,
                        };
                    }
                    return n;
                });

                const newFullContent = updatedNotesList.map(n => n.content).join('\n\n---\n\n');
                let updatedMindMaps = currentNotes.mindMaps;
                let updatedQuiz = currentNotes.quiz;

                // Optional auxiliary updates
                if (options.upgradeAuxiliary) {
                    try {
                        const newMap = await api.generateMindMap(
                            targetTopic.topicTitle || topicInfo?.title || 'Chapter',
                            subtopics,
                            finalContent.slice(0, 3000)
                        );
                        if (newMap && newMap.nodes) {
                            updatedMindMaps = {
                                ...(updatedMindMaps || {}),
                                [targetTopic.topicId]: {
                                    topicId: targetTopic.topicId,
                                    nodes: newMap.nodes,
                                    edges: newMap.edges || [],
                                }
                            };
                        }
                    } catch (mErr) {
                        console.warn('Failed to upgrade mind map:', mErr);
                    }

                    try {
                        const newQuiz = await api.generateQuiz(
                            [targetTopic.topicTitle || topicInfo?.title || 'Chapter'],
                            finalContent.slice(0, 4000)
                        );
                        if (Array.isArray(newQuiz) && newQuiz.length > 0) {
                            updatedQuiz = newQuiz;
                        }
                    } catch (qErr) {
                        console.warn('Failed to upgrade quiz:', qErr);
                    }
                }

                const updatedNotesState: VideoNotes = {
                    ...currentNotes,
                    notes: updatedNotesList,
                    fullContent: newFullContent,
                    mindMaps: updatedMindMaps,
                    quiz: updatedQuiz,
                };

                setCurrentNotes(updatedNotesState);

                // Persist changes in SQLite
                const notebookId = currentNotes.notebookId || currentNotes.videoId;
                if (notebookId) {
                    await api.updateNotebook(notebookId, {
                        notes: updatedNotesList,
                        fullContent: newFullContent,
                        mindMaps: updatedMindMaps,
                        quiz: updatedQuiz,
                    });
                }

                toast({
                    title: 'Chapter Enhanced',
                    description: `Upgraded with ${options.model}. Pre-enhanced copy saved for rollback.`,
                });
            } catch (err: any) {
                console.error('Enhancement failed:', err);
                toast({
                    title: 'Enhancement Failed',
                    description: err?.message || 'Could not complete enhancement.',
                    variant: 'destructive',
                });
            } finally {
                setIsEnhancing(false);
                setStreamingTopicId(null);
                setStreamingContent('');
                setStreamingStatus('');
            }
        } else {
            // Notebook-wide sequential enhancement
            setStreamingStatus(`Enhancing notebook with ${options.model}…`);
            try {
                const updatedNotesList = [...currentNotes.notes];
                for (let i = 0; i < updatedNotesList.length; i++) {
                    const topic = updatedNotesList[i];
                    const topicInfo = currentNotes.index.find(t => t.id === topic.topicId);
                    const subtopics = topicInfo?.subtopics || [];
                    const currentText = topic.content || '';

                    setStreamingTopicId(topic.topicId);
                    setStreamingStatus(`Enhancing chapter ${i + 1}/${updatedNotesList.length}…`);

                    let accumulated = '';
                    const enhanced = await api.enhanceTopicNotes(
                        topic.topicTitle || topicInfo?.title || `Chapter ${i + 1}`,
                        subtopics,
                        currentText,
                        options.provider,
                        options.model,
                        apiKey,
                        baseUrl,
                        (token) => {
                            accumulated += token;
                            setStreamingContent(accumulated);
                        }
                    );

                    const finalContent = enhanced || accumulated;
                    updatedNotesList[i] = {
                        ...topic,
                        content: finalContent,
                        originalContent: topic.originalContent || currentText,
                        isEnhanced: true,
                        enhancedAt: new Date().toISOString(),
                        enhancedWith: `${options.model}`,
                    };
                }

                const newFullContent = updatedNotesList.map(n => n.content).join('\n\n---\n\n');

                const updatedNotesState: VideoNotes = {
                    ...currentNotes,
                    notes: updatedNotesList,
                    fullContent: newFullContent,
                };

                setCurrentNotes(updatedNotesState);

                const notebookId = currentNotes.notebookId || currentNotes.videoId;
                if (notebookId) {
                    await api.updateNotebook(notebookId, {
                        notes: updatedNotesList,
                        fullContent: newFullContent,
                    });
                }

                toast({
                    title: 'Notebook Enhanced',
                    description: `All ${updatedNotesList.length} chapters upgraded with ${options.model}.`,
                });
            } catch (err: any) {
                console.error('Batch enhancement failed:', err);
                toast({
                    title: 'Enhancement Failed',
                    description: err?.message || 'Failed to enhance full notebook.',
                    variant: 'destructive',
                });
            } finally {
                setIsEnhancing(false);
                setStreamingTopicId(null);
                setStreamingContent('');
                setStreamingStatus('');
            }
        }
    };

    const handleRevertChapter = async (topicId?: string) => {
        const targetId = topicId || activeTopicId;
        const targetTopic = currentNotes.notes.find(n => n.topicId === targetId);
        if (!targetTopic || !targetTopic.originalContent) return;

        const updatedNotesList = currentNotes.notes.map(n => {
            if (n.topicId === targetId) {
                return {
                    ...n,
                    content: n.originalContent!,
                    isEnhanced: false,
                    enhancedAt: undefined,
                    enhancedWith: undefined,
                };
            }
            return n;
        });

        const newFullContent = updatedNotesList.map(n => n.content).join('\n\n---\n\n');

        const updatedNotesState: VideoNotes = {
            ...currentNotes,
            notes: updatedNotesList,
            fullContent: newFullContent,
        };

        setCurrentNotes(updatedNotesState);

        const notebookId = currentNotes.notebookId || currentNotes.videoId;
        if (notebookId) {
            await api.updateNotebook(notebookId, {
                notes: updatedNotesList,
                fullContent: newFullContent,
            });
        }

        toast({
            title: 'Reverted to Original',
            description: 'Restored pre-enhanced chapter content.',
        });
    };

    const handleDownloadAll = () => {
        const content = `# ${notes.title}\n\n---\n\n## Table of Contents\n\n${notes.index.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}\n\n---\n\n${notes.fullContent}`;
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${notes.title.replace(/[^a-z0-9]/gi, '_')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({ title: 'Downloaded!', description: 'Notebook saved as Markdown.' });
    };

    const [isExportingFolder, setIsExportingFolder] = useState(false);

    const handleExportFolder = async () => {
        try {
            setIsExportingFolder(true);
            const res = await exportNotebookAsFolder(currentNotes);
            if (res.cancelled) return;
            if (res.success) {
                toast({
                    title: res.isZipFallback ? 'Study Vault Downloaded' : 'Study Vault Exported',
                    description: res.message || 'Notebook files exported successfully.',
                });
            } else {
                toast({
                    title: 'Export Failed',
                    description: res.message || 'Could not export folder.',
                    variant: 'destructive',
                });
            }
        } catch (err: any) {
            toast({
                title: 'Export Error',
                description: err?.message || 'Unexpected error during folder export.',
                variant: 'destructive',
            });
        } finally {
            setIsExportingFolder(false);
        }
    };

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const isArchived = Boolean(currentNotes.isArchived);

    const handleRestoreNotebook = async () => {
        try {
            const targetId = currentNotes.notebookId || currentNotes.videoId;
            if (targetId) {
                await api.toggleArchived(targetId, false);
                setCurrentNotes(prev => ({ ...prev, isArchived: false }));
                toast({
                    title: 'Notebook restored',
                    description: `"${currentNotes.title}" has been restored to your active library.`,
                });
            }
        } catch (err: any) {
            console.error('Failed to restore notebook:', err);
            toast({
                title: 'Restore failed',
                description: err?.message || 'Could not restore notebook.',
                variant: 'destructive',
            });
        }
    };

    const handleConfirmDeleteNotebook = async () => {
        try {
            setIsDeleting(true);
            const targetId = currentNotes.notebookId || currentNotes.videoId;
            if (isArchived) {
                if (targetId) {
                    await api.deleteNotebook(targetId);
                }
                toast({
                    title: 'Notebook deleted permanently',
                    description: `"${currentNotes.title}" has been removed.`,
                });
                onReset();
            } else {
                if (targetId) {
                    await api.toggleArchived(targetId, true);
                }
                toast({
                    title: 'Moved to trash',
                    description: `"${currentNotes.title}" moved to trash.`,
                    action: (
                        <ToastAction
                            altText="Undo"
                            onClick={async () => {
                                if (targetId) {
                                    await api.toggleArchived(targetId, false);
                                    toast({
                                        title: 'Restored',
                                        description: `"${currentNotes.title}" restored.`,
                                    });
                                }
                            }}
                        >
                            Undo
                        </ToastAction>
                    ),
                });
                onReset();
            }
        } catch (err: any) {
            console.error('Failed to delete/trash notebook:', err);
            toast({
                title: 'Action failed',
                description: err?.message || 'Failed to update notebook state.',
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (isTauri()) {
            window.print();
            toast({ title: 'Print / Save as PDF', description: 'Select "Save as PDF" in the print dialog to export vector PDF.' });
            return;
        }

        try {
            setIsExportingPdf(true);
            toast({ title: 'Generating PDF...', description: 'This may take a few seconds.' });

            const exportId = notes.notebookId || notes.videoId;
            const response = await api.exportPdf(exportId, settings.pdfTheme || 'modern');

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${notes.title.replace(/[^a-z0-9]/gi, '_')}_Notes.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast({ title: 'PDF Exported!', description: 'Your beautifully styled notes are ready.' });
        } catch (error) {
            console.error('PDF Export failed, falling back to print:', error);
            window.print();
        } finally {
            setIsExportingPdf(false);
        }
    };

    const handleExportCmsJson = () => {
        const payload = {
            title: notes.title,
            content: notes.fullContent,
            description: `Video notes generated for ${notes.title}`,
            tags: ['youtube', 'ai-notes'],
            notebook: notes,
            quiz: notes.quiz || [],
            interviewQA: notes.interviewQA || [],
            mindMaps: notes.mindMaps || null,
            videoSources: notes.notes?.flatMap(n => n.videoSources || []) || [],
            keyTakeaways: notes.notes?.flatMap(n => n.keyTakeaways || []) || []
        };

        const jsonString = JSON.stringify(payload, null, 2);

        navigator.clipboard.writeText(jsonString);

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${notes.title.replace(/[^a-z0-9]/gi, '_')}_CMS_Note.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({ title: 'JSON Exported & Copied!', description: 'Downloaded .json file and copied payload to clipboard.' });
    };

    const mapTopics = notes.index.map(t => ({
        id: t.id,
        title: t.title,
        subtopics: t.subtopics ?? [],
    }));

    const topicTitles = notes.index.map(t => t.title);

    const { setStudioProps } = useNavRail();

    const handlersRef = useRef({
        handleDownloadPdf,
        handleExportFolder,
        handleDownloadAll,
        handleExportCmsJson,
        setIsStudioMode,
        setIsDeleteDialogOpen,
    });
    handlersRef.current = {
        handleDownloadPdf,
        handleExportFolder,
        handleDownloadAll,
        handleExportCmsJson,
        setIsStudioMode,
        setIsDeleteDialogOpen,
    };

    useEffect(() => {
        setStudioProps({
            activeTab,
            onTabChange: setActiveTab,
            topicsCount: currentNotes.index.length,
            quizCount: currentNotes.quiz?.length,
            interviewCount: currentNotes.interviewQA?.length,
            hasVideo: Boolean(videoId),
            isStudioMode,
            onToggleStudioMode: () => handlersRef.current.setIsStudioMode(prev => !prev),
            isExportingPdf,
            onExportPdf: () => handlersRef.current.handleDownloadPdf(),
            isExportingFolder,
            onExportFolder: () => handlersRef.current.handleExportFolder(),
            onDownloadMarkdown: () => handlersRef.current.handleDownloadAll(),
            onExportCmsJson: () => handlersRef.current.handleExportCmsJson(),
            isDeleting,
            onDeleteNotebook: () => handlersRef.current.setIsDeleteDialogOpen(true),
            isArchived,
        });

        return () => {
            setStudioProps(null);
        };
    }, [
        setStudioProps,
        activeTab,
        currentNotes.index.length,
        currentNotes.quiz?.length,
        currentNotes.interviewQA?.length,
        videoId,
        isStudioMode,
        isExportingPdf,
        isExportingFolder,
        isDeleting,
        isArchived,
    ]);

    return (
        <TooltipProvider delayDuration={100}>
            {/* Fixed Edge-to-Edge Container (Single Smooth Workspace) */}
            <main className="w-full h-full flex flex-col min-w-0 overflow-hidden bg-background">
                {/* Archived / Trash Notification Banner */}
                {isArchived && (
                        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-300 shrink-0 select-none">
                            <div className="flex items-center gap-2 truncate">
                                <Trash2 className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="font-semibold text-amber-200 truncate">
                                    This notebook is in your Trash.
                                </span>
                                <span className="text-amber-300/80 hidden sm:inline">
                                    Restore it to keep studying or edit chapters.
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleRestoreNotebook}
                                    className="h-7 px-3 text-xs rounded-lg border-amber-500/40 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100 gap-1.5 font-medium shadow-xs"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Restore Notebook</span>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Minimalist Top App Navigation Bar (Un-slopped, single title) */}
                    <header className="h-12 border-b border-border/30 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur-md select-none">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground/60 hover:text-muted-foreground cursor-pointer transition-colors" onClick={onReset}>
                                Library
                            </span>
                            <span className="text-muted-foreground/40 text-xs">/</span>
                            <span className="text-xs font-semibold text-foreground truncate max-w-sm sm:max-w-md md:max-w-lg">
                                {notes.title}
                            </span>
                            {activeTab !== 'index' && (
                                <Badge variant="secondary" className="ml-1.5 text-[10px] font-mono capitalize hidden sm:inline-flex">
                                    {activeTab === 'notes' ? 'Study Notes' :
                                     activeTab === 'mindmap' ? 'Concept Map' :
                                     activeTab === 'quiz' ? 'Self-Check Quiz' : 'Interview Q&A'}
                                </Badge>
                            )}
                        </div>

                        {/* Top Right Controls */}
                        <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-[11px] font-mono text-muted-foreground/70 mr-1 hidden sm:inline">
                                {notes.index.length} {notes.index.length === 1 ? 'Chapter' : 'Chapters'} · {wordCount.toLocaleString()} words · ~{readingTime}m read
                            </span>

                            {videoId && activeTab === 'notes' && (
                                <Button
                                    variant={!isStudioMode ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setIsStudioMode(!isStudioMode)}
                                    className="h-7 text-xs rounded-lg px-2.5 gap-1.5 font-medium transition-all"
                                    title={!isStudioMode ? "Show docked video player" : "Hide video player to focus on notes"}
                                >
                                    {!isStudioMode ? <Tv className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    <span>{!isStudioMode ? "Show Video" : "Focus Mode"}</span>
                                </Button>
                            )}

                            {activeTab !== 'index' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('index')}
                                    className="h-7 text-xs rounded-lg px-2.5 gap-1.5 text-muted-foreground hover:text-foreground"
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>Index</span>
                                </Button>
                            )}
                        </div>
                    </header>

                    {/* ── Active Tab Content Area (The Single Scrollable Container) ── */}
                    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                        {/* TAB 1: CURRICULUM INDEX (Default View) */}
                        {activeTab === 'index' && (
                            <div className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
                                <IndexPanel
                                    topics={currentNotes.index}
                                    notes={currentNotes}
                                    onSelectTopic={(id) => {
                                        setActiveTopicId(id);
                                        setActiveTab('notes');
                                    }}
                                    onSeek={(secs) => {
                                        setSeekTime(secs);
                                        if (!isStudioMode) setIsStudioMode(true);
                                        setActiveTab('notes');
                                    }}
                                    onStartReading={() => {
                                        if (currentNotes.index[0]?.id) {
                                            setActiveTopicId(currentNotes.index[0].id);
                                        }
                                        setActiveTab('notes');
                                    }}
                                    onOpenMindMap={() => setActiveTab('mindmap')}
                                    onOpenQuiz={() => setActiveTab('quiz')}
                                    onOpenInterview={() => setActiveTab('interview')}
                                    onEnhanceNotebook={handleEnhanceNotebook}
                                />
                            </div>
                        )}

                        {/* TAB 2: STUDY NOTES (Running Notes Viewer) */}
                        {activeTab === 'notes' && (
                            <div className="flex-1 overflow-hidden min-h-0 flex flex-row p-3 gap-3">
                                {/* Left Column: Video & Topic Sidebar (Docked Studio Pane) */}
                                {isStudioMode && (
                                    <div className={cn(
                                        "h-full flex flex-col rounded-xl border border-border/40 bg-card/30 overflow-hidden shrink-0 transition-all duration-200 shadow-xs",
                                        videoId ? "w-80 lg:w-96" : "w-64 lg:w-72"
                                    )}>
                                        {/* Video Player */}
                                        {videoId && (
                                            <div className="aspect-video w-full bg-black shrink-0 relative overflow-hidden border-b border-border/30">
                                                <iframe
                                                    key={seekTime !== null ? `yt-${seekTime}` : 'yt-initial'}
                                                    src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1${seekTime !== null ? `&start=${seekTime}&autoplay=1` : ''}`}
                                                    title="YouTube Video Player"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                    className="w-full h-full border-0"
                                                />
                                            </div>
                                        )}

                                        {/* Chapters Sidebar */}
                                        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                                            <TopicSidebar
                                                topics={notes.index}
                                                activeId={activeTopicId}
                                                onSelect={(id) => setActiveTopicId(id)}
                                                onSeek={(secs) => {
                                                    setSeekTime(secs);
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Right Column: Notebook Reader */}
                                <div className="flex-1 overflow-hidden h-full flex flex-col min-w-0">
                                    {activeNote ? (
                                        <RunningNotesViewer
                                            content={streamingTopicId === (activeNote as any)?.topicId && streamingContent ? streamingContent : ((activeNote as any).content || '')}
                                            title={(activeNote as any).topicTitle || (activeNote as any).title}
                                            className="h-full"
                                            chapterNumber={activeTopicIdx + 1}
                                            totalChapters={notes.index.length}
                                            timeDisplay={activeTopic?.timeDisplay}
                                            startTime={activeTopic?.startTime}
                                            prevChapterTitle={prevTopic?.title}
                                            nextChapterTitle={nextTopic?.title}
                                            onPrevChapter={prevTopic ? () => setActiveTopicId(prevTopic.id) : undefined}
                                            onNextChapter={nextTopic ? () => setActiveTopicId(nextTopic.id) : undefined}
                                            onSeek={(secs) => {
                                                setSeekTime(secs);
                                                if (!isStudioMode) setIsStudioMode(true);
                                            }}
                                            isStreaming={streamingTopicId === (activeNote as any)?.topicId}
                                            streamingStatus={streamingStatus}
                                            isEnhanced={(activeNote as any)?.isEnhanced}
                                            enhancedWith={(activeNote as any)?.enhancedWith}
                                            onEnhance={() => handleEnhanceChapter((activeNote as any)?.topicId)}
                                            onRevert={() => handleRevertChapter((activeNote as any)?.topicId)}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground space-y-2">
                                            <BookOpen className="w-8 h-8 text-muted-foreground/30" />
                                            <p className="text-xs">Select a chapter from the sidebar to start reading.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: VISUAL MIND MAP */}
                        {activeTab === 'mindmap' && (
                            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                                <MindMapTab
                                    notebookId={currentNotes.notebookId || currentNotes.videoId}
                                    topics={mapTopics}
                                    fullContent={currentNotes.fullContent}
                                    existingMindMaps={currentNotes.mindMaps}
                                    onUpdateNotes={handleUpdateNotes}
                                />
                            </div>
                        )}

                        {/* TAB 4: SELF-CHECK QUIZZES */}
                        {activeTab === 'quiz' && (
                            <div className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-8">
                                <div className="max-w-4xl mx-auto">
                                    <QuizTab
                                        notebookId={currentNotes.notebookId || currentNotes.videoId}
                                        topicTitles={topicTitles}
                                        fullContent={currentNotes.fullContent}
                                        existingQuiz={currentNotes.quiz}
                                        onUpdateNotes={handleUpdateNotes}
                                    />
                                </div>
                            </div>
                        )}

                        {/* TAB 5: TECHNICAL INTERVIEW PREP */}
                        {activeTab === 'interview' && (
                            <div className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-8">
                                <div className="max-w-4xl mx-auto">
                                    <InterviewTab
                                        notebookId={currentNotes.notebookId || currentNotes.videoId}
                                        topicTitles={topicTitles}
                                        fullContent={currentNotes.fullContent}
                                        existingQuestions={currentNotes.interviewQA}
                                        onUpdateNotes={handleUpdateNotes}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </main>

            {/* AI Deep Enhancement Modal */}
            <EnhanceModal
                isOpen={isEnhanceModalOpen}
                onClose={() => setIsEnhanceModalOpen(false)}
                mode={enhanceMode}
                targetTitle={
                    enhanceMode === 'chapter'
                        ? (activeNote as any)?.topicTitle || activeTopic?.title || 'Current Chapter'
                        : `${currentNotes.title} (${currentNotes.index.length} Chapters)`
                }
                onConfirm={handleEnhanceConfirm}
                isEnhancing={isEnhancing}
            />

            {/* Dedicated Notebook Deletion / Move to Trash Dialog */}
            <ConfirmDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title={isArchived ? "Delete notebook permanently" : "Move notebook to trash"}
                description={
                    isArchived
                        ? `Permanently delete "${currentNotes.title}"? All chapters, visual concept maps, and quizzes will be erased forever.`
                        : `Move "${currentNotes.title}" to trash? You can restore it anytime from the Trash section in your Library.`
                }
                confirmText={isArchived ? "Delete permanently" : "Move to trash"}
                variant={isArchived ? "destructive" : "default"}
                isLoading={isDeleting}
                onConfirm={handleConfirmDeleteNotebook}
            />
        </TooltipProvider>
    );
}
