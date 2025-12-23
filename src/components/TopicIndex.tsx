import { ChevronRight, Hash } from 'lucide-react';
import { TopicIndex as TopicIndexType } from '@/types';

interface TopicIndexProps {
  topics: TopicIndexType[];
  onTopicClick?: (topicId: string) => void;
  activeTopicId?: string;
}

const TopicIndex = ({ topics, onTopicClick, activeTopicId }: TopicIndexProps) => {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/50">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary" />
          Topic Index
        </h3>
      </div>
      <div className="p-2">
        <nav className="space-y-1">
          {topics.map((topic, index) => (
            <button
              key={topic.id}
              onClick={() => onTopicClick?.(topic.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                activeTopicId === topic.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-secondary text-foreground'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                  activeTopicId === topic.id
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 font-medium text-sm truncate">
                  {topic.title}
                </span>
                <ChevronRight className={`w-4 h-4 transition-transform ${
                  activeTopicId === topic.id 
                    ? 'text-primary translate-x-0.5' 
                    : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                }`} />
              </div>
              {topic.subtopics && topic.subtopics.length > 0 && (
                <div className="ml-9 mt-1.5 space-y-1">
                  {topic.subtopics.map((subtopic, subIndex) => (
                    <p key={subIndex} className="text-xs text-muted-foreground">
                      {subtopic}
                    </p>
                  ))}
                </div>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default TopicIndex;
