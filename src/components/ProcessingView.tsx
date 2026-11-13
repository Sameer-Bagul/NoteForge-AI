import { Check, Loader2, AlertCircle, FileText, Brain, BookOpen, Package } from 'lucide-react';
import { ProcessingStep, VideoInfo } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Progress } from './ui/progress';

interface ProcessingViewProps {
  steps: ProcessingStep[];
  currentStep: number;
  videoInfo?: VideoInfo;
  videoCount?: number;
  processedVideos?: number;
}

const ProcessingView = ({ steps, currentStep, videoInfo, videoCount, processedVideos }: ProcessingViewProps) => {
  const getStepIcon = (step: ProcessingStep) => {
    const icons = {
      extract: FileText,
      analyze: Brain,
      index: BookOpen,
      notes: FileText,
      assemble: Package,
    };

    const IconComponent = icons[step.id as keyof typeof icons] || FileText;

    switch (step.status) {
      case 'complete':
        return (
          <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
        );
      case 'active':
        return (
          <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center border border-primary/30 shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </div>
        );
      case 'error':
        return (
          <div className="w-7 h-7 rounded-md bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20 shrink-0">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-md bg-muted text-muted-foreground/60 flex items-center justify-center border border-border/40 shrink-0">
            <IconComponent className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  const completedSteps = steps.filter(s => s.status === 'complete').length;
  const overallProgress = Math.round((completedSteps / steps.length) * 100);

  return (
    <div className="w-full space-y-4">
      {/* Header with Overall Progress */}
      <Card className="border border-border/60 bg-card shadow-none">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                Synthesis Progress
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {videoCount ? `Processing ${videoCount} video${videoCount > 1 ? 's' : ''} in playlist` : 'Extracting, analyzing, and synthesizing study guide'}
              </CardDescription>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono text-foreground tabular-nums">{overallProgress}%</span>
              <span className="text-[11px] text-muted-foreground block">Complete</span>
            </div>
          </div>
          <Progress value={overallProgress} className="h-1.5 mt-3" />
        </CardHeader>
      </Card>

      {/* Steps List */}
      <div className="space-y-2">
        {steps.map((step) => {
          const isActive = step.status === 'active';
          const isComplete = step.status === 'complete';
          return (
            <div
              key={step.id}
              className={`p-3 rounded-lg border transition-colors ${
                isActive
                  ? 'border-border bg-muted/40 shadow-xs'
                  : isComplete
                  ? 'border-border/50 bg-card'
                  : 'border-border/30 bg-card/60 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                {getStepIcon(step)}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground tracking-tight">{step.label}</h4>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        isActive
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : isComplete
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isActive ? 'In Progress' : isComplete ? 'Done' : 'Pending'}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-normal">
                    {step.details || step.description}
                  </p>

                  {/* Metadata display if available */}
                  {step.metadata && isActive && (
                    <div className="bg-muted/40 rounded-md p-2 space-y-1 text-xs border border-border/40 mt-1.5">
                      {step.metadata.currentItem !== undefined && step.metadata.totalItems && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {step.metadata.itemName || 'Item'} {step.metadata.currentItem}/{step.metadata.totalItems}
                          </span>
                          <span className="font-mono text-muted-foreground tabular-nums">
                            {Math.round((step.metadata.currentItem / step.metadata.totalItems) * 100)}%
                          </span>
                        </div>
                      )}
                      {step.metadata.subProgress && (
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {step.metadata.subProgress}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProcessingView;
