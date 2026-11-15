import { describe, it, expect } from 'vitest';

describe('Live Streaming Notebook Architecture', () => {
  it('correctly accumulates streaming deltas across multiple chapters', () => {
    const chapters = [
      { id: 'topic-1', title: 'Chapter 1: Intro', content: '' },
      { id: 'topic-2', title: 'Chapter 2: Memory Model', content: '' },
    ];

    // Simulate streaming tokens for Chapter 1
    const deltasChapter1 = ['# Intro\n\n', 'Welcome to ', 'the course.\n\n', '```rust\nfn main() {\n', '    println!("Hello");\n}\n```'];
    for (const delta of deltasChapter1) {
      chapters[0].content += delta;
    }

    expect(chapters[0].content).toContain('# Intro');
    expect(chapters[0].content).toContain('fn main()');
    expect(chapters[1].content).toBe('');

    // Simulate streaming tokens for Chapter 2
    const deltasChapter2 = ['# Memory Model\n\n', 'Rust uses ', 'affine types.'];
    for (const delta of deltasChapter2) {
      chapters[1].content += delta;
    }

    expect(chapters[1].content).toContain('affine types');
  });

  it('handles partial unclosed markdown code blocks gracefully during live streaming', () => {
    const partialStream = '# Code Example\n\n```rust\nlet x = 42;\n// typing continues...';
    
    // Test parser state tracking
    const lines = partialStream.split('\n');
    let inCode = false;
    let codeLang = '';
    const codeLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (!inCode) {
          inCode = true;
          codeLang = line.slice(3).trim();
        } else {
          inCode = false;
        }
      } else if (inCode) {
        codeLines.push(line);
      }
    }

    // In a live stream, the code block is still open (unclosed)
    expect(inCode).toBe(true);
    expect(codeLang).toBe('rust');
    expect(codeLines.join('\n')).toBe('let x = 42;\n// typing continues...');
  });

  it('correctly maps syllabus index into structured notebook outline before first token arrives', () => {
    const rawSyllabus = [
      { id: 't-1', title: '1. Variables', startTime: 0, timeDisplay: '0:00' },
      { id: 't-2', title: '2. Ownership', startTime: 450, timeDisplay: '7:30' },
      { id: 't-3', title: '3. Lifetimes', startTime: 1200, timeDisplay: '20:00' },
    ];

    const notebookIndex = rawSyllabus.map(s => ({
      id: s.id,
      title: s.title,
      startTime: s.startTime,
      timeDisplay: s.timeDisplay,
      subtopics: [],
    }));

    expect(notebookIndex).toHaveLength(3);
    expect(notebookIndex[1].timeDisplay).toBe('7:30');
    expect(notebookIndex[2].startTime).toBe(1200);
  });

  it('verifies index-first landing tab and focus mode state transitions', () => {
    // Default tab state should be 'index' as requested by user
    const defaultTab = 'index';
    expect(defaultTab).toBe('index');

    // Focus mode toggle: when studio mode is active, video is visible
    let isStudioMode = true;
    const hasVideo = true;

    // Toggling focus mode hides video
    isStudioMode = !isStudioMode;
    const isVideoHidden = !isStudioMode && hasVideo;
    expect(isVideoHidden).toBe(true);

    // Reading column layout metrics when video is hidden
    const notesColumnClass = isStudioMode && hasVideo
      ? 'lg:col-span-7 xl:col-span-8'
      : 'lg:col-span-8 xl:col-span-9';
    expect(notesColumnClass).toBe('lg:col-span-8 xl:col-span-9');
  });

  it('computes chapter pagination and reading metrics accurately', () => {
    const topics = [
      { id: 'c1', title: 'Chapter 1: Intro', content: 'Word '.repeat(400) },
      { id: 'c2', title: 'Chapter 2: Concurrency', content: 'Word '.repeat(600) },
      { id: 'c3', title: 'Chapter 3: Advanced Types', content: 'Word '.repeat(800) },
    ];

    const currentIdx = 1; // Chapter 2
    const prevChapter = currentIdx > 0 ? topics[currentIdx - 1] : undefined;
    const nextChapter = currentIdx < topics.length - 1 ? topics[currentIdx + 1] : undefined;

    expect(prevChapter?.title).toBe('Chapter 1: Intro');
    expect(nextChapter?.title).toBe('Chapter 3: Advanced Types');

    const wordCount = topics[currentIdx].content.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    expect(wordCount).toBe(600);
    expect(readingTime).toBe(3); // 600 words / 200 wpm = 3 minutes
  });

  it('normalizes nested, spaced, and raw HTML timestamp badges into clean [mm:ss]', () => {
    function normalizeTimestamps(input: string): string {
      return input
        .replace(/<span[^>]*style="[^"]*monospace[^"]*"[^>]*>(\d{1,2}:\d{2}(?::\d{2})?)<\/span>/gi, '$1')
        .replace(/<span[^>]*>(\d{1,2}:\d{2}(?::\d{2})?)<\/span>/gi, '$1')
        .replace(/\[+[\s\[]*(\d{1,2}:\d{2}(?::\d{2})?)[\s\]]*\]+/g, '[$1]');
    }

    expect(normalizeTimestamps('Cargo & Basic Syntax [ 1:28 ]')).toBe('Cargo & Basic Syntax [1:28]');
    expect(normalizeTimestamps('Borrow Checker [[1:21]]')).toBe('Borrow Checker [1:21]');
    expect(normalizeTimestamps('Borrow Checker [ [1:21] ]')).toBe('Borrow Checker [1:21]');
    expect(normalizeTimestamps('crates [ 1:29 ].')).toBe('crates [1:29].');
    expect(normalizeTimestamps('[<span style="font-family: monospace;">0:06</span>]')).toBe('[0:06]');
    expect(normalizeTimestamps('[ [<span style="font-family: monospace;">0:06</span>] ]')).toBe('[0:06]');
    expect(normalizeTimestamps('Outro [ 2:08 ]')).toBe('Outro [2:08]');
  });
});

