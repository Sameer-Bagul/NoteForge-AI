import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { JobStatus } from '@/types';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';

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
        await api.deleteNotebook(nbId);
      }
      // Also ensure job record is removed
      await api.deleteJob(job.id).catch(() => {});

      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Deleted',
        description: `"${title}" has been deleted.`,
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
        description: 'All notebooks and jobs have been removed.',
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
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-mono">Loading local notebooks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 max-w-sm mx-auto space-y-4">
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
  const failedJobs = jobs?.filter((job) => job.status === 'error') || [];
  const isEmpty = (jobs?.length || 0) === 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Study Library</h1>
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
        <div className="py-20 px-6 rounded-2xl border border-dashed border-border/60 bg-card/30 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
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
      ) : (
        <div className="space-y-8">
          {/* Active Jobs Section */}
          {activeJobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>In Progress ({activeJobs.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeJobs.map((job) => (
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

          {/* Completed Notebooks */}
          {completedJobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Saved Notebooks ({completedJobs.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          {/* Failed Jobs Section */}
          {failedJobs.length > 0 && (
            <div className="space-y-3 pt-6 border-t border-border/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-destructive/80">
                Failed Ingestions ({failedJobs.length})
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
  const isActive = !isComplete && !isError;

  const title = job.notebook?.title || job.videos?.[0]?.title || `Job ${job.id.slice(0, 8)}`;
  const thumbnail = job.videos?.[0]?.thumbnail || (job as any).videoInfo?.thumbnail;
  const targetLink = isComplete ? `/notebook/${job.notebook?.id || job.notebookId}` : `/process/${job.id}`;

  const renderBadgeAndActions = () => (
    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
      <span
        className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-md backdrop-blur-md ${
          isComplete
            ? 'bg-emerald-500/85 text-white'
            : isError
            ? 'bg-destructive/85 text-white'
            : 'bg-background/85 text-foreground border border-border/50'
        }`}
      >
        {job.status}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(job);
        }}
        disabled={isDeleting}
        className="h-6 w-6 rounded-md bg-background/85 hover:bg-destructive text-muted-foreground hover:text-white backdrop-blur-md flex items-center justify-center border border-border/50 transition-colors shadow-xs"
        title="Delete"
      >
        {isDeleting ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Trash2 className="w-3 h-3" />
        )}
      </button>
    </div>
  );

  return (
    <Link
      to={targetLink}
      className={`group flex flex-col h-full rounded-xl border border-border/60 bg-card/60 hover:bg-card hover:border-border transition-all duration-150 overflow-hidden shadow-xs hover:shadow-sm relative ${
        isActive ? 'ring-1 ring-primary/30 border-primary/40' : ''
      }`}
    >
      {thumbnail ? (
        <div className="aspect-video w-full overflow-hidden bg-muted relative shrink-0">
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
            loading="lazy"
          />
          {renderBadgeAndActions()}
        </div>
      ) : (
        <div className="aspect-video w-full bg-muted/40 relative flex items-center justify-center text-muted-foreground/50 border-b border-border/30 shrink-0">
          <FileText className="w-8 h-8 stroke-[1.2]" />
          {renderBadgeAndActions()}
        </div>
      )}

      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono tabular-nums">
            <Calendar className="w-3 h-3 text-muted-foreground/70" />
            <span>
              {job.createdAt ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }) : 'Recent'}
            </span>
          </div>
          <h3 className="font-medium text-xs text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {title}
          </h3>
        </div>

        {isComplete && job.notebook && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t border-border/40 font-mono">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-muted-foreground/70" />
              <span>{job.notebook.index?.topicCount || job.notebook.chapters?.length || 1} topics</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground/70" />
              <span>{job.notebook.metadata?.estimatedReadTime || 5} min read</span>
            </span>
          </div>
        )}

        {isActive && (
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>Step {job.currentStep}/5</span>
              <span>Processing</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(10, (job.currentStep / 5) * 100)}%` }}
              />
            </div>
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
