import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProcessing } from '@/hooks/useProcessing';
import ProcessingView from '@/components/ProcessingView';
import { IndexReview } from '@/components/IndexReview';
import ResultsView from '@/components/ResultsView';
import { ActivityStream } from '@/components/ActivityStream';
import { SourceVideoCard } from '@/components/SourceVideoCard';
import { EngineSpecsCard } from '@/components/EngineSpecsCard';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
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

    const latestNote = state.notes?.notes?.length
        ? state.notes.notes[state.notes.notes.length - 1]
        : undefined;

    const renderCurrentView = () => {
        switch (state.status) {
            case 'idle':
                return (
                    <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center">
                        <Loader2 className="w-7 h-7 text-primary animate-spin" />
                        <p className="text-xs text-muted-foreground font-mono">
                            Connecting to pipeline session {jobId?.slice(0, 8)}...
                        </p>
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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        <div className="lg:col-span-2 space-y-4">
                            <SourceVideoCard
                                videoInfo={state.videoInfo}
                                videoCount={state.videoCount}
                            />
                            <ProcessingView
                                steps={state.steps}
                                currentStep={state.currentStep}
                                videoInfo={state.videoInfo}
                                videoCount={state.videoCount}
                                processedVideos={state.processedVideos}
                                streamingTopicTitle={latestNote?.topicTitle}
                                streamingContent={latestNote?.content}
                            />
                        </div>
                        <div className="space-y-4">
                            <ActivityStream logs={logs} status={state.status} />
                            <EngineSpecsCard />
                        </div>
                    </div>
                );

            case 'awaiting-approval':
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-5xl mx-auto"
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
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-6xl mx-auto"
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
                    <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                            <AlertCircle className="w-8 h-8 text-rose-500" />
                        </div>
                        <div className="space-y-1.5">
                            <h2 className="text-xl font-semibold tracking-tight text-foreground">Processing Failed</h2>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {state.error || 'An unexpected error occurred while processing your video.'}
                            </p>
                        </div>
                        <Button onClick={handleReset} variant="outline" size="sm" className="gap-2 mt-2">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Return to Home
                        </Button>
                    </div>
                );

            case 'paused-rate-limit':
                return (
                    <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                            <AlertCircle className="w-8 h-8 text-amber-500" />
                        </div>
                        <div className="space-y-1.5">
                            <h2 className="text-xl font-semibold tracking-tight text-foreground">API Quota Exhausted</h2>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                The AI provider has rate-limited requests. The job state has been saved in SQLite.
                            </p>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <Button onClick={handleReset} variant="outline" size="sm">
                                Return to Home
                            </Button>
                            <Button onClick={resumeJob} size="sm">
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
        <div className="container mx-auto px-4 py-6 min-h-[calc(100vh-4rem)]">
            <AnimatePresence mode="wait">
                <motion.div
                    key={state.status}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                >
                    {renderCurrentView()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default Process;
