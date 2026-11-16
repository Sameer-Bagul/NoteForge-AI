import { Helmet } from 'react-helmet-async';
import { useNavigate, Link } from 'react-router-dom';
import UrlInput from '@/components/UrlInput';
import { useProcessing } from '@/hooks/useProcessing';
import { motion } from 'framer-motion';
import { BookOpen, Sparkles, Clock, ArrowRight, ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';

const Create = () => {
  const navigate = useNavigate();
  const { startProcessing } = useProcessing();

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.getJobs,
    staleTime: 10000,
  });

  const recentJobs = (jobs || [])
    .filter(j => j.status === 'complete')
    .slice(0, 3);

  return (
    <>
      <Helmet>
        <title>NoteForge Studio · Video to Study Guides</title>
        <meta
          name="description"
          content="Transform YouTube lectures and playlists into deep, structured study documentation."
        />
      </Helmet>

      <div className="flex-1 overflow-y-auto flex flex-col justify-center items-center w-full min-h-full py-8 px-6">
        <div className="w-full max-w-xl my-auto space-y-8 pb-8">
          {/* Focused Headline */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Transform lectures into living notes
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Extract timestamps, semantic chapter notes, architecture diagrams, and interactive study tools.
            </p>
          </div>

          {/* Primary Command Input */}
          <div className="w-full">
            <UrlInput
              onSubmit={async (url, userNotes, creativityLevel, generationMode) => {
                const jobId = await startProcessing(url, userNotes, creativityLevel, generationMode);
                if (jobId) {
                  navigate(`/process/${jobId}`);
                }
              }}
              isLoading={false}
            />
          </div>

          {/* Recent Notebooks Quick-Access */}
          {recentJobs.length > 0 && (
            <div className="pt-6 border-t border-border/50 space-y-3 w-full">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                  Recent Notebooks
                </h2>
                <Link
                  to="/library"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {recentJobs.map(job => (
                  <Link
                    key={job.id}
                    to={job.notebookId ? `/notebook/${job.notebookId}` : `/process/${job.id}`}
                    className="group block p-3.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 hover:border-border transition-colors shadow-none"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                        {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <h3 className="font-medium text-xs text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {job.videos?.[0]?.title || 'Study Notebook'}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{job.videos?.length || 1} video{(job.videos?.length || 1) > 1 ? 's' : ''}</span>
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Create;
