import { describe, it, expect } from 'vitest';
import { generateNotebookBundleFiles } from '../bundleExport';
import { Notebook } from '@/types';

describe('bundleExport', () => {
  const mockNotebook: Notebook = {
    id: 'nb-test-123',
    title: 'Rust Concurrency Deep Dive',
    description: 'A complete guide to threads, channels, and async in Rust',
    chapters: [
      {
        id: 'chap-1',
        title: 'Core Topics',
        order: 1,
        topics: [
          {
            topicId: 't1',
            topicTitle: 'Introduction to Threads',
            title: 'Introduction to Threads',
            summary: 'Learn about std::thread::spawn and joining.',
            timeDisplay: '02:15',
            startTime: 135,
            sections: [],
            keyTakeaways: ['Threads are OS-backed', 'Join handles ensure completion'],
            videoSources: [],
            generatedAt: new Date().toISOString(),
            content: `## Spawning Threads\n\nHere is how to spawn threads in Rust:\n\n\`\`\`rust\nthread::spawn(|| {});\n\`\`\`\n\n\`\`\`mermaid\nflowchart TD\n  main["Main Thread"] --> worker["Worker Thread"]\n\`\`\``,
          },
          {
            topicId: 't2',
            topicTitle: 'Channels and Message Passing',
            title: 'Channels and Message Passing',
            summary: 'Crossbeam and std::sync::mpsc channels.',
            timeDisplay: '14:30',
            startTime: 870,
            sections: [],
            keyTakeaways: ['mpsc stands for multiple producer single consumer'],
            videoSources: [],
            generatedAt: new Date().toISOString(),
            content: `Channels allow lock-free communication between threads.`,
          },
        ],
      },
    ],
    index: {
      id: 'idx-1',
      title: 'Rust Concurrency Deep Dive',
      topics: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      videoCount: 1,
      topicCount: 2,
    },
    metadata: {
      totalVideos: 1,
      totalTopics: 2,
      totalWords: 500,
      estimatedReadTime: 3,
      sourceVideos: [],
    },
    quiz: [
      {
        id: 'q1',
        type: 'mcq',
        question: 'What does mpsc stand for?',
        options: ['Multi-process Single Thread', 'Multiple Producer Single Consumer', 'Memory Protection System Call'],
        answer: 'Multiple Producer Single Consumer',
        explanation: 'MPSC allows multiple transmitters but only one receiver.',
        topic: 'Channels',
        difficulty: 'easy',
      },
    ],
    interviewQA: [
      {
        id: 'i1',
        category: 'technical',
        question: 'Explain Send and Sync traits in Rust.',
        answer: 'Send indicates ownership can be transferred across threads, while Sync indicates references can be shared.',
        difficulty: 'senior',
        topic: 'Concurrency',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('generates a clean sanitized folder name', () => {
    const { folderName } = generateNotebookBundleFiles(mockNotebook);
    expect(folderName).toBe('Rust_Concurrency_Deep_Dive');
  });

  it('generates a README.md with table of contents and relative markdown links', () => {
    const { files } = generateNotebookBundleFiles(mockNotebook);
    expect(files['README.md']).toBeDefined();
    expect(files['README.md']).toContain('# Rust Concurrency Deep Dive');
    expect(files['README.md']).toContain('1. [Introduction to Threads](01_Chapters/01_Introduction_to_Threads.md)');
    expect(files['README.md']).toContain('2. [Channels and Message Passing](01_Chapters/02_Channels_and_Message_Passing.md)');
    expect(files['README.md']).toContain('02_Exercises/quiz.md');
    expect(files['README.md']).toContain('02_Exercises/interview_qa.md');
  });

  it('generates chapter files with video anchors and navigation footers', () => {
    const { files } = generateNotebookBundleFiles(mockNotebook);
    const chap1 = files['01_Chapters/01_Introduction_to_Threads.md'];
    expect(chap1).toBeDefined();
    expect(chap1).toContain('# Introduction to Threads');
    expect(chap1).toContain('> **Video Anchor**: `[02:15]`');
    expect(chap1).toContain('## Spawning Threads');
    expect(chap1).toContain('### Key Takeaways');
    expect(chap1).toContain('Next: Channels and Message Passing →');

    const chap2 = files['01_Chapters/02_Channels_and_Message_Passing.md'];
    expect(chap2).toBeDefined();
    expect(chap2).toContain('# Channels and Message Passing');
    expect(chap2).toContain('← Previous: Introduction to Threads');
  });

  it('extracts Mermaid diagrams into 03_Diagrams/*.mmd', () => {
    const { files } = generateNotebookBundleFiles(mockNotebook);
    const diagramKeys = Object.keys(files).filter(k => k.startsWith('03_Diagrams/'));
    expect(diagramKeys.length).toBe(1);
    expect(files[diagramKeys[0]]).toContain('flowchart TD');
    expect(files[diagramKeys[0]]).toContain('main["Main Thread"] --> worker["Worker Thread"]');
  });

  it('generates collapsible self-check quiz and interview questions', () => {
    const { files } = generateNotebookBundleFiles(mockNotebook);
    const quiz = files['02_Exercises/quiz.md'];
    expect(quiz).toBeDefined();
    expect(quiz).toContain('What does mpsc stand for?');
    expect(quiz).toContain('<details>');
    expect(quiz).toContain('**Correct Answer**: `Multiple Producer Single Consumer`');

    const interview = files['02_Exercises/interview_qa.md'];
    expect(interview).toBeDefined();
    expect(interview).toContain('Explain Send and Sync traits in Rust.');
    expect(interview).toContain('Send indicates ownership can be transferred');
  });
});

