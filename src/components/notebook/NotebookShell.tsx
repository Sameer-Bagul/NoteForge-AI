import { useState, useMemo } from 'react';
import {
    BookOpen, Layers, GitBranch, HelpCircle, Briefcase,
    ArrowLeft, ArrowRight, Download, Clock, FileText,
    Loader2, Tv, Trash2, Play, Search, X, Eye,
    Printer, Share2
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
            <div className="p-3 border-b border-border/30 space-y-2 shrink-0">
                <div className="flex items-center justify-between text-xs">
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

            <div className="flex-1 overflow-y-auto divide-y divide-border/15">
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
                                'w-full text-left px-3.5 py-2.5 text-xs transition-colors group relative flex items-start justify-between gap-2',
                                isActive
                                    ? 'bg-secondary/70 text-foreground font-medium'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                            )}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />
                            )}
                            <div className="flex items-start gap-2.5 min-w-0">
                                <span className={cn(
                                    'text-[11px] font-mono shrink-0 mt-0.5',
                                    isActive ? 'text-primary font-semibold' : 'text-muted-foreground/50'
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
        <div className="max-w-4xl mx-auto w-full px-6 sm:px-8 py-8 sm:py-12 space-y-10">
            {/* ── Editorial Hero Header (Un-slopped, Minimalist) ───────────────── */}
            <div className="space-y-4 pb-8 border-b border-border/30">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono tracking-widest text-muted-foreground uppercase font-semibold">
                        Syllabus & Index · {chaptersCount} {chaptersCount === 1 ? 'Chapter' : 'Chapters'} · ~{readingTime} Min Read
                    </span>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
                        {notes.title}
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
                        Comprehensive curriculum decomposed into {chaptersCount} {chaptersCount === 1 ? 'chapter' : 'chapters'} with video timestamps, structured study notes, architecture diagrams, and interactive self-checks.
                    </p>
                </div>

                {/* Minimal Action Controls */}
                <div className="pt-2 flex flex-wrap items-center gap-2.5">
                    <Button
                        onClick={onStartReading}
                        className="rounded-full px-5 h-8 sm:h-9 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 gap-2 shadow-sm transition-transform active:scale-95"
                    >
                        <span>Start Reading from Chapter 1</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Button>

                    {onOpenMindMap && notes.mindMaps && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onOpenMindMap}
                            className="rounded-full h-8 sm:h-9 px-3.5 text-xs gap-1.5 border-border/50 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
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
                            className="rounded-full h-8 sm:h-9 px-3.5 text-xs gap-1.5 border-border/50 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                        >
                            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Quiz ({notes.quiz?.length || 0})</span>
                        </Button>
                    )}

                    {onOpenInterview && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onOpenInterview}
                            className="rounded-full h-8 sm:h-9 px-3.5 text-xs gap-1.5 border-border/50 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                        >
                            <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Interview Q&A ({notes.interviewQA?.length || 0})</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Chapters Outline Header & Compact Search ───────────────────────── */}
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                        <span>Chapters</span>
                        <span className="text-xs font-mono text-muted-foreground font-normal">
                            ({filteredTopics.length})
                        </span>
                    </h2>

                    <div className="relative w-56 sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter chapters..."
                            className="w-full bg-secondary/30 border border-border/40 rounded-full pl-8 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 font-mono transition-colors"
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

                {/* ── Clean Syllabus Rows ────────────────────────────────────────── */}
                <div className="space-y-2">
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
                                className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border border-border/40 bg-card/25 hover:bg-card/75 hover:border-border/80 transition-all cursor-pointer gap-3"
                            >
                                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                    <span className="w-7 h-7 rounded-lg bg-secondary/70 group-hover:bg-foreground group-hover:text-background text-muted-foreground font-mono font-semibold text-xs flex items-center justify-center shrink-0 transition-colors">
                                        {String(originalIndex + 1).padStart(2, '0')}
                                    </span>
                                    <div className="space-y-1 min-w-0">
                                        <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                            {t.title}
                                        </h3>
                                        {t.subtopics && t.subtopics.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                {t.subtopics.slice(0, 5).map((st, si) => (
                                                    <span
                                                        key={si}
                                                        className="text-[10px] font-mono text-muted-foreground/80 bg-secondary/50 px-2 py-0.5 rounded"
                                                    >
                                                        {st}
                                                    </span>
                                                ))}
                                                {t.subtopics.length > 5 && (
                                                    <span className="text-[10px] font-mono text-muted-foreground/60">
                                                        +{t.subtopics.length - 5}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 sm:self-center self-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/20">
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
                                            className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary/60 hover:bg-primary/20 hover:text-primary text-muted-foreground transition-colors"
                                            title={`Play from ${t.timeDisplay}`}
                                        >
                                            <Play className="w-2.5 h-2.5 fill-current text-primary" />
                                            <span>{t.timeDisplay}</span>
                                        </button>
                                    )}

                                    <span className="text-xs font-mono text-muted-foreground/60 hidden sm:inline">
                                        ~{topicReadingTime}m
                                    </span>

                                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                                </div>
                            </div>
                        );
                    })}

                    {filteredTopics.length === 0 && (
                        <div className="p-8 text-center text-xs text-muted-foreground font-mono">
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
    const [activeTopicId, setActiveTopicId] = useState(notes.index[0]?.id);
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

                {/* ── Main Workspace Body (Fixed Header + Single Smooth Scroll Area) ── */}
                <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    {/* Minimalist Top App Navigation Bar (Un-slopped, single title) */}
                    <header className="h-13 border-b border-border/30 px-6 sm:px-8 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur-md select-none">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground/60 hover:text-muted-foreground cursor-pointer transition-colors" onClick={onReset}>
                                Library
                            </span>
                            <span className="text-muted-foreground/40 text-xs">/</span>
                            <span className="text-xs font-semibold text-foreground truncate max-w-sm sm:max-w-md md:max-w-lg">
                                {notes.title}
                            </span>
                        </div>

                        {/* Top Right Controls */}
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] font-mono text-muted-foreground/70 hidden sm:inline">
                                {notes.index.length} {notes.index.length === 1 ? 'Chapter' : 'Chapters'} · {wordCount.toLocaleString()} words · ~{readingTime}m read
                            </span>

                            {videoId && (
                                <Button
                                    variant={!isStudioMode ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setIsStudioMode(!isStudioMode)}
                                    className="h-7 text-xs rounded-full px-3 gap-1.5 transition-all"
                                >
                                    {!isStudioMode ? <Eye className="w-3.5 h-3.5 text-primary" /> : <Tv className="w-3.5 h-3.5 text-muted-foreground" />}
                                    <span className="text-xs">{!isStudioMode ? "Focus Mode" : "Hide Video"}</span>
                                </Button>
                            )}

                            {activeTab !== 'index' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('index')}
                                    className="h-7 text-xs rounded-full px-2.5 gap-1.5 text-muted-foreground hover:text-foreground"
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
                                    onOpenInterview={() => setActiveTab('interview')}
                                />
                            </div>
                        )}

                        {/* TAB 2: STUDY NOTES (Running Notes Viewer) */}
                        {activeTab === 'notes' && (
                            <div className="flex-1 overflow-hidden min-h-0 flex flex-row">
                                {/* Left Column: Video & Topic Sidebar */}
                                <div className={cn(
                                    "h-full flex flex-col border-r border-border/30 overflow-hidden shrink-0 transition-all duration-200",
                                    isStudioMode && videoId
                                        ? "w-80 lg:w-96"
                                        : "w-64 lg:w-72"
                                )}>
                                    {/* Video Player (when Studio Mode is on) */}
                                    {isStudioMode && videoId && (
                                        <div className="aspect-video w-full bg-black border-b border-border/30 shrink-0">
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
                                    <div className="flex-1 overflow-hidden">
                                        <TopicSidebar
                                            topics={notes.index}
                                            activeId={activeTopicId}
                                            onSelect={(id) => setActiveTopicId(id)}
                                            onSeek={(secs) => {
                                                setSeekTime(secs);
                                                if (!isStudioMode) setIsStudioMode(true);
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Notebook Reader (Smooth Centered Scrolling Canvas) */}
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
                                            isFocusMode={!isStudioMode}
                                            onToggleFocusMode={videoId ? () => setIsStudioMode(!isStudioMode) : undefined}
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
                                    notebookId={notes.notebookId || notes.videoId}
                                    topics={mapTopics}
                                    fullContent={notes.fullContent}
                                    existingMindMaps={notes.mindMaps}
                                />
                            </div>
                        )}

                        {/* TAB 4: SELF-CHECK QUIZZES */}
                        {activeTab === 'quiz' && (
                            <div className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-8">
                                <div className="max-w-4xl mx-auto">
                                    <QuizTab
                                        notebookId={notes.notebookId || notes.videoId}
                                        topicTitles={topicTitles}
                                        fullContent={notes.fullContent}
                                        existingQuiz={notes.quiz}
                                    />
                                </div>
                            </div>
                        )}

                        {/* TAB 5: TECHNICAL INTERVIEW PREP */}
                        {activeTab === 'interview' && (
                            <div className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-8">
                                <div className="max-w-4xl mx-auto">
                                    <InterviewTab
                                        notebookId={notes.notebookId || notes.videoId}
                                        topicTitles={topicTitles}
                                        fullContent={notes.fullContent}
                                        existingQuestions={notes.interviewQA}
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
