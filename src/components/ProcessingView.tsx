import { Check, Loader2, AlertCircle, FileText, Video, Brain, BookOpen, Package } from 'lucide-react';
import { ProcessingStep, VideoInfo } from '@/types';
import VideoPreview from './VideoPreview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

interface ProcessingViewProps {
  steps: ProcessingStep[];
  currentStep: number;
  videoInfo?: VideoInfo;
  videoCount?: number;
  processedVideos?: number;
}

const ProcessingView = ({ steps, currentStep, videoInfo, videoCount, processedVideos }: ProcessingViewProps) => {
  console.log('🎬 ProcessingView render:', {
    totalSteps: steps.length,
    currentStep,
    steps: steps.map(s => ({ id: s.id, status: s.status, label: s.label }))
  });

  const getStepIcon = (step: ProcessingStep, index: number) => {
    const icons = {
      extract: FileText,
      analyze: Brain,
      index: BookOpen,
      notes: FileText,
      assemble: Package
    };

    const IconComponent = icons[step.id as keyof typeof icons] || FileText;

    switch (step.status) {
      case 'complete':
        return (
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center border-2 border-success">
            <Check className="w-6 h-6 text-success" />
          </div>
        );
      case 'active':
        return (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary pulse-glow">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        );
      case 'error':
        return (
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center border-2 border-red-500">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 border-gray-300 dark:border-gray-700">
            <IconComponent className="w-6 h-6 text-gray-400" />
          </div>
        );
    }
  };

  const completedSteps = steps.filter(s => s.status === 'complete').length;
  const overallProgress = Math.round((completedSteps / steps.length) * 100);
  const activeStep = steps.find(s => s.status === 'active');

  return (
    <div className="w-full max-w-5xl mx-auto fade-in space-y-6">
      {/* Header with Overall Progress */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl">Processing Your Content</CardTitle>
              <CardDescription className="text-base mt-2">
                {videoCount ? `Processing ${videoCount} video${videoCount > 1 ? 's' : ''} from playlist` : 'Analyzing video content'}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-primary">{overallProgress}%</div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
          </div>
          <Progress value={overallProgress} className="h-3 mt-4" />
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Steps Panel */}
        <div className="lg:col-span-2 space-y-4">
          {steps.map((step, index) => (
            <Card
              key={step.id}
              className={`transition-all ${step.status === 'active'
                  ? 'border-2 border-blue-500 shadow-lg'
                  : step.status === 'complete'
                    ? 'border-green-500'
                    : ''
                }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {getStepIcon(step, index)}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold">{step.label}</h4>
                      <Badge
                        variant={step.status === 'complete' ? 'default' : step.status === 'active' ? 'secondary' : 'outline'}
                      >
                        {step.status === 'active' ? 'In Progress' : step.status === 'complete' ? 'Done' : 'Pending'}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>

                    {/* Metadata Display */}
                    {step.metadata && step.status === 'active' && (
                      <div className="bg-primary/5 rounded-lg p-3 space-y-2 border border-primary/10">
                        {step.metadata.currentItem !== undefined && step.metadata.totalItems && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-primary">
                              {step.metadata.itemName || 'Item'} {step.metadata.currentItem}/{step.metadata.totalItems}
                            </span>
                            <span className="text-primary/70">
                              {Math.round((step.metadata.currentItem / step.metadata.totalItems) * 100)}%
                            </span>
                          </div>
                        )}
                        {step.metadata.subProgress && (
                          <div className="text-xs text-primary/60">
                            {step.metadata.subProgress}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step Progress Bar */}
                    {step.status === 'active' && step.progress !== undefined && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>{step.progress}%</span>
                        </div>
                        <Progress value={step.progress} className="h-2" />
                      </div>
                    )}

                    {/* Completion Details */}
                    {step.details && step.status === 'complete' && (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <Check className="w-4 h-4" />
                        <span>{step.details}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Sidebar */}
        <div className="space-y-4">
          {/* Video Info */}
          {videoInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Video Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {videoInfo.thumbnail && (
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-full rounded-lg"
                  />
                )}
                <div>
                  <h4 className="font-medium text-sm mb-1">{videoInfo.title}</h4>
                  {videoInfo.duration && (
                    <p className="text-xs text-muted-foreground">Duration: {videoInfo.duration}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Processing Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Steps Completed</span>
                <Badge variant="secondary">{completedSteps}/{steps.length}</Badge>
              </div>
              {videoCount && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Videos</span>
                  <Badge variant="secondary">{videoCount}</Badge>
                </div>
              )}
              {processedVideos !== undefined && videoCount && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Videos Processed</span>
                  <Badge variant="secondary">{processedVideos}/{videoCount}</Badge>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Current Step</span>
                <Badge>{activeStep?.label || 'Initializing'}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Status Message */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-primary animate-spin mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">
                    {activeStep?.label || 'Processing...'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeStep?.metadata?.subProgress || activeStep?.description || 'Please wait while we process your content'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProcessingView;
