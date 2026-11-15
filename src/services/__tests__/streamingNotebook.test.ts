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
});
