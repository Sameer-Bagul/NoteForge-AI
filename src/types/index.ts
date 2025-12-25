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
  topicTitle: string;
  summary: string;
  sections: NoteSection[];
  keyTakeaways: string[];
  videoSources: VideoSourceReference[];
  generatedAt: string;
}

export interface VideoSourceReference {
  videoId: string;
  videoTitle: string;
  timestamps?: number[];
}

export interface CodeSnippet {
  language: string;
  code: string;
  filename?: string;
}

export interface MermaidDiagram {
  type: 'flowchart' | 'sequence' | 'class' | 'er' | 'gantt' | 'pie' | 'mindmap';
  code: string;
  caption?: string;
}

export interface SpecialNote {
  type: 'tip' | 'warning' | 'info' | 'important' | 'caution';
  content: string;
}

export interface NoteSection {
  id: string;
  type: 'paragraph' | 'bullets' | 'numbered' | 'code' | 'mermaid' | 'quote' | 'special' | 'heading';
  content: string;
  level?: number;
  items?: string[];
  codeSnippet?: CodeSnippet;
  diagram?: MermaidDiagram;
  specialNote?: SpecialNote;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  topics: TopicNotes[];
}

export interface NotebookMetadata {
  totalVideos: number;
  totalTopics: number;
  totalWords: number;
  estimatedReadTime: number;
  sourcePlaylistId?: string;
  sourceVideos: VideoInfo[];
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  chapters: Chapter[];
  index: UnifiedIndex;
  metadata: NotebookMetadata;
  createdAt: string;
  updatedAt: string;
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

export interface JobStatus {
  id: string;
  status: string;
  type: 'video' | 'playlist';
  currentStep: number;
  steps: ProcessingStep[];
  videoInfo?: VideoInfo;
  error?: string;
  notebook?: Notebook;
  createdAt: string;
  updatedAt: string;
}
