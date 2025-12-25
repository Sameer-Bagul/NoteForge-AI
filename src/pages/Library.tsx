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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Your Library</h2>
          <p className="text-muted-foreground mt-1">
            Manage your generated notes and active processing jobs.
          </p>
        </div>
        <Link to="/">
          <Button>
            <FileText className="w-4 h-4 mr-2" />
            Process New Video
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

  // Determine title - prefer notebook title, then video title, then ID
  const title = job.notebook?.title || job.videoInfo?.title || `Job ${job.id.slice(0, 8)}`;
  const thumbnail = job.videoInfo?.thumbnail;

  return (
    <Card className={`flex flex-col h-full overflow-hidden transition-all hover:shadow-md ${isActive ? 'border-primary/50' : ''}`}>
      {thumbnail && (
        <div className="aspect-video w-full overflow-hidden bg-muted relative">
          <img 
            src={thumbnail} 
            alt={title} 
            className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
          />
          <div className="absolute top-2 right-2">
            <Badge variant={isComplete ? 'default' : isError ? 'destructive' : 'secondary'}>
              {job.status}
            </Badge>
          </div>
        </div>
      )}
      
      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-2 text-lg leading-tight">
          {title}
        </CardTitle>
        <CardDescription className="flex items-center gap-2 text-xs mt-1">
          <Calendar className="w-3 h-3" />
          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 pb-2">
        {isActive && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>Step {job.currentStep}/{job.steps?.length || 5}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary animate-pulse" 
                style={{ width: `${(job.currentStep / (job.steps?.length || 5)) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {job.steps?.[job.currentStep - 1]?.label || 'Processing...'}
            </p>
          </div>
        )}
        
        {isComplete && job.notebook && (
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {job.notebook.index.topicCount} Topics
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {job.notebook.metadata.estimatedReadTime} min read
            </div>
          </div>
        )}

        {isError && (
          <p className="text-xs text-destructive line-clamp-2">
            {job.error || 'Unknown error occurred'}
          </p>
        )}
      </CardContent>
      
      <CardFooter className="pt-2">
        {isComplete ? (
          <Link to={`/notebook/${job.notebook?.id}`} className="w-full">
            <Button className="w-full" variant="secondary">
              View Notebook
            </Button>
          </Link>
        ) : isActive ? (
          <Link to="/" className="w-full">
             {/* Ideally we'd link to the specific job status page, but for now redirect to home where active job might be shown */}
            <Button className="w-full" variant="outline">
              View Progress
            </Button>
          </Link>
        ) : (
          <Button className="w-full" variant="ghost" disabled>
            Failed
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default Library;
