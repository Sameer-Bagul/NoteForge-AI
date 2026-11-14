import { useState } from 'react';
import {
    BookOpen, List, GitBranch, HelpCircle, Briefcase,
    ArrowLeft, Download, Clock, Hash, FileText, Loader2, Sparkles, Tv, Columns2, Trash2
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { isTauri } from '@/services/tauri';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// ─── Topic Sidebar ─────────────────────────────────────────────────────────────

function TopicSidebar({
    topics,
    activeId,
    onSelect,
}: {
    topics: { id: string; title: string; subtopics?: string[] }[];
    activeId?: string;
    onSelect: (id: string) => void;
}) {
    return (
        <nav className="rounded-xl border border-border/60 bg-card/60 overflow-hidden h-full flex flex-col">
            <div className="px-4 py-3 border-b border-border/40 bg-card/80">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Topics</p>
            </div>
            <div className="flex-1 overflow-y-auto">
                {topics.map((t, i) => (
                    <button
                        key={t.id}
                        onClick={() => onSelect(t.id)}
                        className={cn(
                            'w-full text-left px-4 py-3 text-sm border-b border-border/20 transition-colors group',
                            activeId === t.id
                                ? 'bg-primary/10 text-primary font-medium border-l-2 border-l-primary'
                                : 'text-foreground/70 hover:bg-muted/50 hover:text-foreground border-l-2 border-l-transparent',
                        )}
                    >
                        <div className="flex items-start gap-2">
                            <span className={cn('text-xs mt-0.5 shrink-0 font-mono', activeId === t.id ? 'text-primary' : 'text-muted-foreground/60')}>
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="leading-snug">{t.title}</span>
                        </div>
                    </button>
                ))}
            </div>
        </nav>
    );
}

// ─── Index Panel ───────────────────────────────────────────────────────────────

function IndexPanel({ topics }: { topics: VideoNotes['index'] }) {
    return (
        <div className="max-w-2xl mx-auto space-y-3">
            {topics.map((t, i) => (
                <div key={t.id} className="rounded-xl border border-border/50 bg-card/60 p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {i + 1}
                        </span>
                        <h3 className="font-semibold text-foreground">{t.title}</h3>
                    </div>
                    {t.subtopics?.length > 0 && (
                        <div className="ml-11 flex flex-wrap gap-1.5">
                            {t.subtopics.map((st, si) => (
                                <span key={si} className="px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground text-xs">
                                    {st}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── NotebookShell ─────────────────────────────────────────────────────────────

export function NotebookShell({ notes, onReset }: NotebookShellProps) {
    const [activeTopicId, setActiveTopicId] = useState(notes.index[0]?.id);
    const [activeTab, setActiveTab] = useState('notes');
    const [isStudioMode, setIsStudioMode] = useState(true);
    const [seekTime, setSeekTime] = useState<number | null>(null);

    const rawId = notes.videoId || (notes as any).id || (notes.notes?.[0] as any)?.videoSources?.[0]?.videoId || '';
    const videoId = rawId.includes('watch?v=') 
        ? rawId.split('watch?v=')[1]?.split('&')[0] 
        : rawId.includes('youtu.be/') 
        ? rawId.split('youtu.be/')[1]?.split('?')[0] 
        : rawId;

    const activeNote = notes.notes.find(n => n.topicId === activeTopicId);
    const wordCount = notes.fullContent.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

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

    const { settings } = useSettings();
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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
            
            // Assuming response is a blob
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

    // Build mindmap topics list
    const mapTopics = notes.index.map(t => ({
        id: t.id,
        title: t.title,
        subtopics: t.subtopics ?? [],
    }));

    const topicTitles = notes.index.map(t => t.title);

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
        
        // Copy to clipboard
        navigator.clipboard.writeText(jsonString);

        // Download JSON file
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

    return (
        <div className="w-full">
            {/* ── Desktop Notebook Toolbar ─────────────────────────────── */}
            <div className="mb-4 space-y-3">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onReset}
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 -ml-2"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>All Notebooks</span>
                    </Button>

                    <div className="flex items-center gap-1.5">
                        {videoId && (
                            <Button
                                variant={isStudioMode ? "default" : "outline"}
                                size="sm"
                                onClick={() => setIsStudioMode(!isStudioMode)}
                                className="gap-1.5 h-8 text-xs"
                            >
                                <Tv className="w-3.5 h-3.5" />
                                <span>{isStudioMode ? "Studio View" : "Reader View"}</span>
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handleExportCmsJson} className="gap-1.5 h-8 text-xs">
                            <span>CMS JSON</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDownloadAll} className="gap-1.5 h-8 text-xs">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Markdown</span>
                        </Button>
                        <Button size="sm" onClick={handleDownloadPdf} disabled={isExportingPdf} className="gap-1.5 h-8 text-xs">
                            {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            <span>Print / PDF</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeleteNotebook}
                            disabled={isDeleting}
                            className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                            title="Delete this notebook"
                        >
                            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            <span>Delete</span>
                        </Button>
                    </div>
                </div>

                {/* Notebook Title Bar */}
                <div className="pb-3 border-b border-border/40">
                    <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-tight">
                        {notes.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-muted-foreground font-mono tabular-nums">
                        <span className="flex items-center gap-1.5"><Hash className="w-3 h-3 text-muted-foreground" />{notes.index.length} topics</span>
                        <span className="flex items-center gap-1.5"><FileText className="w-3 h-3 text-muted-foreground" />{wordCount.toLocaleString()} words</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground" />{readingTime} min read</span>
                    </div>
                </div>
            </div>

            {/* ── 5-Tab Bar ───────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start bg-muted/30 border border-border/50 p-0.5 rounded-lg mb-4 overflow-x-auto gap-0.5 h-9">
                    {[
                        { value: 'notes', icon: BookOpen, label: 'Running Notes' },
                        { value: 'index', icon: List, label: 'Topic Outline' },
                        { value: 'mindmap', icon: GitBranch, label: 'Mind Map' },
                        { value: 'quiz', icon: HelpCircle, label: 'Quiz' },
                        { value: 'interview', icon: Briefcase, label: 'Interview Prep' },
                    ].map(tab => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-colors"
                        >
                            <tab.icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* ── Running Notes Tab ──────────────────────────────────── */}
                <TabsContent value="notes" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-280px)] min-h-[600px]">
                        {/* Sidebar / Left Column */}
                        <div className={cn(
                            "flex flex-col gap-4 overflow-hidden",
                            isStudioMode && videoId ? "lg:col-span-5" : "lg:col-span-3"
                        )}>
                            {isStudioMode && videoId && (
                                <div className="rounded-xl overflow-hidden border border-border/60 bg-black shadow-sm aspect-video shrink-0">
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
                            <div className="flex-1 overflow-hidden">
                                <TopicSidebar
                                    topics={notes.index}
                                    activeId={activeTopicId}
                                    onSelect={(id) => {
                                        setActiveTopicId(id);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Notes pane */}
                        <div className={cn(
                            "overflow-hidden flex flex-col",
                            isStudioMode && videoId ? "lg:col-span-7" : "lg:col-span-9"
                        )}>
                            {activeNote ? (
                                <>
                                    <div className="flex items-center gap-2 mb-3 shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                        <h3 className="font-semibold text-foreground">{(activeNote as any).topicTitle || (activeNote as any).title}</h3>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <RunningNotesViewer
                                            content={(activeNote as any).content || ''}
                                            title={(activeNote as any).topicTitle || (activeNote as any).title}
                                            className="h-full"
                                            onSeek={(secs) => {
                                                setSeekTime(secs);
                                                if (!isStudioMode) setIsStudioMode(true);
                                            }}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-center h-full bg-card rounded-xl border border-border/60">
                                    <p className="text-muted-foreground text-sm">Select a topic from the sidebar</p>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* ── Index Tab ─────────────────────────────────────────── */}
                <TabsContent value="index" className="mt-0">
                    <IndexPanel topics={notes.index} />
                </TabsContent>

                {/* ── Mind Maps Tab ─────────────────────────────────────── */}
                <TabsContent value="mindmap" className="mt-0">
                    <MindMapTab
                        notebookId={notes.notebookId || notes.videoId}
                        topics={mapTopics}
                        fullContent={notes.fullContent}
                        existingMindMaps={notes.mindMaps}
                    />
                </TabsContent>

                {/* ── Quiz Tab ──────────────────────────────────────────── */}
                <TabsContent value="quiz" className="mt-0">
                    <QuizTab
                        notebookId={notes.notebookId || notes.videoId}
                        topicTitles={topicTitles}
                        fullContent={notes.fullContent}
                        existingQuiz={notes.quiz}
                    />
                </TabsContent>

                {/* ── Interview Tab ─────────────────────────────────────── */}
                <TabsContent value="interview" className="mt-0">
                    <InterviewTab
                        notebookId={notes.notebookId || notes.videoId}
                        topicTitles={topicTitles}
                        fullContent={notes.fullContent}
                        existingQuestions={notes.interviewQA}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
