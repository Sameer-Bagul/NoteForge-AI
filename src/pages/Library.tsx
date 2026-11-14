import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { JobStatus, Notebook } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  BookOpen,
  Clock,
  Calendar,
  AlertCircle,
  Plus,
  RefreshCw,
  FileText,
  Trash2,
  ArrowRight,
  Sparkles,
  Layers,
  CheckCircle2,
  ListOrdered,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';

function getNotebookSynthesisMode(notebook?: Notebook) {
  if (!notebook) return null;
  const hasTimelineChapters = (notebook.metadata?.sourceVideos?.[0]?.chapters?.length || 0) > 0;
  const topicCount = notebook.metadata?.totalTopics || notebook.chapters?.[0]?.topics?.length || 0;

  if (hasTimelineChapters) {
    return {
      label: 'YouTube Chapters',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      description: `${topicCount} chapters extracted directly from video timeline`,
      icon: ListOrdered,
    };
  }

  if (topicCount > 10) {
    return {
      label: 'Comprehensive AI',
      badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      description: `In-depth syllabus with ${topicCount} conceptual topics`,
      icon: Layers,
    };
  }

  return {
    label: 'Topical AI',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    description: `Structured conceptual outline with ${topicCount} topics`,
    icon: Sparkles,
  };
}

