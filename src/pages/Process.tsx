import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProcessing } from '@/hooks/useProcessing';
import { useSettings } from '@/context/SettingsContext';
import ProcessingView from '@/components/ProcessingView';
import { IndexReview } from '@/components/IndexReview';
import ResultsView from '@/components/ResultsView';
import { LiveStreamingNotebook } from '@/components/notebook/LiveStreamingNotebook';
import { ActivityStream } from '@/components/ActivityStream';
import { SourceVideoCard } from '@/components/SourceVideoCard';
import { StudyBlueprintCard } from '@/components/StudyBlueprintCard';
import { SessionTelemetryCard } from '@/components/SessionTelemetryCard';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, AlertCircle, RefreshCw, Settings2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Process = () => {
    const { jobId } = useParams<{ jobId: string }>();
    const navigate = useNavigate();
    const { state, approveIndex, reset, logs, startProcessing, resumeJob } = useProcessing(jobId);
    const { openSettings } = useSettings();

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
            case 'extracting-transcripts':
            case 'analyzing-content':
            case 'generating-index':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1720px] mx-auto w-full">
                        {/* Left Main Column: Video & Pipeline Stepper */}
                        <div className="lg:col-span-7 space-y-4">
                            <SourceVideoCard
                                videoInfo={state.videoInfo}
                                videoCount={state.videoCount}
                                sourceUrl={jobId}
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

                        {/* Right Column: Telemetry, Study Blueprint & Live Events */}
                        <div className="lg:col-span-5 space-y-4">
                            <SessionTelemetryCard status={state.status} />
                            <StudyBlueprintCard
                                status={state.status}
                                currentStep={state.currentStep}
                                topicCount={state.index?.topics?.length}
                            />
                            <ActivityStream logs={logs} status={state.status} />
                        </div>
                    </div>
                );

            case 'awaiting-approval':
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-[1720px] mx-auto"
                    >
                        {state.index && (
                            <IndexReview
                                index={state.index}
                                onApprove={approveIndex}
                            />
                        )}
                    </motion.div>
                );

            case 'generating':
            case 'assembling':
            case 'generating-notes':
            case 'assembling-notebook':
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.99 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="w-full max-w-[1720px] mx-auto flex-1 flex flex-col"
                    >
                        <LiveStreamingNotebook
                            jobId={jobId}
                            videoInfo={state.videoInfo}
                            videoCount={state.videoCount}
                            processedVideos={state.processedVideos}
                            index={state.index}
                            notes={state.notes}
                            steps={state.steps}
                            currentStep={state.currentStep}
                            status={state.status}
                            logs={logs}
                            onReset={handleReset}
                        />
                    </motion.div>
                );

            case 'complete':
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-[1720px] mx-auto flex-1 flex flex-col"
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

            case 'paused-rate-limit': {
                const totalTopics = state.index?.topics?.length || 0;
                const completedCount = state.notes?.notes?.length || 0;

                return (
                    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 py-8 max-w-xl mx-auto">
                        <div className="w-full bg-card/60 border border-amber-500/25 rounded-2xl p-6 md:p-8 backdrop-blur-sm shadow-xl space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0 mt-0.5">
                                    <AlertCircle className="w-6 h-6 text-amber-500" />
                                </div>
                                <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-semibold tracking-tight text-foreground">
                                            AI Quota Limit Reached
                                        </h2>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                            Paused
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        All active AI providers have temporarily exhausted their rate limit or token quota.
                                    </p>
                                </div>
                            </div>

                            {/* SQLite Checkpoint Guarantee Banner */}
                            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex items-center gap-3">
                                <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div className="text-xs text-emerald-300 leading-normal">
                                    <span className="font-medium text-emerald-200">Checkpoint Safe:</span>{' '}
                                    {completedCount > 0
                                        ? `${completedCount} of ${totalTopics || completedCount} chapters have been compiled and safely written to SQLite.`
                                        : 'Session state is safely checkpointed in local SQLite.'}
                                </div>
                            </div>

                            {state.error && (
                                <div className="rounded-lg bg-muted/60 border border-border/40 p-3 text-[11px] font-mono text-muted-foreground break-all">
                                    {state.error}
                                </div>
                            )}

                            <div className="space-y-2 pt-1 text-xs text-muted-foreground">
                                <p className="font-medium text-foreground">How would you like to proceed?</p>
                                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                                    <li>Wait 30-60 seconds for provider per-minute quotas to refresh, then resume.</li>
                                    <li>Open Settings to add a secondary API key or switch to local Ollama.</li>
                                </ul>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                                <Button onClick={handleReset} variant="ghost" size="sm" className="gap-2 text-xs">
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    Return to Home
                                </Button>
                                <div className="flex items-center gap-2">
                                    <Button onClick={openSettings} variant="outline" size="sm" className="gap-2 text-xs">
                                        <Settings2 className="w-3.5 h-3.5" />
                                        Configure Providers
                                    </Button>
                                    <Button
                                        onClick={() => resumeJob()}
                                        size="sm"
                                        className="gap-2 text-xs bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        Resume Generation
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };

    return (
        <div className="w-full max-w-[1720px] mx-auto px-1 md:px-3 py-2 flex-1 flex flex-col">
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
