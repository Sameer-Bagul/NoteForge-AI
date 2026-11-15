import { useState, useMemo } from 'react';
import {
    BookOpen, Layers, GitBranch, HelpCircle, Briefcase,
    ArrowLeft, ArrowRight, Download, Clock, Hash, FileText,
    Loader2, Sparkles, Tv, Trash2, Play, Search, X, Eye, EyeOff,
    Check, Share2, Printer, ChevronRight, ChevronLeft, Bookmark
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { isTauri } from '@/services/tauri';
import { Button } from '@/components/ui/button';
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
import { VideoNotes } from '@/types';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

interface NotebookShellProps {
    notes: VideoNotes;
    onReset: () => void;
}

type TabType = 'index' | 'notes' | 'mindmap' | 'quiz' | 'interview';

// ─── Topic Sidebar ─────────────────────────────────────────────────────────────

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
        <nav className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden h-full flex flex-col shadow-xs">
            <div className="p-3 border-b border-border/40 bg-card/80 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest font-mono">Chapters</p>
                    <span className="text-[11px] font-mono text-muted-foreground/80 bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                        {topics.length} items
                    </span>
                </div>
                {/* Fast Chapter Search Filter */}
                <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter chapters..."
                        className="w-full bg-background/60 border border-border/50 rounded-lg pl-7 pr-6 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
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

            <div className="flex-1 overflow-y-auto divide-y divide-border/20">
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
                                'w-full text-left px-3.5 py-3 text-xs sm:text-sm transition-all group relative',
                                isActive
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'text-foreground/75 hover:bg-muted/40 hover:text-foreground',
                            )}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                            )}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <span className={cn(
                                        'text-xs mt-0.5 shrink-0 font-mono font-medium',
                                        isActive ? 'text-primary font-bold' : 'text-muted-foreground/60'
                                    )}>
                                        {String(originalIndex + 1).padStart(2, '0')}
                                    </span>
                                    <span className="leading-snug text-xs line-clamp-2">{t.title}</span>
                                </div>
                                {t.timeDisplay && (
                                    <span
                                        className={cn(
                                            "text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 transition-colors",
                                            isActive
                                                ? "bg-primary/20 text-primary font-semibold"
                                                : "bg-muted/70 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                                        )}
                                    >
                                        {t.timeDisplay}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                        No chapters match &quot;{search}&quot;
                    </div>
                )}
            </div>
        </nav>
    );
}

// ─── Curriculum Index & Syllabus Hub ──────────────────────────────────────────

