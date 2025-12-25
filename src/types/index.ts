export type ProcessingStatus = 'idle' | 'extracting' | 'indexing' | 'awaiting-approval' | 'generating' | 'assembling' | 'complete' | 'error';

export interface VideoInfo {
  id: string;
  title: string;
  duration?: string;
  thumbnail?: string;
}

export interface TranscriptSegment {
  start: number;
  text: string;
}

export interface TopicIndex {
  id: string;
  title: string;
  subtopics?: string[];
}

export interface SubTopic {
  id: string;
  title: string;
  description?: string;
  videoSources: string[];
}

export interface TopicNode {
  id: string;
  title: string;
  description?: string;
  subtopics: SubTopic[];
  videoSources: string[];
  order: number;
}

export interface UnifiedIndex {
  id: string;
  title: string;
  topics: TopicNode[];
  createdAt: string;
  updatedAt: string;
  videoCount: number;
  topicCount: number;
}

export interface TopicNotes {
  topicId: string;
  title: string;
  content: string;
}

export interface VideoNotes {
  videoId: string;
  title: string;
  index: TopicIndex[];
  notes: TopicNotes[];
  fullContent: string;
}

export interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  progress?: number;
  details?: string;
  metadata?: {
    currentItem?: number;
    totalItems?: number;
    itemName?: string;
    subProgress?: string;
  };
}

export interface ProcessingState {
  status: ProcessingStatus;
  currentStep: number;
  steps: ProcessingStep[];
  videoInfo?: VideoInfo;
  index?: UnifiedIndex;  // For approval workflow
  topicIndex?: TopicIndex[];
  notes?: VideoNotes;
  error?: string;
  videoCount?: number;  // Total videos in playlist
  processedVideos?: number;  // Videos processed so far
}
