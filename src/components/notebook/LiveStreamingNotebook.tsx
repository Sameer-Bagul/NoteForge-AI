import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Tv,
  FileText,
  Activity,
  Layers,
  Zap,
  Play,
  ArrowRight,
  Loader2,
  Check,
  Copy,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RunningNotesViewer } from './RunningNotesViewer';
import ProcessingView from '@/components/ProcessingView';
import { SessionTelemetryCard } from '@/components/SessionTelemetryCard';
import { StudyBlueprintCard } from '@/components/StudyBlueprintCard';
import { ActivityStream } from '@/components/ActivityStream';
import { SourceVideoCard } from '@/components/SourceVideoCard';
import { VideoNotes, ProcessingStep, VideoInfo, ProcessingStatus } from '@/types';
import { useSettings } from '@/context/SettingsContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LiveStreamingNotebookProps {
  jobId?: string;
  videoInfo?: VideoInfo;
  videoCount?: number;
  processedVideos?: number;
  index?: { topics: any[] };
  notes?: VideoNotes;
  steps: ProcessingStep[];
  currentStep: number;
  status: ProcessingStatus;
  logs: any[];
  onReset: () => void;
}

export const LiveStreamingNotebook: React.FC<LiveStreamingNotebookProps> = ({
  jobId,
  videoInfo,
  videoCount,
  processedVideos,
  index,
  notes,
  steps,
  currentStep,
  status,
  logs,
  onReset,
}) => {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'notebook' | 'diagnostics'>('notebook');
  const [isStudioVideo, setIsStudioVideo] = useState(false);
  const [seekTime, setSeekTime] = useState<number | null>(null);

  // Extract all curriculum topics
  const topicsList = useMemo(() => {
    if (notes?.index && notes.index.length > 0) {
      return notes.index;
    }
    if (index?.topics && index.topics.length > 0) {
      return index.topics.map((t: any) => ({
        id: t.id,
        title: t.title,
        subtopics: t.subtopics?.map((st: any) => (typeof st === 'string' ? st : (st?.title || ''))) || [],
        startTime: t.startTime,
        endTime: t.endTime,
        timeDisplay: t.timeDisplay,
      }));
    }
    return [];
  }, [notes?.index, index?.topics]);

  // Identify currently streaming topic
  const activeStreamingNote = notes?.notes?.length
    ? notes.notes[notes.notes.length - 1]
    : undefined;

  const activeStreamingTopicId = activeStreamingNote?.topicId;

  // Selected topic in the UI (defaults to the currently streaming topic)
  const [selectedTopicId, setSelectedTopicId] = useState<string | undefined>(
    activeStreamingTopicId || topicsList[0]?.id
  );
  const [userSelectedTopic, setUserSelectedTopic] = useState(false);

  // Automatically follow new topics as they begin generating, unless user clicked a past topic
  useEffect(() => {
    if (!userSelectedTopic && activeStreamingTopicId) {
      setSelectedTopicId(activeStreamingTopicId);
    }
  }, [activeStreamingTopicId, userSelectedTopic]);

  // If no topic selected yet, select first available
  useEffect(() => {
    if (!selectedTopicId && topicsList.length > 0) {
      setSelectedTopicId(topicsList[0].id);
    }
  }, [topicsList, selectedTopicId]);

  // Get active note for display
  const activeTopic = topicsList.find((t) => t.id === selectedTopicId);
  const activeNote = notes?.notes?.find((n) => n.topicId === selectedTopicId);

  const isCurrentlyStreaming =
    Boolean(activeStreamingTopicId) &&
    selectedTopicId === activeStreamingTopicId &&
    status !== 'complete';

  // Video ID resolution
  const rawVideoId =
    videoInfo?.id ||
    notes?.videoId ||
    (notes as any)?.id ||
    '';
  const videoId = rawVideoId.includes('watch?v=')
    ? rawVideoId.split('watch?v=')[1]?.split('&')[0]
    : rawVideoId.includes('youtu.be/')
    ? rawVideoId.split('youtu.be/')[1]?.split('?')[0]
    : rawVideoId;

  // Overall pipeline metrics
  const completedTopicsCount = useMemo(() => {
    if (!notes?.notes) return 0;
    // Notes with non-empty content that are before the active streaming one
    return notes.notes.filter(
      (n) => n.content && n.content.length > 20 && n.topicId !== activeStreamingTopicId
    ).length;
  }, [notes?.notes, activeStreamingTopicId]);

  const totalTopicsCount = Math.max(topicsList.length, 1);
  const percentComplete = Math.min(
    100,
    Math.round((completedTopicsCount / totalTopicsCount) * 100)
  );

  // Total words generated so far
  const totalWordsGenerated = useMemo(() => {
    if (!notes?.notes) return 0;
    return notes.notes.reduce((acc, n) => {
      return acc + (n.content ? n.content.split(/\s+/).length : 0);
    }, 0);
  }, [notes?.notes]);

  const activeModel =
    settings.providers.find((p) => p.provider === 'ollama')?.model ||
    settings.providers.find((p) => p.enabled)?.model ||
    'llama3.2:1b';

  const handleCopyCurrentNote = async () => {
    if (!activeNote?.content) return;
    await navigator.clipboard.writeText(activeNote.content);
    toast({ title: 'Copied!', description: 'Current chapter notes copied to clipboard.' });
  };

  const handleDownloadCurrentNote = () => {
    if (!activeNote?.content) return;
    const blob = new Blob([activeNote.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeTopic?.title || 'chapter-notes').toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded!', description: 'Chapter markdown saved.' });
  };

  const handleJumpToLive = () => {
    if (activeStreamingTopicId) {
      setSelectedTopicId(activeStreamingTopicId);
      setUserSelectedTopic(false);
    }
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto flex flex-col space-y-4">
      {/* ─── Top Studio Status & Progress Bar ───────────────────────────────── */}
      <div className="rounded-2xl border border-border/70 bg-card/85 backdrop-blur-md p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Live Beacon & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
            title="Cancel / Return to Library"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Exit</span>
          </Button>

          <div className="h-4 w-px bg-border/60 shrink-0" />

          {/* Live Pulsing Beacon */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-400 hidden sm:inline">
              Live Synthesis Studio
            </span>
          </div>

          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground tracking-tight truncate max-w-[320px] sm:max-w-[480px]">
              {notes?.title || videoInfo?.title || 'Synthesizing Study Notebook'}
            </h1>
            <p className="text-[11px] text-muted-foreground font-mono truncate">
              {activeStreamingNote?.topicTitle
                ? `Writing: ${activeStreamingNote.topicTitle}`
                : 'Structuring chapters and notes...'}
            </p>
          </div>
        </div>

        {/* Center/Right: Progress Metrics & View Switcher */}
        <div className="flex items-center flex-wrap gap-3 shrink-0">
          {/* Progress pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/60 border border-border/50 text-xs font-mono">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">
              {completedTopicsCount}/{totalTopicsCount} Chapters
            </span>
            <span className="text-primary font-semibold font-mono">
              ({percentComplete}%)
            </span>
          </div>

          {/* Active Model Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-mono text-primary">
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span className="truncate max-w-[130px]">{activeModel}</span>
          </div>

          {/* Video Toggle */}
          {videoId && (
            <Button
              variant={isStudioVideo ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsStudioVideo(!isStudioVideo)}
              className="h-8 text-xs gap-1.5 px-3"
            >
              <Tv className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isStudioVideo ? 'Hide Video' : 'Video Player'}
              </span>
            </Button>
          )}

          {/* Mode Switcher Tabs */}
          <div className="p-0.5 rounded-xl bg-muted/60 border border-border/50 flex items-center">
            <button
              onClick={() => setActiveTab('notebook')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                activeTab === 'notebook'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>Live Notebook</span>
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                activeTab === 'diagnostics'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Diagnostics</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Mode 1: Live Notebook Document Studio ─────────────────────────── */}
      {activeTab === 'notebook' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-190px)] min-h-[640px]">
          {/* Left Column: Topics Sidebar & Video Embed */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 h-full overflow-hidden">
            {/* Optional Embedded YouTube Player */}
            {isStudioVideo && videoId && (
              <div className="rounded-xl overflow-hidden border border-border/60 bg-black shadow-sm aspect-video shrink-0">
                <iframe
                  key={seekTime !== null ? `yt-${seekTime}` : 'yt-initial'}
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1${
                    seekTime !== null ? `&start=${seekTime}&autoplay=1` : ''
                  }`}
                  title="YouTube Video Player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>
            )}

            {/* Curriculum Topic Navigation Sidebar */}
            <div className="flex-1 rounded-2xl border border-border/70 bg-card/70 overflow-hidden flex flex-col shadow-xs">
              <div className="px-4 py-3 border-b border-border/40 bg-card/90 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                    Chapters
                  </span>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {topicsList.length}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {totalWordsGenerated.toLocaleString()} words
                </span>
              </div>

              {/* Topics Scrollable List */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/20 p-1">
                {topicsList.map((topic, idx) => {
                  const isSelected = selectedTopicId === topic.id;
                  const isStreamingThis =
                    activeStreamingTopicId === topic.id && status !== 'complete';
                  const isCompleted =
                    !isStreamingThis &&
                    Boolean(
                      notes?.notes?.some(
                        (n) => n.topicId === topic.id && n.content && n.content.length > 20
                      )
                    );

                  return (
                    <button
                      key={topic.id}
                      onClick={() => {
                        setSelectedTopicId(topic.id);
                        setUserSelectedTopic(true);
                        if (topic.startTime !== undefined) {
                          setSeekTime(topic.startTime);
                        }
                      }}
                      className={cn(
                        'w-full text-left px-3.5 py-3 rounded-xl transition-all group relative flex flex-col gap-1.5 my-0.5',
                        isSelected
                          ? 'bg-primary/15 text-primary border border-primary/30 shadow-xs'
                          : 'hover:bg-muted/40 text-foreground/80 hover:text-foreground'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {/* Status Icon */}
                          <span className="mt-0.5 shrink-0">
                            {isStreamingThis ? (
                              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                            ) : isCompleted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
                            )}
                          </span>

                          <span className="text-xs font-semibold leading-snug line-clamp-2">
                            {topic.title}
                          </span>
                        </div>

                        {/* Timestamp Pill */}
                        {topic.timeDisplay && (
                          <span
                            className={cn(
                              'text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0',
                              isSelected
                                ? 'bg-primary/20 text-primary font-bold'
                                : 'bg-muted/60 text-muted-foreground'
                            )}
                          >
                            {topic.timeDisplay}
                          </span>
                        )}
                      </div>

                      {/* Sub-status Indicator */}
                      <div className="flex items-center justify-between text-[10px] font-mono pl-6">
                        <span
                          className={cn(
                            'transition-colors inline-flex items-center gap-1.5',
                            isStreamingThis
                              ? 'text-primary font-semibold'
                              : isCompleted
                              ? 'text-emerald-400/90'
                              : 'text-muted-foreground/50'
                          )}
                        >
                          {isStreamingThis && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />}
                          {isStreamingThis
                            ? 'Writing Live'
                            : isCompleted
                            ? 'Generated'
                            : 'Queued'}
                        </span>
                        {isCompleted && (
                          <span className="text-muted-foreground/70">
                            {notes?.notes?.find((n) => n.topicId === topic.id)?.content?.split(/\s+/).length || 0} w
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Main Column: Notebook Page Canvas */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col h-full overflow-hidden rounded-2xl border border-border/70 bg-card/85 backdrop-blur-md shadow-sm">
            {/* Notebook Chapter Header Bar */}
            <div className="px-6 py-4 border-b border-border/50 bg-card/95 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-primary font-semibold">
                    Chapter Note
                  </span>
                  {activeTopic?.timeDisplay && (
                    <button
                      onClick={() => {
                        if (activeTopic.startTime !== undefined) {
                          setSeekTime(activeTopic.startTime);
                          setIsStudioVideo(true);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary/80 text-foreground border border-border/50 hover:bg-primary/20 hover:text-primary transition-colors"
                      title="Jump video to this timestamp"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>{activeTopic.timeDisplay}</span>
                    </button>
                  )}
                  {isCurrentlyStreaming && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 flex items-center gap-1 animate-pulse">
                      <Sparkles className="w-3 h-3" />
                      <span>Streaming Tokens...</span>
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-foreground tracking-tight leading-snug truncate">
                  {activeTopic?.title || 'Select a chapter'}
                </h2>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {userSelectedTopic && activeStreamingTopicId && selectedTopicId !== activeStreamingTopicId && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleJumpToLive}
                    className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs animate-pulse"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Jump to Live Stream</span>
                  </Button>
                )}

                {activeNote?.content && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyCurrentNote}
                      className="h-8 px-2.5 text-xs gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copy</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadCurrentNote}
                      className="h-8 px-2.5 text-xs gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Export .md</span>
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* If viewing a previous topic while another is streaming, show sticky banner */}
            {userSelectedTopic && activeStreamingTopicId && selectedTopicId !== activeStreamingTopicId && (
              <div className="px-6 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between text-xs text-primary font-mono shrink-0">
                <span className="flex items-center gap-2 truncate">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    AI is currently writing:{' '}
                    <strong>{activeStreamingNote?.topicTitle}</strong>
                  </span>
                </span>
                <button
                  onClick={handleJumpToLive}
                  className="font-semibold underline hover:text-primary-foreground transition-colors shrink-0 ml-2"
                >
                  View live typing &rarr;
                </button>
              </div>
            )}

            {/* Note Markdown Content Body */}
            <div className="flex-1 overflow-hidden p-3 md:p-5">
              {activeNote?.content ? (
                <RunningNotesViewer
                  content={activeNote.content}
                  title={activeTopic?.title}
                  showToolbar={false}
                  chapterNumber={topicsList.findIndex((t) => t.id === selectedTopicId) !== -1 ? topicsList.findIndex((t) => t.id === selectedTopicId) + 1 : undefined}
                  totalChapters={topicsList.length}
                  timeDisplay={activeTopic?.timeDisplay}
                  startTime={activeTopic?.startTime}
                  onSeek={(secs) => {
                    setSeekTime(secs);
                    setIsStudioVideo(true);
                  }}
                  isStreaming={isCurrentlyStreaming}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                    <Clock className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Chapter Waiting in Queue
                    </p>
                    <p className="text-xs max-w-sm leading-relaxed">
                      This chapter will automatically start synthesizing once preceding topics complete.
                    </p>
                  </div>
                  {activeStreamingTopicId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleJumpToLive}
                      className="h-8 text-xs gap-1.5 mt-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>Go to Active Stream</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Mode 2: Pipeline Diagnostics & Low-Level Event Logs ───────────── */}
      {activeTab === 'diagnostics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          {/* Left Column: Video & Pipeline Stepper */}
          <div className="lg:col-span-7 space-y-4">
            <SourceVideoCard
              videoInfo={videoInfo}
              videoCount={videoCount}
              sourceUrl={jobId}
            />
            <ProcessingView
              steps={steps}
              currentStep={currentStep}
              videoInfo={videoInfo}
              videoCount={videoCount}
              processedVideos={processedVideos}
              streamingTopicTitle={activeStreamingNote?.topicTitle}
              streamingContent={activeStreamingNote?.content}
            />
          </div>

          {/* Right Column: Telemetry, Study Blueprint & Live Events */}
          <div className="lg:col-span-5 space-y-4">
            <SessionTelemetryCard status={status} />
            <StudyBlueprintCard
              status={status}
              currentStep={currentStep}
              topicCount={topicsList.length}
            />
            <ActivityStream logs={logs} status={status} />
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveStreamingNotebook;

