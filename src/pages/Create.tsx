import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import UrlInput from '@/components/UrlInput';
import { useProcessing } from '@/hooks/useProcessing';
import { motion } from 'framer-motion';
import { Brain, Zap, ShieldCheck } from 'lucide-react';

const Create = () => {
  const navigate = useNavigate();
  const { startProcessing } = useProcessing();

  const handleStart = async (url: string, userNotes?: string, creativityLevel?: number) => {
    try {
      // We'll need startProcessing to return the jobId now
      // Since it's async and we want to redirect immediately
      // Let's ensure startProcessing in useProcessing returns the ID
      // If not, we might need a small refactor there too.
      // For now, I'll assume it works or I'll fix it if needed.
      // Actually, looking at useProcessing, it returns void but we can make it return jobId.
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Helmet>
        <title>NoteForge - Transform YouTube Videos into Structured Notes</title>
        <meta name="description" content="Turn any YouTube video or playlist into beautiful, organized notes. Extract transcripts, generate topic indexes, and create book-like documentation." />
      </Helmet>

      <div className="w-full max-w-5xl mx-auto pt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-widest uppercase mb-2">
            Professional Synthesis
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4">
            Turn Videos into <span className="gradient-text">Knowledge.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            NoteForge uses advanced AI to synthesize YouTube content into structured, book-like documentation in seconds.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
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

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
          {[
            { icon: Brain, title: "Deep Synthesis", desc: "Our AI doesn't just transcribe; it understands and structures content logically." },
            { icon: Zap, title: "Turbo Speed", desc: "Optimized for local CPUs with dual-model logic and fragment caching." },
            { icon: ShieldCheck, title: "Privacy First", desc: "Run entirely on your machine using local LLMs. Your data stays yours." },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + (i * 0.1) }}
              className="glass-morphism p-6 rounded-2xl border border-white/5 space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Background decoration */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px]" />
        </div>
      </div>
    </>
  );
};

export default Create;

