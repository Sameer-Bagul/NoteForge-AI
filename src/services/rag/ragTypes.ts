export type CopilotScope = 'chapter' | 'notebook' | 'vault';

export interface MentionItem {
  id: string;
  type: 'chapter' | 'notebook';
  title: string;
  subtitle?: string;
  chapterIndex?: number;
  startTime?: number;
}

export interface CopilotSourceCitation {
  title: string;
  chapterTitle?: string;
  timestamp?: string;
  seconds?: number;
  snippet?: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  quotedText?: string;
  mentions?: MentionItem[];
  sources?: CopilotSourceCitation[];
  isStreaming?: boolean;
  error?: string;
}

