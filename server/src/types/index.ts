// Video and Transcript Types
export interface VideoInfo {
  id: string;
  title: string;
  duration?: string;
  thumbnail?: string;
  channelName?: string;
}

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface VideoTranscript {
  videoId: string;
  videoInfo: VideoInfo;
  segments: TranscriptSegment[];
  fullText: string;
  extractedAt: string;
}

// Playlist Types
export interface PlaylistInfo {
  id: string;
  title: string;
  videoCount: number;
  videos: VideoInfo[];
}

// Topic Index Types
export interface SubTopic {
  id: string;
  title: string;
  description?: string;
  videoSources: string[]; // Video IDs where this subtopic appears
}

export interface TopicNode {
  id: string;
  title: string;
  description?: string;
  subtopics: SubTopic[];
  videoSources: string[]; // Video IDs where this topic appears
  order: number;
}

export interface UnifiedIndex {
  id: string;
  title: string; // Playlist or project title
  topics: TopicNode[];
  createdAt: string;
  updatedAt: string;
  videoCount: number;
  topicCount: number;
}

// Notes Types
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
  level?: number; // For headings (h2, h3, h4)
  items?: string[]; // For bullet/numbered lists
  codeSnippet?: CodeSnippet;
  diagram?: MermaidDiagram;
  specialNote?: SpecialNote;
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
  timestamps?: number[]; // Relevant timestamps in the video
}

// Full Book/Notebook Types
export interface Chapter {
  id: string;
  title: string;
  order: number;
  topics: TopicNotes[];
}

export interface MindMapData {
  topicId: string;
  nodes: any[];
  edges: any[];
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'short';
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface InterviewQuestion {
  id: string;
  category: 'conceptual' | 'technical' | 'practical';
  question: string;
  answer: string;
  followUp?: string;
  difficulty: 'junior' | 'mid' | 'senior';
  topic: string;
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  chapters: Chapter[];
  index: UnifiedIndex;
  metadata: NotebookMetadata;
  mindMaps?: Record<string, MindMapData>;
  quiz?: QuizQuestion[];
  interviewQA?: InterviewQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface NotebookMetadata {
  totalVideos: number;
  totalTopics: number;
  totalWords: number;
  estimatedReadTime: number; // in minutes
  sourcePlaylistId?: string;
  sourceVideos: VideoInfo[];
}

// Processing Types
export type ProcessingStatus =
  | 'idle'
  | 'extracting-transcripts'
  | 'analyzing-content'
  | 'generating-index'
  | 'awaiting-approval'
  | 'generating-notes'
  | 'assembling-notebook'
  | 'complete'
  | 'error'
  | 'paused-rate-limit';

/**
 * 1 = Strict      – only transcript content, no AI additions
 * 2 = Balanced    – transcript + brief clarifications
 * 3 = Enhanced    – transcript + related concepts & diagrams
 * 4 = Creative    – full AI knowledge, deep dives, extras
 */
export type CreativityLevel = 1 | 2 | 3 | 4;

export interface JobOptions {
  userNotes?: string;        // Extra context/instructions from the user
  creativityLevel?: CreativityLevel;
  generationMode?: 'topical' | 'chronological';
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

export interface ProcessingJob {
  id: string;
  status: ProcessingStatus;
  steps: ProcessingStep[];
  currentStep: number;
  videos: VideoInfo[];
  transcripts: VideoTranscript[];
  index?: UnifiedIndex;
  notebook?: Notebook;
  partialNotes?: any[]; // Stores notes generated before a rate limit pause
  error?: string;
  options?: JobOptions;   // User-provided notes + creativity level
  createdAt: string;
  updatedAt: string;
}

// LLM Types
export interface LLMConfig {
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

// AI Provider Settings
export type AIProvider = 'gemini' | 'grok' | 'lmstudio' | 'ollama';

export interface ProviderConfig {
  provider: AIProvider;
  enabled: boolean;
  apiKey?: string;   // Single API key
  model: string;
  indexingModel?: string; // Faster model for topic extraction
  baseUrl?: string;   // For local providers (Ollama, LM Studio)
  priority: number;   // Lower number = tried first
}

export interface TaskMapping {
  notes: AIProvider | 'auto';
  indexing: AIProvider | 'auto';
  features: AIProvider | 'auto';
  [key: string]: AIProvider | 'auto';
}

export interface AppSettings {
  providers: ProviderConfig[];
  taskMapping: TaskMapping;
  pineconeApiKey?: string;
  pineconeIndex?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: number;
}