const Library = () => {
  const queryClient = useQueryClient();
  const [isClearing, setIsClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.getJobs,
    refetchInterval: 5000,
  });

  const handleDeleteJob = async (job: JobStatus) => {
    const title = job.notebook?.title || job.videos?.[0]?.title || `Job ${job.id.slice(0, 8)}`;
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      setDeletingId(job.id);
      if (job.status === 'complete' || job.notebook?.id || job.notebookId) {
        const nbId = job.notebook?.id || job.notebookId || job.id;
        await api.deleteNotebook(nbId).catch(() => {});
      }
      // Also ensure job record is removed
      await api.deleteJob(job.id).catch(() => {});

      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Deleted',
        description: `"${title}" has been removed.`,
      });
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to delete item.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (
      !window.confirm(
        'Delete all notebooks and pipeline history from your local database? This cannot be undone.'
      )
    ) {
      return;
    }

    try {
      setIsClearing(true);
      await api.clearAllData();
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Library Cleared',
        description: 'All notebooks and jobs have been removed from local SQLite.',
      });
    } catch (err: any) {
      console.error('Failed to clear library:', err);
      toast({
        title: 'Error',
        description: err?.message || 'Failed to clear library.',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-mono">Loading local notebooks from SQLite...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-center p-8 max-w-sm mx-auto space-y-4">
        <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Could not load library</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error instanceof Error ? error.message : 'Unable to connect to local database.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs h-8">
          <RefreshCw className="w-3 h-3" />
          <span>Retry</span>
        </Button>
      </div>
    );
  }

  const completedJobs = jobs?.filter((job) => job.status === 'complete') || [];
  const activeJobs = jobs?.filter((job) => job.status !== 'complete' && job.status !== 'error') || [];
  
  // Differentiate genuinely live pipelines from stale/paused drafts
  const liveActiveJobs = activeJobs.filter((job) => job.isLive);
  const pausedOrDraftJobs = activeJobs.filter((job) => !job.isLive);
  const failedJobs = jobs?.filter((job) => job.status === 'error') || [];
  const isEmpty = (jobs?.length || 0) === 0;

  // Aggregate stats
  const totalTopics = completedJobs.reduce((acc, j) => {
    return acc + (j.notebook?.metadata?.totalTopics || j.notebook?.chapters?.[0]?.topics?.length || 0);
  }, 0);
  const totalWords = completedJobs.reduce((acc, j) => {
    return acc + (j.notebook?.metadata?.totalWords || 0);
  }, 0);
  const totalReadTime = Math.max(1, Math.round(totalWords / 200));

  return (
    <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto py-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/50 gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Study Library</h1>
            {!isEmpty && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary/80 text-secondary-foreground border border-border/60">
                {completedJobs.length} {completedJobs.length === 1 ? 'Notebook' : 'Notebooks'}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your synthesized notebooks and study materials stored in local SQLite
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isEmpty && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={isClearing}
              className="h-8 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 gap-1.5"
              title="Clear all notebooks from local SQLite database"
            >
              {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Clear All</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            title="Refresh library"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Link to="/">
            <Button size="sm" className="gap-1.5 h-8 text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" />
              <span>New Notebook</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Empty State */}
      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="w-full max-w-md py-12 px-8 rounded-2xl border border-dashed border-border/60 bg-card/30 flex flex-col items-center justify-center text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-muted/60 text-muted-foreground flex items-center justify-center">
              <BookOpen className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">No study notebooks yet</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Synthesize any YouTube video or complete playlist into structured markdown notes with architecture diagrams, quizzes, and interview questions.
              </p>
            </div>
            <Link to="/">
              <Button size="sm" className="h-8 px-4 text-xs font-semibold gap-1.5 mt-2">
                <Plus className="w-3.5 h-3.5" />
                <span>Create Your First Notebook</span>
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8 mt-6">
          {/* 1. Genuinely Active Pipelines in Progress */}
          {liveActiveJobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Active Synthesis in Progress ({liveActiveJobs.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {liveActiveJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onDelete={handleDeleteJob}
                    isDeleting={deletingId === job.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 2. Incomplete / Paused Drafts (e.g. Awaiting Outline Approval or Interrupted) */}
          {pausedOrDraftJobs.length > 0 && (
            <div className="space-y-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Incomplete Sessions & Drafts ({pausedOrDraftJobs.length})</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Action required or previously interrupted
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {pausedOrDraftJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onDelete={handleDeleteJob}
                    isDeleting={deletingId === job.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 3. Completed Notebooks */}
          {completedJobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>Saved Notebooks ({completedJobs.length})</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                  <span>{totalTopics} Total Topics</span>
                  <span>·</span>
                  <span>{totalReadTime}m Reading Time</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {completedJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onDelete={handleDeleteJob}
                    isDeleting={deletingId === job.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 4. Failed Jobs */}
          {failedJobs.length > 0 && (
            <div className="space-y-3 pt-6 border-t border-border/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-destructive/80">
                Failed Ingestions ({failedJobs.length})
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {failedJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onDelete={handleDeleteJob}
                    isDeleting={deletingId === job.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const JobCard = ({
  job,
  onDelete,
  isDeleting = false,
}: {
  job: JobStatus;
  onDelete: (job: JobStatus) => void;
  isDeleting?: boolean;
}) => {
  const isComplete = job.status === 'complete';
  const isError = job.status === 'error';
  const isAwaitingApproval = job.status === 'awaiting-approval';
  const isLiveActive = Boolean(job.isLive);
  const isPausedOrStale = !isComplete && !isError && !isLiveActive;

  const title = job.notebook?.title || job.videos?.[0]?.title || job.index?.title || `Job ${job.id.slice(0, 8)}`;
  const thumbnail = job.videos?.[0]?.thumbnail || (job as any).videoInfo?.thumbnail || job.notebook?.metadata?.sourceVideos?.[0]?.thumbnail;
  const targetLink = isComplete ? `/notebook/${job.notebook?.id || job.notebookId}` : `/process/${job.id}`;

  const synthesisMode = getNotebookSynthesisMode(job.notebook);
  const topicCount = job.notebook?.metadata?.totalTopics || job.notebook?.chapters?.[0]?.topics?.length || job.index?.topics?.length || 1;
  const readTime = job.notebook?.metadata?.estimatedReadTime || Math.max(1, Math.round((job.notebook?.metadata?.totalWords || 1000) / 200));

  return (
    <Link
      to={targetLink}
      className={`group flex flex-col h-full rounded-2xl border bg-card/60 hover:bg-card transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md relative ${
        isLiveActive
          ? 'ring-1 ring-cyan-500/40 border-cyan-500/50 shadow-cyan-500/10'
          : isAwaitingApproval
          ? 'ring-1 ring-amber-500/40 border-amber-500/50 shadow-amber-500/10'
          : 'border-border/60 hover:border-border'
      }`}
    >
      {/* Thumbnail Area with Ambient Gradient Layers */}
      <div className="aspect-video w-full overflow-hidden bg-muted/60 relative shrink-0">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-muted/40 flex items-center justify-center text-muted-foreground/40">
            <FileText className="w-10 h-10 stroke-[1.2]" />
          </div>
        )}

        {/* Dual protective dark gradient to guarantee overlay UI legibility over any video thumbnail text */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-black/35 to-black/75 pointer-events-none" />

        {/* Top Floating Controls Bar */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10 pointer-events-auto">
          {/* Status & Mode Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {isComplete && (
              <span className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-950/85 text-emerald-300 border border-emerald-500/40 backdrop-blur-md shadow-xs">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                <span>Ready</span>
              </span>
            )}

            {isLiveActive && (
              <span className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/85 text-cyan-300 border border-cyan-500/40 backdrop-blur-md shadow-xs animate-pulse">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                <span>Synthesizing</span>
              </span>
            )}

            {isAwaitingApproval && (
              <span className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-950/85 text-amber-300 border border-amber-500/40 backdrop-blur-md shadow-xs">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                <span>Needs Review</span>
              </span>
            )}

            {isPausedOrStale && !isAwaitingApproval && (
              <span className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-900/85 text-slate-300 border border-slate-700/60 backdrop-blur-md shadow-xs">
                <Clock className="w-2.5 h-2.5 text-slate-400" />
                <span>Paused</span>
              </span>
            )}

            {synthesisMode && (
              <span
                className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full backdrop-blur-md border shadow-xs ${synthesisMode.badgeClass}`}
              >
                {synthesisMode.label}
              </span>
            )}
          </div>

          {/* Delete Action Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(job);
            }}
            disabled={isDeleting}
            className="h-6 w-6 rounded-md bg-black/75 hover:bg-destructive text-white/70 hover:text-white backdrop-blur-md flex items-center justify-center border border-white/15 transition-all shadow-xs shrink-0"
            title="Delete notebook"
          >
            {isDeleting ? (
              <Loader2 className="w-3 h-3 animate-spin text-white" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* Bottom Floating Stats on Thumbnail */}
        {isComplete && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-mono text-white/90 z-10 pointer-events-none">
            <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-xs">
              <BookOpen className="w-3 h-3 text-primary" />
              <span>{topicCount} Topics</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-xs">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>{readTime}m read</span>
            </span>
          </div>
        )}
      </div>

      {/* Card Body Area */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono tabular-nums">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-muted-foreground/70" />
              <span>
                {job.createdAt ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }) : 'Recent'}
              </span>
            </div>
            {isComplete && job.notebook?.metadata?.totalWords && (
              <span>{job.notebook.metadata.totalWords.toLocaleString()} words</span>
            )}
          </div>

          <h3 className="font-semibold text-xs sm:text-sm text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {title}
          </h3>

          <p className="text-[11px] text-muted-foreground line-clamp-1 leading-normal">
            {synthesisMode?.description || (isComplete ? 'Comprehensive markdown study guide' : 'Pipeline session')}
          </p>
        </div>

        {/* Bottom Interaction Area */}
        {isComplete && (
          <div className="pt-2.5 border-t border-border/40 flex items-center justify-between text-xs">
            <span className="text-primary font-medium flex items-center gap-1 group-hover:underline">
              <span>Open Studio View</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/80">SQLite Vault</span>
          </div>
        )}

        {isLiveActive && (
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <div className="flex justify-between text-[10px] text-cyan-400 font-mono">
              <span>Step {job.currentStep}/4</span>
              <span>Actively Synthesizing</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${Math.max(15, (job.currentStep / 4) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {isAwaitingApproval && (
          <div className="pt-2.5 border-t border-border/40 flex items-center justify-between text-xs">
            <span className="text-amber-400 font-medium flex items-center gap-1 group-hover:underline">
              <span>Review & Approve Outline</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">Action Needed</span>
          </div>
        )}

        {isPausedOrStale && !isAwaitingApproval && (
          <div className="pt-2.5 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>Interrupted Session</span>
            <span className="text-primary hover:underline">Resume / View</span>
          </div>
        )}

        {isError && (
          <p className="text-[11px] text-destructive line-clamp-1 pt-1 font-mono">
            {job.error || 'Failed to complete job'}
          </p>
        )}
      </div>
    </Link>
  );
};

export default Library;