function IndexPanel({
    topics,
    notes,
    onSelectTopic,
    onSeek,
    onStartReading,
    onOpenMindMap,
    onOpenQuiz,
}: {
    topics: VideoNotes['index'];
    notes: VideoNotes;
    onSelectTopic?: (id: string) => void;
    onSeek?: (seconds: number) => void;
    onStartReading?: () => void;
    onOpenMindMap?: () => void;
    onOpenQuiz?: () => void;
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

    return (
        <div className="w-full space-y-6 max-w-7xl mx-auto pb-12">
            {/* ── Hero Syllabus Overview Banner ─────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card/85 to-primary/5 p-6 md:p-8 shadow-sm">
                <div className="relative z-10 space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-semibold uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5" />
                            Curriculum Syllabus & Index
                        </span>
                        <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border border-border/40">
                            {topics.length} Chapters
                        </span>
                        <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border border-border/40">
                            ~{readingTime} min total read
                        </span>
                    </div>

                    <div className="space-y-2 max-w-3xl">
                        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight leading-tight">
                            {notes.title}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Complete curriculum decomposed into {topics.length} structured chapters with timestamped video markers, deep conceptual explanations, code implementations, and interactive knowledge checks.
                        </p>
                    </div>

                    {/* Stats & Quick Actions Row */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-border/40">
                        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5 text-primary" />
                                <span>{topics.length} Topics Decomposed</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-primary" />
                                <span>{wordCount.toLocaleString()} Total Words</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                <span>~{readingTime} min Reading Time</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            {onOpenMindMap && notes.mindMaps && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onOpenMindMap}
                                    className="gap-1.5 h-8 text-xs font-medium"
                                >
                                    <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Mind Map</span>
                                </Button>
                            )}

                            {onOpenQuiz && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onOpenQuiz}
                                    className="gap-1.5 h-8 text-xs font-medium"
                                >
                                    <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Self-Check Quiz</span>
                                </Button>
                            )}

                            <Button
                                size="sm"
                                onClick={onStartReading}
                                className="gap-2 h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                            >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Start Reading from Chapter 1</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Search & Filter Bar ───────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div>
                    <h2 className="text-base font-bold text-foreground tracking-tight">Chapters Outline</h2>
                    <p className="text-xs text-muted-foreground">
                        {searchQuery ? `Showing ${filteredTopics.length} of ${topics.length} chapters` : `All ${topics.length} chapters organized in chronological order`}
                    </p>
                </div>

                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search chapters or subtopics..."
                        className="w-full bg-card/80 border border-border/70 rounded-xl pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Chapter Cards Grid ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                {filteredTopics.map((t) => {
                    const originalIndex = topics.findIndex(item => item.id === t.id);
                    const noteForTopic = notes.notes.find(n => n.topicId === t.id);
                    const topicWordCount = noteForTopic?.content
                        ? noteForTopic.content.split(/\s+/).filter(Boolean).length
                        : 0;
                    const topicReadingTime = Math.max(1, Math.ceil(topicWordCount / 200));

                    return (
                        <div
                            key={t.id}
                            onClick={() => onSelectTopic?.(t.id)}
                            className="group flex flex-col justify-between rounded-2xl border border-border/70 bg-card/75 hover:bg-card hover:border-primary/50 transition-all duration-200 p-5 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
                        >
                            <div className="space-y-3.5">
                                {/* Top Badge & Timestamp */}
                                <div className="flex items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="w-8 h-8 rounded-xl bg-primary/10 group-hover:bg-primary text-primary group-hover:text-primary-foreground font-mono font-bold text-xs flex items-center justify-center shrink-0 transition-colors shadow-xs">
                                            {String(originalIndex + 1).padStart(2, '0')}
                                        </span>
                                        <span className="text-[11px] font-mono text-muted-foreground/80 uppercase tracking-wider">
                                            Chapter {originalIndex + 1}
                                        </span>
                                    </div>

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
                                            className="shrink-0 flex items-center gap-1.5 text-[11px] font-mono font-semibold text-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground px-2.5 py-1 rounded-lg transition-colors border border-primary/20"
                                            title={`Play video from ${t.timeDisplay}`}
                                        >
                                            <Play className="w-3 h-3 fill-current" />
                                            <span>{t.timeDisplay}</span>
                                        </button>
                                    )}
                                </div>

                                {/* Title */}
                                <div>
                                    <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                                        {t.title}
                                    </h3>
                                </div>

                                {/* Subtopic Badges */}
                                {t.subtopics && t.subtopics.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {t.subtopics.slice(0, 4).map((st, si) => (
                                            <span
                                                key={si}
                                                className="px-2 py-0.5 rounded-md bg-secondary/60 text-[11px] text-muted-foreground font-medium border border-border/30 line-clamp-1"
                                            >
                                                {st}
                                            </span>
                                        ))}
                                        {t.subtopics.length > 4 && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-muted/70 text-[10px] text-muted-foreground font-mono">
                                                +{t.subtopics.length - 4} more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Card Footer: Word Count & Read CTA */}
                            <div className="pt-3.5 mt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground font-mono">
                                <span className="flex items-center gap-1 text-[11px]">
                                    <Clock className="w-3 h-3 text-muted-foreground/60" />
                                    ~{topicReadingTime}m read
                                </span>
                                <span className="group-hover:text-primary transition-colors flex items-center gap-1 font-semibold text-xs font-sans">
                                    <span>Read Notes</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </span>
                            </div>
                        </div>
                    );
                })}

                {filteredTopics.length === 0 && (
                    <div className="col-span-full p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 space-y-3">
                        <Bookmark className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-sm font-semibold text-foreground">No chapters match your search</p>
                        <p className="text-xs text-muted-foreground">Try searching for a different keyword or clear your filter.</p>
                        <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="mt-2 text-xs">
                            Clear Search Filter
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Vertical Navigation Rail ──────────────────────────────────────────────────

function VerticalNavRail({
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
        <aside className="w-full md:w-16 lg:w-20 shrink-0 flex md:flex-col items-center justify-between p-2 md:py-3.5 bg-card/80 border border-border/70 rounded-2xl shadow-xs backdrop-blur-md gap-2 md:gap-3 z-20">
            {/* Top / Brand: Back to Library */}
            <div className="flex md:flex-col items-center gap-1.5 shrink-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onReset}
                            className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-mono text-xs">
                        All Notebooks (Library)
                    </TooltipContent>
                </Tooltip>

                <div className="w-8 h-px bg-border/60 my-1 hidden md:block" />
            </div>

            {/* Middle: Tab Navigation Items */}
            <div className="flex md:flex-col items-center gap-1.5 flex-1 overflow-x-auto md:overflow-visible">
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;

                    return (
                        <Tooltip key={item.id}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onTabChange(item.id)}
                                    className={cn(
                                        'relative flex md:flex-col items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl transition-all group',
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                                    )}
                                >
                                    <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-105" />
                                    <span className="text-[9px] font-mono uppercase tracking-tight hidden lg:block mt-0.5 font-semibold">
                                        {item.id === 'index' ? 'Index' : item.id === 'notes' ? 'Notes' : item.id === 'mindmap' ? 'Map' : item.id === 'quiz' ? 'Quiz' : 'Prep'}
                                    </span>

                                    {/* Small count pill */}
                                    {item.count !== undefined && item.count > 0 && item.id !== 'notes' && (
                                        <span className={cn(
                                            'absolute -top-1 -right-1 text-[9px] font-mono px-1 rounded-full border',
                                            isActive
                                                ? 'bg-background text-primary border-primary/40 font-bold'
                                                : 'bg-muted text-muted-foreground border-border/80'
                                        )}>
                                            {item.count}
                                        </span>
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

            {/* Bottom: Utilities (Focus Mode, Export, Delete) */}
            <div className="flex md:flex-col items-center gap-1.5 shrink-0">
                <div className="w-8 h-px bg-border/60 my-1 hidden md:block" />

                {/* Focus Mode / Video Hide-Show Toggle */}
                {hasVideo && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={onToggleStudioMode}
                                className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                                    !isStudioMode
                                        ? 'bg-primary/20 text-primary border border-primary/40 shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                                )}
                            >
                                {!isStudioMode ? <Eye className="w-4 h-4 text-primary" /> : <Tv className="w-4 h-4" />}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-mono text-xs">
                            {isStudioMode ? 'Focus Mode (Hide Video)' : 'Studio View (Show Video)'}
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Export Dropdown Menu */}
                <DropdownMenu>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                >
                                    {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Download className="w-4 h-4" />}
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-mono text-xs">
                            Export Notebook
                        </TooltipContent>
                    </Tooltip>

                    <DropdownMenuContent side="right" align="end" className="w-52 font-sans">
                        <DropdownMenuLabel className="text-xs font-mono text-muted-foreground">Export Package</DropdownMenuLabel>
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

                {/* Delete Notebook Action */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onDeleteNotebook}
                            disabled={isDeleting}
                            className="w-10 h-10 rounded-xl text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
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
    const [activeTopicId, setActiveTopicId] = useState(notes.index[0]?.id);
    // User requested showing the index first
    const [activeTab, setActiveTab] = useState<TabType>('index');
    const [isStudioMode, setIsStudioMode] = useState(true);
    const [seekTime, setSeekTime] = useState<number | null>(null);

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
        <TooltipProvider delayDuration={150}>
            <div className="w-full flex flex-col md:flex-row gap-4 h-[calc(100vh-80px)] min-h-[720px] max-w-[1720px] mx-auto">
                {/* ── Left Vertical Navigation Rail ─────────────────────────── */}
                <VerticalNavRail
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onReset={onReset}
                    isStudioMode={isStudioMode}
                    onToggleStudioMode={() => setIsStudioMode(!isStudioMode)}
                    hasVideo={Boolean(videoId)}
                    topicsCount={notes.index.length}
                    quizCount={notes.quiz?.length}
                    interviewCount={notes.interviewQA?.length}
                    onExportPdf={handleDownloadPdf}
                    onDownloadMarkdown={handleDownloadAll}
                    onExportCmsJson={handleExportCmsJson}
                    isExportingPdf={isExportingPdf}
                    onDeleteNotebook={handleDeleteNotebook}
                    isDeleting={isDeleting}
                />

                {/* ── Main Workspace Body ───────────────────────────────────── */}
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Top Workspace Header Bar */}
                    <div className="mb-3 pb-3 border-b border-border/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-primary uppercase font-bold tracking-wider">
                                    {activeTab === 'index' ? 'Curriculum Overview' : activeTab === 'notes' ? 'Study Notebook' : activeTab === 'mindmap' ? 'Concept Map' : activeTab === 'quiz' ? 'Self-Check Review' : 'Interview Q&A'}
                                </span>
                                {videoId && (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40">
                                        {!isStudioMode ? '🎯 Focus Mode (Video Hidden)' : '📺 Studio View (Video Docked)'}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-base sm:text-lg font-bold text-foreground truncate max-w-xl">
                                {notes.title}
                            </h2>
                        </div>

                        {/* Top quick controls */}
                        <div className="flex items-center gap-2 shrink-0">
                            {videoId && (
                                <Button
                                    variant={!isStudioMode ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setIsStudioMode(!isStudioMode)}
                                    className="gap-1.5 h-8 text-xs font-medium"
                                    title={isStudioMode ? "Hide video to focus on notes" : "Restore video player"}
                                >
                                    {!isStudioMode ? <Eye className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
                                    <span>{!isStudioMode ? "Focus Mode" : "Hide Video"}</span>
                                </Button>
                            )}

                            {activeTab !== 'index' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setActiveTab('index')}
                                    className="gap-1.5 h-8 text-xs"
                                >
                                    <Layers className="w-3.5 h-3.5 text-primary" />
                                    <span>View Index</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* ── Active Tab Content Area ───────────────────────────── */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {/* ── TAB 1: CURRICULUM INDEX (Default) ─────────────── */}
                        {activeTab === 'index' && (
                            <div className="flex-1 overflow-y-auto pr-1">
                                <IndexPanel
                                    topics={notes.index}
                                    notes={notes}
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
                                        if (notes.index[0]?.id) {
                                            setActiveTopicId(notes.index[0].id);
                                        }
                                        setActiveTab('notes');
                                    }}
                                    onOpenMindMap={notes.mindMaps ? () => setActiveTab('mindmap') : undefined}
                                    onOpenQuiz={() => setActiveTab('quiz')}
                                />
                            </div>
                        )}

                        {/* ── TAB 2: STUDY NOTES (Running Notes Viewer) ─────── */}
                        {activeTab === 'notes' && (
                            <div className="flex-1 overflow-hidden flex flex-col">
                                {/* Focus Mode Banner when video is hidden */}
                                {!isStudioMode && videoId && (
                                    <div className="mb-3 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs text-primary font-mono shrink-0">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                                            <span><strong>Focus Mode Active:</strong> Video player is hidden for distraction-free reading.</span>
                                        </div>
                                        <button
                                            onClick={() => setIsStudioMode(true)}
                                            className="underline hover:text-foreground font-semibold ml-2 shrink-0"
                                        >
                                            Show Video Player 📺
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-hidden">
                                    {/* Left Column: Video Player & Topic Sidebar */}
                                    <div className={cn(
                                        "flex flex-col gap-3 overflow-hidden h-full",
                                        isStudioMode && videoId
                                            ? "lg:col-span-5 xl:col-span-4"
                                            : "lg:col-span-4 xl:col-span-3"
                                    )}>
                                        {/* Optional YouTube Player */}
                                        {isStudioMode && videoId && (
                                            <div className="rounded-2xl overflow-hidden border border-border/70 bg-black shadow-sm aspect-video shrink-0 relative group">
                                                <iframe
                                                    key={seekTime !== null ? `yt-${seekTime}` : 'yt-initial'}
                                                    src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1${seekTime !== null ? `&start=${seekTime}&autoplay=1` : ''}`}
                                                    title="YouTube Video Player"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                    className="w-full h-full border-0"
                                                />
                                                {/* Overlay minimize button */}
                                                <button
                                                    onClick={() => setIsStudioMode(false)}
                                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white/80 hover:text-white transition-opacity opacity-0 group-hover:opacity-100 text-xs flex items-center gap-1"
                                                    title="Hide video (Focus Mode)"
                                                >
                                                    <EyeOff className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Chapter Topics Sidebar */}
                                        <div className="flex-1 overflow-hidden">
                                            <TopicSidebar
                                                topics={notes.index}
                                                activeId={activeTopicId}
                                                onSelect={(id) => {
                                                    setActiveTopicId(id);
                                                }}
                                                onSeek={(secs) => {
                                                    setSeekTime(secs);
                                                    if (!isStudioMode) setIsStudioMode(true);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Right Column: Complete Notebook Page Canvas */}
                                    <div className={cn(
                                        "overflow-hidden flex flex-col h-full",
                                        isStudioMode && videoId
                                            ? "lg:col-span-7 xl:col-span-8"
                                            : "lg:col-span-8 xl:col-span-9"
                                    )}>
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
                                                isFocusMode={!isStudioMode}
                                                onToggleFocusMode={videoId ? () => setIsStudioMode(!isStudioMode) : undefined}
                                                onSeek={(secs) => {
                                                    setSeekTime(secs);
                                                    if (!isStudioMode) setIsStudioMode(true);
                                                }}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full bg-card/60 rounded-2xl border border-dashed border-border/70 p-8 text-center space-y-3">
                                                <BookOpen className="w-8 h-8 text-muted-foreground/40" />
                                                <p className="text-sm font-semibold text-foreground">Select a chapter from the sidebar</p>
                                                <p className="text-xs text-muted-foreground">Or return to the Index to browse the complete curriculum syllabus.</p>
                                                <Button size="sm" variant="outline" onClick={() => setActiveTab('index')} className="text-xs">
                                                    Open Curriculum Index
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TAB 3: VISUAL MIND MAP ─────────────────────────── */}
                        {activeTab === 'mindmap' && (
                            <div className="flex-1 overflow-hidden">
                                <MindMapTab
                                    notebookId={notes.notebookId || notes.videoId}
                                    topics={mapTopics}
                                    fullContent={notes.fullContent}
                                    existingMindMaps={notes.mindMaps}
                                />
                            </div>
                        )}

                        {/* ── TAB 4: INTERACTIVE QUIZZES ─────────────────────── */}
                        {activeTab === 'quiz' && (
                            <div className="flex-1 overflow-hidden">
                                <QuizTab
                                    notebookId={notes.notebookId || notes.videoId}
                                    topicTitles={topicTitles}
                                    fullContent={notes.fullContent}
                                    existingQuiz={notes.quiz}
                                />
                            </div>
                        )}

                        {/* ── TAB 5: TECHNICAL INTERVIEW PREP ────────────────── */}
                        {activeTab === 'interview' && (
                            <div className="flex-1 overflow-hidden">
                                <InterviewTab
                                    notebookId={notes.notebookId || notes.videoId}
                                    topicTitles={topicTitles}
                                    fullContent={notes.fullContent}
                                    existingQuestions={notes.interviewQA}
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </TooltipProvider>
    );
}
