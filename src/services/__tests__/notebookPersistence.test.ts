import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api';
import { tauriApi } from '../tauri';
import { Notebook } from '@/types';

vi.mock('../tauri', () => ({
  isTauri: vi.fn(() => true),
  tauriApi: {
    getNotebook: vi.fn(),
    saveNotebook: vi.fn(),
    listNotebooks: vi.fn(),
  },
}));

describe('Notebook Assets & Flow Diagram Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deep merge topic mind maps without overwriting existing topics', async () => {
    const existingNotebook: Notebook = {
      id: 'nb-test-123',
      title: 'Rust Architecture',
      description: 'Test Guide',
      chapters: [],
      index: { topics: [] } as any,
      metadata: {} as any,
      mindMaps: {
        'topic-1': {
          topicId: 'topic-1',
          nodes: [{ id: 'root', type: 'central', data: { label: 'Topic 1 Root' }, position: { x: 0, y: 0 } }],
          edges: [],
        },
      },
      createdAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T00:00:00.000Z',
    };

    (tauriApi.getNotebook as any).mockResolvedValueOnce({
      id: 'nb-test-123',
      job_id: 'job-123',
      title: 'Rust Architecture',
      content_json: JSON.stringify(existingNotebook),
      created_at: '2026-11-15T00:00:00.000Z',
    });

    (tauriApi.saveNotebook as any).mockResolvedValueOnce(undefined);

    const topic2Map = {
      'topic-2': {
        topicId: 'topic-2',
        nodes: [{ id: 'root', type: 'central', data: { label: 'Topic 2 Root' }, position: { x: 0, y: 0 } }],
        edges: [],
      },
    };

    const updated = await api.updateNotebook('nb-test-123', { mindMaps: topic2Map });

    expect(tauriApi.saveNotebook).toHaveBeenCalledTimes(1);
    const savedPayload = (tauriApi.saveNotebook as any).mock.calls[0][0];
    const parsedSaved = JSON.parse(savedPayload.content_json);

    // Verify BOTH topic-1 and topic-2 are preserved
    expect(parsedSaved.mindMaps['topic-1']).toBeDefined();
    expect(parsedSaved.mindMaps['topic-2']).toBeDefined();
    expect(parsedSaved.mindMaps['topic-1'].nodes[0].data.label).toBe('Topic 1 Root');
    expect(parsedSaved.mindMaps['topic-2'].nodes[0].data.label).toBe('Topic 2 Root');
    expect(updated.mindMaps?.['topic-1']).toBeDefined();
    expect(updated.mindMaps?.['topic-2']).toBeDefined();
  });

  it('should persist generated quiz questions to SQLite', async () => {
    const existingNotebook: Notebook = {
      id: 'nb-quiz-test',
      title: 'Systems Programming',
      description: 'Test Guide',
      chapters: [],
      index: { topics: [] } as any,
      metadata: {} as any,
      createdAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T00:00:00.000Z',
    };

    (tauriApi.getNotebook as any).mockResolvedValueOnce({
      id: 'nb-quiz-test',
      job_id: 'job-quiz-test',
      title: 'Systems Programming',
      content_json: JSON.stringify(existingNotebook),
      created_at: '2026-11-15T00:00:00.000Z',
    });

    (tauriApi.saveNotebook as any).mockResolvedValueOnce(undefined);

    const quizQuestions = [
      {
        id: 'q1',
        type: 'mcq' as const,
        question: 'What is ownership in Rust?',
        options: ['GC', 'Compile-time memory safety', 'Manual free', 'None'],
        answer: 'Compile-time memory safety',
        explanation: 'Ownership is a compile-time system.',
        topic: 'Ownership',
        difficulty: 'medium' as const,
      },
    ];

    const updated = await api.updateNotebook('nb-quiz-test', { quiz: quizQuestions });

    expect(tauriApi.saveNotebook).toHaveBeenCalledTimes(1);
    const savedRecord = (tauriApi.saveNotebook as any).mock.calls[0][0];
    const parsed = JSON.parse(savedRecord.content_json);

    expect(parsed.quiz).toHaveLength(1);
    expect(parsed.quiz[0].question).toBe('What is ownership in Rust?');
    expect(updated.quiz).toHaveLength(1);
  });

  it('should fall back to listing notebooks when looked up by jobId', async () => {
    const existingNotebook: Notebook = {
      id: 'nb-real-id',
      title: 'Full Guide',
      description: 'Guide',
      chapters: [],
      index: { topics: [] } as any,
      metadata: {} as any,
      createdAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T00:00:00.000Z',
    };

    // getNotebook by jobId fails
    (tauriApi.getNotebook as any).mockResolvedValueOnce(null);
    // listNotebooks succeeds and matches job_id
    (tauriApi.listNotebooks as any).mockResolvedValueOnce([
      {
        id: 'nb-real-id',
        job_id: 'job-alias-id',
        title: 'Full Guide',
        content_json: JSON.stringify(existingNotebook),
        created_at: '2026-11-15T00:00:00.000Z',
      },
    ]);

    (tauriApi.saveNotebook as any).mockResolvedValueOnce(undefined);

    const updated = await api.updateNotebook('job-alias-id', {
      title: 'Full Guide Updated',
    });

    expect(updated.title).toBe('Full Guide Updated');
    const savedRecord = (tauriApi.saveNotebook as any).mock.calls[0][0];
    expect(savedRecord.id).toBe('nb-real-id');
  });
});
