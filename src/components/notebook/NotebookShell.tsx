import { useState } from 'react';
import {
    BookOpen, List, GitBranch, HelpCircle, Briefcase,
    ArrowLeft, Download, Clock, Hash, FileText, Loader2
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
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

    const handleDownloadPdf = async () => {
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
            console.error('PDF Export failed:', error);
            toast({ title: 'Export Failed', description: 'Could not generate PDF.', variant: 'destructive' });
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

    return (
        <div className="w-full fade-in">
            {/* ── Notebook Header ─────────────────────────────────────── */}
            <div className="mb-6">
                <Button variant="ghost" size="sm" onClick={onReset} className="mb-4 -ml-2">
                    <ArrowLeft className="w-4 h-4" />
                    Process another video
                </Button>

                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        {/* Notebook title with decorative bar */}
                        <div className="flex items-start gap-3">
                            <div className="mt-1 w-1.5 h-10 rounded-full bg-gradient-to-b from-primary to-violet-500 shrink-0" />
                            <div>
                                <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">{notes.title}</h2>
                                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />{notes.index.length} topics</span>
                                    <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />{wordCount.toLocaleString()} words</span>
                                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{readingTime} min read</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" onClick={handleDownloadAll} className="gap-2">
                            <FileText className="w-4 h-4" />
                            MD
                        </Button>
                        <Button onClick={handleDownloadPdf} disabled={isExportingPdf} className="gap-2">
                            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Export PDF
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── 5-Tab Bar ───────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start bg-card/60 border border-border/50 p-1 rounded-xl mb-6 overflow-x-auto gap-1 h-auto">
                    {[
                        { value: 'notes', icon: BookOpen, label: 'Running Notes' },
                        { value: 'index', icon: List, label: 'Index' },
                        { value: 'mindmap', icon: GitBranch, label: 'Mind Maps' },
                        { value: 'quiz', icon: HelpCircle, label: 'Quiz' },
                        { value: 'interview', icon: Briefcase, label: 'Interview' },
                    ].map(tab => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                        >
                            <tab.icon className="w-4 h-4 shrink-0" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* ── Running Notes Tab ──────────────────────────────────── */}
                <TabsContent value="notes" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-280px)] min-h-[600px]">
                        {/* Sidebar */}
                        <div className="lg:col-span-3 lg:overflow-hidden">
                            <TopicSidebar
                                topics={notes.index}
                                activeId={activeTopicId}
                                onSelect={(id) => {
                                    setActiveTopicId(id);
                                }}
                            />
                        </div>

                        {/* Notes pane */}
                        <div className="lg:col-span-9 overflow-hidden flex flex-col">
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
