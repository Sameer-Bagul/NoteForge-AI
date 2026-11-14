import { BookOpen, GitFork, Brain, CheckSquare, Network, Check, Loader2 } from 'lucide-react';
import { ProcessingStatus } from '@/types';

interface StudyBlueprintCardProps {
  status: ProcessingStatus;
  currentStep: number;
  topicCount?: number;
}

export const StudyBlueprintCard = ({
  status,
  currentStep,
  topicCount,
}: StudyBlueprintCardProps) => {
  const isComplete = status === 'complete';
  const isGenerating = status === 'generating';
  const isAssembling = status === 'assembling';
  const isIndexing = status === 'indexing' || status === 'awaiting-approval';

  const assets = [
    {
      id: 'notes',
      icon: BookOpen,
      title: 'Topical Study Guide',
      description: 'Timestamped [mm:ss] notes with deep context & code',
      statusText: isComplete
        ? 'Generated'
        : isGenerating
        ? 'Synthesizing...'
        : isAssembling
        ? 'Assembled'
        : topicCount
        ? `${topicCount} Topics Indexed`
        : 'Queued',
      isActive: isGenerating,
      isDone: isComplete || isAssembling,
    },
    {
      id: 'diagrams',
      icon: GitFork,
      title: 'Mermaid System Diagrams',
      description: 'Flowcharts, architecture graphs & sequence visuals',
      statusText: isComplete
        ? 'Generated'
        : isGenerating
        ? 'Generating Diagrams...'
        : isAssembling
        ? 'Assembled'
        : 'Queued',
      isActive: isGenerating,
      isDone: isComplete || isAssembling,
    },
    {
      id: 'flashcards',
      icon: Brain,
      title: 'Active-Recall Flashcards',
      description: 'Concept definitions ready for spaced repetition',
      statusText: isComplete
        ? 'Deck Ready'
        : isAssembling
        ? 'Compiling Deck...'
        : 'Queued',
      isActive: isAssembling,
      isDone: isComplete,
    },
    {
      id: 'quiz',
      icon: CheckSquare,
      title: 'Self-Check Quizzes',
      description: 'Multiple choice & conceptual review questions',
      statusText: isComplete
        ? 'Questions Ready'
        : isAssembling
        ? 'Synthesizing...'
        : 'Queued',
      isActive: isAssembling,
      isDone: isComplete,
    },
    {
      id: 'mindmap',
      icon: Network,
      title: 'Interactive Mind Map',
      description: 'Draggable visual concept network connecting themes',
      statusText: isComplete
        ? 'Graph Ready'
        : isAssembling
        ? 'Constructing Nodes...'
        : 'Queued',
      isActive: isAssembling,
      isDone: isComplete,
    },
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3 transition-all">
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <div>
          <h3 className="text-xs font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            Study Package Blueprint
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Artifacts being synthesized for this study notebook
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/40">
          5 Artifacts
        </span>
      </div>

      <div className="space-y-2 pt-0.5">
        {assets.map((asset) => {
          const Icon = asset.icon;
          return (
            <div
              key={asset.id}
              className={`flex items-start gap-3 p-2 rounded-lg border transition-all ${
                asset.isActive
                  ? 'bg-primary/5 border-primary/20'
                  : asset.isDone
                  ? 'bg-muted/30 border-border/40'
                  : 'bg-muted/10 border-border/20 opacity-70'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border mt-0.5 ${
                  asset.isActive
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : asset.isDone
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-muted text-muted-foreground/60 border-border/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-medium text-foreground tracking-tight truncate">
                    {asset.title}
                  </h4>
                  <span
                    className={`text-[10px] font-mono shrink-0 flex items-center gap-1 ${
                      asset.isDone
                        ? 'text-emerald-500'
                        : asset.isActive
                        ? 'text-primary'
                        : 'text-muted-foreground/60'
                    }`}
                  >
                    {asset.isDone && <Check className="w-2.5 h-2.5" />}
                    {asset.isActive && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                    {asset.statusText}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate leading-relaxed">
                  {asset.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
