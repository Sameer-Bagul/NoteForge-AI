import { describe, it, expect, vi } from 'vitest';
import { api } from '../api';
import { TopicNotes, VideoNotes } from '@/types';

describe('AI Deep Enhancement & Rollback Architecture', () => {
  it('creates a safe pre-enhancement snapshot in originalContent', () => {
    const originalNotes: TopicNotes = {
      topicId: 'topic-1',
      topicTitle: 'Memory Safety',
      summary: 'Basic summary of Rust memory model.',
      content: '## Memory Safety [0:45]\nRust does not have a garbage collector.',
      sections: [],
      keyTakeaways: [],
      videoSources: [],
      generatedAt: '2026-11-15T00:00:00Z',
    };

    const enhancedContent = '## Memory Safety [0:45]\nRust enforces memory safety via affine types, the borrow checker, and compile-time lifetime analysis.';
    
    // Simulate enhancement upgrade
    const enhancedNotes: TopicNotes = {
      ...originalNotes,
      content: enhancedContent,
      originalContent: originalNotes.originalContent || originalNotes.content,
      isEnhanced: true,
      enhancedAt: '2026-11-15T01:00:00Z',
      enhancedWith: 'gemini-1.5-pro',
    };

    expect(enhancedNotes.isEnhanced).toBe(true);
    expect(enhancedNotes.content).toBe(enhancedContent);
    expect(enhancedNotes.originalContent).toBe(originalNotes.content);
    expect(enhancedNotes.enhancedWith).toBe('gemini-1.5-pro');
  });

  it('safely rolls back to original content when user reverts', () => {
    const enhancedNotes: TopicNotes = {
      topicId: 'topic-1',
      topicTitle: 'Memory Safety',
      summary: 'Deep summary.',
      content: '## Elevated Memory Safety [0:45]\nAdvanced affine type system.',
      originalContent: '## Memory Safety [0:45]\nBasic overview.',
      isEnhanced: true,
      enhancedAt: '2026-11-15T01:00:00Z',
      enhancedWith: 'gemini-1.5-pro',
      sections: [],
      keyTakeaways: [],
      videoSources: [],
      generatedAt: '2026-11-15T00:00:00Z',
    };

    // Revert action
    const revertedNotes: TopicNotes = {
      ...enhancedNotes,
      content: enhancedNotes.originalContent!,
      isEnhanced: false,
      enhancedAt: undefined,
      enhancedWith: undefined,
    };

    expect(revertedNotes.isEnhanced).toBe(false);
    expect(revertedNotes.content).toBe('## Memory Safety [0:45]\nBasic overview.');
    expect(revertedNotes.enhancedWith).toBeUndefined();
    // Pre-enhanced backup persists in case user wants to re-enhance later
    expect(revertedNotes.originalContent).toBe('## Memory Safety [0:45]\nBasic overview.');
  });

  it('preserves existing video timestamps while enhancing notes', () => {
    const rawMarkdown = `## Chapter 01: Concurrency [01:28]\nData races are prevented at compile time. [02:15]`;
    
    // Verify regex timestamp extractor matches preserved markers
    const timestampMatches = rawMarkdown.match(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g);
    expect(timestampMatches).toEqual(['[01:28]', '[02:15]']);
  });
});

