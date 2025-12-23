import { Check, Loader2, AlertCircle } from 'lucide-react';
import { ProcessingStep } from '@/types';

interface ProcessingViewProps {
  steps: ProcessingStep[];
  currentStep: number;
  videoTitle?: string;
}

const ProcessingView = ({ steps, currentStep, videoTitle }: ProcessingViewProps) => {
  const getStepIcon = (step: ProcessingStep) => {
    switch (step.status) {
      case 'complete':
        return (
          <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center">
            <Check className="w-5 h-5 text-success-foreground" />
          </div>
        );
      case 'active':
        return (
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center pulse-glow">
            <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
          </div>
        );
      case 'error':
        return (
          <div className="w-10 h-10 rounded-full bg-destructive flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-destructive-foreground" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">
              {steps.indexOf(step) + 1}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto fade-in">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-semibold text-foreground mb-2">
          Processing Your Video
        </h3>
        {videoTitle && (
          <p className="text-muted-foreground truncate max-w-md mx-auto">
            {videoTitle}
          </p>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-1">
          {steps.map((step, index) => (
            <div key={step.id}>
              <div className="flex items-start gap-4 py-3">
                {getStepIcon(step)}
                <div className="flex-1 pt-1">
                  <h4 className={`font-medium ${
                    step.status === 'active' 
                      ? 'text-foreground' 
                      : step.status === 'complete'
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                  {step.status === 'active' && step.progress !== undefined && (
                    <div className="mt-3">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {step.progress}% complete
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="ml-5 h-4 border-l-2 border-border" />
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-6">
        This may take a few minutes for longer videos...
      </p>
    </div>
  );
};

export default ProcessingView;
