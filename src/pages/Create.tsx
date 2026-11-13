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

      <div className="w-full max-w-4xl mx-auto pt-8 pb-16 space-y-12">
        {/* Clean, authentic Studio Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Knowledge Synthesizer</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            Transform Lectures into <span className="text-primary">Living Notes</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            Extract timestamps, semantic chapter notes, architecture diagrams, and interactive quizzes in seconds.
          </p>
        </motion.div>

        {/* Primary Command Input */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <UrlInput
            onSubmit={async (url, userNotes, creativityLevel, generationMode) => {
              const jobId = await startProcessing(url, userNotes, creativityLevel, generationMode);
              if (jobId) {
                navigate(`/process/${jobId}`);
              }
            }}
            isLoading={false}
          />
        </motion.div>

        {/* Recent Notebooks Quick-Access (if available) */}
        {recentJobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="pt-6 border-t border-border/50 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Recent Notebooks
              </h2>
              <Link
                to="/library"
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentJobs.map(job => (
                <Link
                  key={job.id}
                  to={job.notebookId ? `/notebook/${job.notebookId}` : `/process/${job.id}`}
                  className="group block p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/50 hover:border-primary/40 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {job.videos?.[0]?.title || 'Study Notebook'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {job.videos?.length || 1} video{(job.videos?.length || 1) > 1 ? 's' : ''}
                  </p>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
};

export default Create;
