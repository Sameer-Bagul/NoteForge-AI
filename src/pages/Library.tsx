import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { JobStatus } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BookOpen, Clock, Calendar, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const Library = () => {
  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.getJobs,
    refetchInterval: 5000 // Refresh every 5 seconds to see status updates
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading your library...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-destructive">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>Failed to load library. Please try again later.</p>
      </div>
    );
  }

  const completedJobs = jobs?.filter(job => job.status === 'complete') || [];
  const activeJobs = jobs?.filter(job => job.status !== 'complete' && job.status !== 'error') || [];
  const failedJobs = jobs?.filter(job => job.status === 'error') || [];

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Library</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your generated study notebooks and saved video indexes
          </p>
        </div>
        <Link to="/">
          <Button size="sm" className="gap-1.5 h-8 text-xs">
            <FileText className="w-3.5 h-3.5" />
            <span>New Video</span>
          </Button>
        </Link>
      </div>

      {/* Active Jobs Section */}
      {activeJobs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            In Progress
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Notebooks Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-green-600" />
          Completed Notebooks
        </h3>

        {completedJobs.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium">No notebooks yet</h3>
            <p className="text-muted-foreground mb-4">
              Process a YouTube video or playlist to generate your first notebook.
            </p>
            <Link to="/">
              <Button variant="outline">Get Started</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>

      {/* Failed Jobs Section (if any) */}
      {failedJobs.length > 0 && (
        <div className="space-y-4 pt-8 border-t">
          <h3 className="text-xl font-semibold flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-5 h-5" />
            Failed Jobs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-70 hover:opacity-100 transition-opacity">
            {failedJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const JobCard = ({ job }: { job: JobStatus }) => {
  const isComplete = job.status === 'complete';
  const isError = job.status === 'error';
  const isActive = !isComplete && !isError;

  const title = job.notebook?.title || job.videos?.[0]?.title || `Job ${job.id.slice(0, 8)}`;
  const thumbnail = job.videos?.[0]?.thumbnail || (job as any).videoInfo?.thumbnail;
  const targetLink = isComplete ? `/notebook/${job.notebook?.id || job.notebookId}` : `/process/${job.id}`;

  return (
    <Link
      to={targetLink}
      className={`group flex flex-col h-full rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors overflow-hidden ${
        isActive ? 'border-primary/50' : ''
      }`}
    >
      {thumbnail && (
        <div className="aspect-video w-full overflow-hidden bg-muted relative shrink-0">
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2">
            <span
              className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded backdrop-blur-md shadow-xs ${
                isComplete
                  ? 'bg-emerald-500/80 text-white'
                  : isError
                  ? 'bg-destructive/80 text-white'
                  : 'bg-background/80 text-foreground border border-border/50'
              }`}
            >
              {job.status}
            </span>
          </div>
        </div>
      )}

      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono tabular-nums">
            <Calendar className="w-3 h-3" />
            <span>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
          </div>
          <h3 className="font-medium text-xs text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {title}
          </h3>
        </div>

        {isComplete && job.notebook && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t border-border/40 font-mono">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              <span>{job.notebook.index?.topicCount || job.notebook.chapters?.length || 1} topics</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{job.notebook.metadata?.estimatedReadTime || 5} min read</span>
            </span>
          </div>
        )}

        {isActive && (
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Step {job.currentStep}/5</span>
              <span>In Progress</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${(job.currentStep / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        {isError && (
          <p className="text-[11px] text-destructive line-clamp-1 pt-1">
            {job.error || 'Failed to complete job'}
          </p>
        )}
      </div>
    </Link>
  );
};

export default Library;
