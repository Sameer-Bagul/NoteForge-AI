export type ProcessingStatus = 'idle' | 'extracting' | 'indexing' | 'generating' | 'assembling' | 'complete' | 'error';

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
}

export interface ProcessingState {
  status: ProcessingStatus;
  currentStep: number;
  steps: ProcessingStep[];
  videoInfo?: VideoInfo;
  topicIndex?: TopicIndex[];
  notes?: VideoNotes;
  error?: string;
}
