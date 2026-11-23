import { describe, it, expect, vi } from 'vitest';
import { chunkNotebook } from '../chunker';
import { generateLocalSemanticVector } from '../embeddings';
import { cosineSimilarity, indexNotebook, searchVault } from '../vectorStore';
import { assemblePromptContext, parseTimestampToSeconds } from '../ragAgent';
import { VideoNotes } from '@/types';

describe('RAG System Tests', () => {
  const mockNotes: VideoNotes = {
    videoId: 'vid-123',
    notebookId: 'nb-123',
    title: 'Distributed Systems & Consensus',
    index: [
      {
        id: 'topic-1',
        title: 'Introduction to Paxos and Raft',
        subtopics: ['Replication', 'Quorums'],
        startTime: 60,
        endTime: 300,
        timeDisplay: '01:00',
      },
      {
        id: 'topic-2',
        title: 'Leader Election Protocol',
        subtopics: ['Heartbeats', 'Terms'],
        startTime: 301,
        endTime: 600,
        timeDisplay: '05:01',
      },
    ],
    notes: [
      {
        id: 'note-1',
        topicId: 'topic-1',
        title: 'Introduction to Paxos and Raft',
        content: 'Paxos ensures consensus across an asynchronous network with crash-recovery failures. Quorum intersection guarantees safety.',
        keyTakeaways: ['Quorum intersection prevents split-brain', 'Leaderless consensus is resilient'],
      } as any,
      {
        id: 'note-2',
        topicId: 'topic-2',
        title: 'Leader Election Protocol',
        content: 'In Raft, candidate nodes transition to leader upon receiving votes from a majority of the cluster.',
        keyTakeaways: ['Randomized election timeouts prevent split votes'],
      } as any,
    ],
  };

  describe('Chunker', () => {
    it('should split notebook into topic chunks preserving timestamps', () => {
      const chunks = chunkNotebook(mockNotes, 500);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].chapterTitle).toBe('Introduction to Paxos and Raft');
      expect(chunks[0].startTime).toBe(60);
      expect(chunks[0].timeDisplay).toBe('01:00');
      expect(chunks[0].text).toContain('Paxos ensures consensus');
      expect(chunks[0].text).toContain('Key Takeaways');
    });
  });

  describe('Embeddings & Vector Cosine Similarity', () => {
    it('should generate normalized 256-dim semantic vectors', () => {
      const vec = generateLocalSemanticVector('Distributed consensus algorithms');
      expect(vec.length).toBe(256);

      // Verify L2 norm is ~1
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 3);
    });

    it('should calculate accurate cosine similarity', () => {
      const vecA = [1, 0, 0];
      const vecB = [1, 0, 0];
      const vecC = [0, 1, 0];

      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 4);
      expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0, 4);
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it('should index and perform similarity search', async () => {
      const embedded = await indexNotebook(mockNotes);
      expect(embedded.length).toBeGreaterThan(0);
      expect(embedded[0].embedding.length).toBe(256);

      const searchResults = await searchVault('Paxos quorum consensus safety', {
        currentNotebookId: 'nb-123',
        scope: 'notebook',
        topK: 2,
      });

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].chunk.chapterTitle).toBe('Introduction to Paxos and Raft');
      expect(searchResults[0].score).toBeGreaterThan(0.2);
    });
  });

  describe('Timestamp Parser', () => {
    it('should parse MM:SS and HH:MM:SS timestamps to seconds', () => {
      expect(parseTimestampToSeconds('[01:23]')).toBe(83);
      expect(parseTimestampToSeconds('05:00')).toBe(300);
      expect(parseTimestampToSeconds('[01:02:03]')).toBe(3723);
      expect(parseTimestampToSeconds('invalid')).toBe(0);
    });
  });

  describe('Context Assembler', () => {
    it('should scope context to single chapter when scope is chapter', async () => {
      const { contextPrompt, systemPrompt } = await assemblePromptContext({
        scope: 'chapter',
        currentNotes: mockNotes,
        activeTopicId: 'topic-1',
      });

      expect(systemPrompt).toContain('NoteForge Copilot');
      expect(contextPrompt).toContain('Active Chapter: "Introduction to Paxos and Raft"');
      expect(contextPrompt).toContain('Quorum intersection guarantees safety');
      expect(contextPrompt).not.toContain('Candidate nodes transition');
    });

    it('should prioritize quoted excerpt and @mentions', async () => {
      const { contextPrompt } = await assemblePromptContext({
        scope: 'notebook',
        currentNotes: mockNotes,
        quotedText: 'Randomized election timeouts prevent split votes',
        mentions: [
          {
            id: 'topic-2',
            type: 'chapter',
            title: 'Leader Election Protocol',
          },
        ],
      });

      expect(contextPrompt).toContain('User Highlighted Excerpt:');
      expect(contextPrompt).toContain('Randomized election timeouts prevent split votes');
      expect(contextPrompt).toContain('Mentioned Chapter: "Leader Election Protocol"');
    });
  });
});

