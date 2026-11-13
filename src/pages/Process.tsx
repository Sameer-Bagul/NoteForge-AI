import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProcessing } from '@/hooks/useProcessing';
import ProcessingView from '@/components/ProcessingView';
import { IndexReview } from '@/components/IndexReview';
import ResultsView from '@/components/ResultsView';
import { ServerPulse } from '@/components/ServerPulse';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, Brain, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Process = () => {
    const { jobId } = useParams<{ jobId: string }>();
    const navigate = useNavigate();
    const { state, approveIndex, reset, logs, startProcessing, resumeJob } = useProcessing(jobId);

    useEffect(() => {
        if (!jobId) {
            navigate('/');
        }
    }, [jobId, navigate]);

    const handleReset = () => {
        reset();
        navigate('/');
    };

    const renderCurrentView = () => {
        switch (state.status) {
            case 'idle':
                return (
                    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                        <p className="text-muted-foreground font-mono">Initializing connection to job {jobId?.slice(0, 8)}...</p>
                    </div>
                );

            case 'extracting':
            case 'indexing':
            case 'generating':
            case 'assembling':
            case 'extracting-transcripts':
            case 'analyzing-content':
            case 'generating-index':
            case 'generating-notes':
            case 'assembling-notebook':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <ProcessingView
                                steps={state.steps}
                                currentStep={state.currentStep}
                                videoInfo={state.videoInfo}
                                videoCount={state.videoCount}
                                processedVideos={state.processedVideos}
                            />
                        </div>
                        <div className="space-y-4">
                            <ServerPulse logs={logs} />

                            <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3 text-xs">
                                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                                    <span className="font-medium text-foreground">Pipeline Inspector</span>
                                    <span className="font-mono text-[11px] text-muted-foreground uppercase">{state.status}</span>
                                </div>
                                <div className="space-y-1.5 text-muted-foreground">
                                    <div className="flex justify-between">
                                        <span>Execution Engine</span>
                                        <span className="font-mono text-foreground">Tauri v2 (Rust Core)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Notebook Store</span>
                                        <span className="font-mono text-foreground">SQLite (Local)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Key Storage</span>
                                        <span className="font-mono text-foreground">OS Keychain</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'awaiting-approval':
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full"
                    >
                        {state.index && (
                            <IndexReview
                                index={state.index}
                                onApprove={approveIndex}
                            />
                        )}
                    </motion.div>
                );

            case 'complete':
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {state.notes && (
                            <ResultsView
                                notes={state.notes}
                                onReset={handleReset}
                            />
                        )}
                    </motion.div>
                );

            case 'error':
                return (
                    <div className="flex flex-col items-center justify-center h-[60vh] gap-6 text-center">
                        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                            <ArrowLeft className="w-10 h-10 text-red-500" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold">Processing Failed</h2>
                            <p className="text-muted-foreground max-w-md">
                                {state.error || 'An unexpected error occurred while processing your video.'}
                            </p>
                        </div>
                        <Button onClick={handleReset} variant="outline" size="lg">
                            Return to Home
                        </Button>
                    </div>
                );

            case 'paused-rate-limit':
                return (
                    <div className="flex flex-col items-center justify-center h-[60vh] gap-6 text-center fade-in">
                        <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                            <AlertCircle className="w-10 h-10 text-orange-500" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold">API Quota Exhausted</h2>
                            <p className="text-muted-foreground max-w-md">
                                The AI provider has severely rate-limited the generation engine (likely due to free tier limits). The job has been safely paused and all progress is saved.
                            </p>
                        </div>
                        <div className="flex gap-4 mt-4">
                            <Button onClick={handleReset} variant="outline" size="lg">
                                Return to Home
                            </Button>
                            <Button 
                                onClick={resumeJob} 
                                size="lg"
                                className="bg-orange-500 hover:bg-orange-600 text-white"
                            >
                                Resume Generation
                            </Button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 min-h-screen">
            <AnimatePresence mode="wait">
                <motion.div
                    key={state.status}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                >
                    {renderCurrentView()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default Process;
