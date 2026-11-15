import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    BookOpen, Layers, GitBranch, HelpCircle, Briefcase,
    ArrowLeft, ArrowRight, Download, Clock, FileText,
    Loader2, Tv, Trash2, Play, Search, X, Eye,
    Printer, Share2
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { isTauri } from '@/services/tauri';
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
import { VideoNotes, Notebook } from '@/types';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

interface NotebookShellProps {
    notes: VideoNotes;
    onReset: () => void;
}

type TabType = 'index' | 'notes' | 'mindmap' | 'quiz' | 'interview';

// ─── Compact Minimalist Topic Sidebar ──────────────────────────────────────────

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

            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {filtered.map((t) => {
                    const originalIndex = topics.findIndex(item => item.id === t.id);
                    const isActive = activeId === t.id;

                    return (
                        <button
                            key={t.id}
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
}: {
    topics: VideoNotes['index'];
    notes: VideoNotes;
    onSelectTopic?: (id: string) => void;
    onSeek?: (seconds: number) => void;
    onStartReading?: () => void;
    onOpenMindMap?: () => void;
    onOpenQuiz?: () => void;
    onOpenInterview?: () => void;
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
                        <span className="text-[11px] font-mono tracking-widest text-primary uppercase font-bold">
                            Curriculum Syllabus & Index
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                            {chaptersCount} {chaptersCount === 1 ? 'Chapter' : 'Chapters'}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                            ~{readingTime} Min Total Read
                        </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                        {notes.title}
                    </h1>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">
                        Comprehensive curriculum decomposed into {chaptersCount} structured {chaptersCount === 1 ? 'chapter' : 'chapters'} with timestamped video markers, deep conceptual explanations, code implementations, and interactive knowledge checks.
                    </p>
                </div>

                {/* Metrics bar */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground pt-1 border-t border-border/25">
                    <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        <span>{chaptersCount} Topics Decomposed</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground/70" />
                        <span>{wordCount.toLocaleString()} Total Words</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
                        <span>~{readingTime} min Reading Time</span>
                    </span>
                </div>

                {/* Primary Action Button */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                    <Button
                        onClick={onStartReading}
                        className="rounded-xl px-5 h-9 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 gap-2 shadow-xs transition-transform active:scale-95"
                    >
                        <span>Start Reading from Chapter 1</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
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
                        <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                            <span>Chapters Outline</span>
                            <span className="text-xs font-mono text-muted-foreground font-normal">
                                ({filteredTopics.length})
                            </span>
                        </h2>
                        <p className="text-[11px] text-muted-foreground">
                            All chapters organized in chronological curriculum order
                        </p>
                    </div>

                    <div className="relative w-56 sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search chapters or subtopics..."
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

                {/* ── Clean Syllabus Cards ─────────────────────────────────────── */}
                <div className="space-y-3">
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
                                className="group flex flex-col p-4 sm:p-5 rounded-xl border border-border/40 bg-card/25 hover:bg-card/75 hover:border-border/80 transition-all cursor-pointer gap-3 shadow-xs"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                        <span className="w-8 h-8 rounded-lg bg-secondary/70 group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground font-mono font-bold text-xs flex items-center justify-center shrink-0 transition-colors">
                                            {String(originalIndex + 1).padStart(2, '0')}
                                        </span>
                                        <div className="space-y-0.5 min-w-0">
                                            <div className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold">
                                                Chapter {originalIndex + 1}
                                            </div>
                                            <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                                {t.title}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
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
                                                className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-md bg-secondary/60 hover:bg-primary/20 hover:text-primary text-muted-foreground transition-colors border border-border/30"
                                                title={`Play video from ${t.timeDisplay}`}
                                            >
                                                <Play className="w-2.5 h-2.5 fill-current text-primary" />
                                                <span>{t.timeDisplay}</span>
                                            </button>
                                        )}

                                        <span className="text-xs font-mono text-muted-foreground/60 hidden sm:inline">
                                            ~{topicReadingTime}m read
                                        </span>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs px-2.5 gap-1 group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                                        >
                                            <span>Read Notes</span>
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </Button>
                                    </div>
                                </div>

                                {summary && summary !== t.title && (
                                    <p className="text-xs text-muted-foreground leading-relaxed pl-0 sm:pl-11 line-clamp-2">
                                        {summary}
                                    </p>
                                )}

                                {t.subtopics && t.subtopics.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pl-0 sm:pl-11 pt-1">
                                        {t.subtopics.map((st, si) => (
                                            <span
                                                key={si}
                                                className="text-[10px] font-mono text-muted-foreground/80 bg-secondary/50 border border-border/30 px-2 py-0.5 rounded-md"
                                            >
                                                {st}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {filteredTopics.length === 0 && (
                        <div className="p-12 text-center text-xs text-muted-foreground font-mono rounded-xl border border-dashed border-border/40">
                            No chapters found matching &quot;{searchQuery}&quot;
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Edge-Attached Dynamic Island Navigation Rail ──────────────────────────────

function DynamicIslandNavRail({
    activeTab,
    onTabChange,
    onReset,
    isStudioMode,
    onToggleStudioMode,
    hasVideo,
    topicsCount,
    quizCount,
    interviewCount,
    onExportPdf,
    onDownloadMarkdown,
    onExportCmsJson,
    isExportingPdf,
    onDeleteNotebook,
    isDeleting,
}: {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    onReset: () => void;
    isStudioMode: boolean;
    onToggleStudioMode: () => void;
    hasVideo: boolean;
    topicsCount: number;
    quizCount?: number;
    interviewCount?: number;
    onExportPdf: () => void;
    onDownloadMarkdown: () => void;
    onExportCmsJson: () => void;
    isExportingPdf: boolean;
    onDeleteNotebook: () => void;
    isDeleting: boolean;
}) {
    const navItems: { id: TabType; label: string; icon: any; count?: number }[] = [
        { id: 'index', label: 'Curriculum Index', icon: Layers, count: topicsCount },
        { id: 'notes', label: 'Study Notes', icon: BookOpen },
        { id: 'mindmap', label: 'Concept Map', icon: GitBranch },
        { id: 'quiz', label: 'Self-Check Quiz', icon: HelpCircle, count: quizCount },
        { id: 'interview', label: 'Technical Q&A', icon: Briefcase, count: interviewCount },
    ];

    return (
        <aside className="h-full w-[64px] sm:w-[70px] shrink-0 border-r border-border/40 bg-card/25 backdrop-blur-xl flex flex-col justify-between items-center py-4 px-2 z-30 select-none">
            {/* Top Back Action */}
            <div className="shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onReset}
                            className="w-9 h-9 rounded-full bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-mono text-xs">
                        All Notebooks (Library)
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Center: Dynamic Island Navigation Capsule */}
            <div className="bg-secondary/40 border border-border/40 rounded-full p-1.5 flex flex-col items-center gap-1.5 shadow-sm backdrop-blur-xl">
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;

                    return (
                        <Tooltip key={item.id}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onTabChange(item.id)}
                                    className={cn(
                                        'relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all group',
                                        isActive
                                            ? 'bg-foreground text-background shadow-md shadow-foreground/10'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    )}
                                >
                                    <Icon className={cn('w-4 h-4 transition-transform group-hover:scale-105', isActive ? 'stroke-[2]' : 'stroke-[1.75]')} />

                                    {/* Unobtrusive Micro Indicator */}
                                    {item.count !== undefined && item.count > 0 && !isActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary absolute top-1.5 right-1.5 ring-2 ring-background" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-mono text-xs">
                                {item.label}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>

            {/* Bottom: Dynamic Island Utilities Capsule */}
            <div className="bg-secondary/40 border border-border/40 rounded-full p-1.5 flex flex-col items-center gap-1.5 shadow-sm backdrop-blur-xl shrink-0">
                {/* Focus Mode Toggle */}
                {hasVideo && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={onToggleStudioMode}
                                className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                                    !isStudioMode
                                        ? 'bg-primary/20 text-primary'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                )}
                            >
                                {!isStudioMode ? <Eye className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-mono text-xs">
                            {isStudioMode ? 'Focus Mode (Hide Video)' : 'Studio View (Show Video)'}
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Export Dropdown */}
                <DropdownMenu>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <button className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                                    {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Download className="w-3.5 h-3.5" />}
                                </button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-mono text-xs">
                            Export Package
                        </TooltipContent>
                    </Tooltip>

                    <DropdownMenuContent side="right" align="end" className="w-48 font-sans">
                        <DropdownMenuLabel className="text-[11px] font-mono text-muted-foreground">Export Options</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onExportPdf} disabled={isExportingPdf} className="gap-2 text-xs cursor-pointer">
                            <Printer className="w-3.5 h-3.5 text-primary" />
                            <span>Print / Vector PDF</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onDownloadMarkdown} className="gap-2 text-xs cursor-pointer">
                            <FileText className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Download Markdown (.md)</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onExportCmsJson} className="gap-2 text-xs cursor-pointer">
                            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Export CMS JSON (.json)</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Delete Notebook */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={onDeleteNotebook}
                            disabled={isDeleting}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-mono text-xs text-destructive">
                        Delete Notebook
                    </TooltipContent>
                </Tooltip>
            </div>
        </aside>
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

    const handleDeleteNotebook = async () => {
        if (!window.confirm(`Delete notebook "${notes.title}"? This cannot be undone.`)) {
            return;
        }

        try {
            setIsDeleting(true);
            const targetId = notes.notebookId || notes.videoId;
            if (targetId) {
                await api.deleteNotebook(targetId);
            }
            toast({
                title: 'Notebook Deleted',
                description: `"${notes.title}" has been deleted.`,
            });
            onReset();
        } catch (err: any) {
            console.error('Failed to delete notebook:', err);
            toast({
                title: 'Delete Failed',
                description: err?.message || 'Failed to delete notebook.',
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

    return (
        <TooltipProvider delayDuration={100}>
            {/* Fixed Edge-to-Edge Container (Zero Outer Scroll, Pure Shell) */}
            <div className="w-full h-full flex flex-row overflow-hidden bg-background">
                {/* ── Dynamic Island Edge Sidebar (Attached Flush to Left Boundary) ── */}
                <DynamicIslandNavRail
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onReset={onReset}
                    isStudioMode={isStudioMode}
                    onToggleStudioMode={() => setIsStudioMode(!isStudioMode)}
                    hasVideo={Boolean(videoId)}
                    topicsCount={currentNotes.index.length}
                    quizCount={currentNotes.quiz?.length}
                    interviewCount={currentNotes.interviewQA?.length}
                    onExportPdf={handleDownloadPdf}
                    onDownloadMarkdown={handleDownloadAll}
                    onExportCmsJson={handleExportCmsJson}
                    isExportingPdf={isExportingPdf}
                    onDeleteNotebook={handleDeleteNotebook}
                    isDeleting={isDeleting}
                />

                {/* ── Main Workspace Body (Fixed Header + Single Smooth Scroll Area) ── */}
                <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
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
                                            content={(activeNote as any).content || ''}
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
                            <div className="flex-1 overflow-hidden min-h-0">
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
            </div>
        </TooltipProvider>
    );
}
