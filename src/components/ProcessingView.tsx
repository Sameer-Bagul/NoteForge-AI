import { Check, Loader2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { ProcessingStep, VideoInfo } from '@/types';
import { Progress } from './ui/progress';
import { PIPELINE_STEPS } from '@/services/nativePipeline';

interface ProcessingViewProps {
  steps: ProcessingStep[];
  currentStep: number;
  videoInfo?: VideoInfo;
  videoCount?: number;
  processedVideos?: number;
  streamingTopicTitle?: string;
  streamingContent?: string;
}

export const ProcessingView = ({
  steps,
  currentStep,
  videoInfo,
  videoCount,
  processedVideos,
  streamingTopicTitle,
  streamingContent,
}: ProcessingViewProps) => {
  const displaySteps = (steps && steps.length > 0) ? steps : PIPELINE_STEPS;
  const totalCount = displaySteps.length || 1;
  const completedCount = displaySteps.filter((s) => s.status === 'complete').length;
  const activeStep = displaySteps.find((s) => s.status === 'active');
  const activeStepIndex = displaySteps.findIndex((s) => s.status === 'active');

  // Calculate smooth overall progress percentage (guarded against NaN)
  const baseProgress = (completedCount / totalCount) * 100;
  const activeStepBonus = activeStep ? (1 / totalCount) * 50 : 0;
  const calculated = Math.min(100, Math.round(baseProgress + activeStepBonus));
  const overallProgress = isNaN(calculated) ? 0 : calculated;

  return (
    <div className="w-full space-y-4">
      {/* Header with Overall Progress */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Synthesis Pipeline
              </h2>
              {activeStep && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Step {activeStepIndex + 1} of {displaySteps.length}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeStep?.label
                ? `${activeStep.label} in progress`
                : 'Extracting, analyzing, and synthesizing study notebook'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xl font-bold font-mono text-foreground tabular-nums">
              {overallProgress}%
            </span>
            <span className="text-[10px] text-muted-foreground block -mt-0.5">Progress</span>
          </div>
        </div>

        <Progress value={overallProgress} className="h-1.5" />
      </div>

      {/* Stepper Timeline */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-1">
        <div className="relative pl-7 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-[2px] before:bg-border/60 space-y-4">
          {displaySteps.map((step, idx) => {
            const isActive = step.status === 'active';
            const isComplete = step.status === 'complete';
            const isError = step.status === 'error';

            return (
              <div key={step.id} className="relative group">
                {/* Node icon on vertical track */}
                <div className="absolute -left-7 top-0.5 flex items-center justify-center">
                  {isComplete ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/30">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  ) : isActive ? (
                    <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center border border-primary/40 ring-4 ring-primary/10">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    </div>
                  ) : isError ? (
                    <div className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center border border-rose-500/30">
                      <AlertCircle className="w-3.5 h-3.5 stroke-[2]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground/60 flex items-center justify-center border border-border/50 text-[10px] font-mono font-medium">
                      {idx + 1}
                    </div>
                  )}
                </div>

                {/* Step Body */}
                <div
                  className={`pl-2 transition-all ${
                    isActive ? 'opacity-100' : isComplete ? 'opacity-90' : 'opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-foreground tracking-tight">
                      {step.label}
                    </h3>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded leading-none ${
                        isComplete
                          ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20'
                          : isActive
                          ? 'text-primary bg-primary/10 border border-primary/20 animate-pulse'
                          : isError
                          ? 'text-rose-500 bg-rose-500/10 border border-rose-500/20'
                          : 'text-muted-foreground/60 bg-muted/60'
                      }`}
                    >
                      {isComplete ? 'Done' : isActive ? 'In Progress' : isError ? 'Failed' : 'Pending'}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.details || step.description}
                  </p>

                  {/* Active Sub-progress Detail */}
                  {isActive && step.metadata?.subProgress && (
                    <div className="mt-2 text-[11px] font-mono text-primary/90 bg-primary/5 px-2.5 py-1.5 rounded-md border border-primary/15 flex items-center gap-2">
                      <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate">{step.metadata.subProgress}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Notes Streaming Preview (Shown during Note Generation) */}
      {streamingContent && (
        <div className="rounded-xl border border-primary/30 bg-card/70 p-4 space-y-2.5 transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-semibold text-foreground">
                Live Synthesis Preview
              </span>
              {streamingTopicTitle && (
                <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[260px]">
                  • {streamingTopicTitle}
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              Streaming Tokens
            </span>
          </div>

          <div className="max-h-[160px] overflow-y-auto font-mono text-[11px] text-muted-foreground/90 whitespace-pre-wrap leading-relaxed select-text bg-muted/30 p-3 rounded-lg border border-border/30">
            {streamingContent}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingView;
