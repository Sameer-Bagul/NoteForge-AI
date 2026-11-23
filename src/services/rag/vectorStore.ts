import { TextChunk, chunkNotebook } from './chunker';
import { getEmbedding, getEmbeddingConfig } from './embeddings';
import { VideoNotes } from '@/types';
import { api } from '@/services/api';

export interface EmbeddedChunk extends TextChunk {
  embedding: number[];
}

export interface SearchResult {
  chunk: TextChunk;
  score: number;
}

// In-memory vector index cache
const memoryIndex: Map<string, EmbeddedChunk[]> = new Map();

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const STORAGE_PREFIX = 'noteforge_vectors_';

export async function indexNotebook(notes: VideoNotes): Promise<EmbeddedChunk[]> {
  const notebookId = notes.notebookId || notes.videoId;
  if (!notebookId) return [];

  // Check memory cache first
  if (memoryIndex.has(notebookId)) {
    return memoryIndex.get(notebookId)!;
  }

  // Check persistent storage
  try {
    const cached = localStorage.getItem(`${STORAGE_PREFIX}${notebookId}`);
    if (cached) {
      const parsed = JSON.parse(cached) as EmbeddedChunk[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryIndex.set(notebookId, parsed);
        return parsed;
      }
    }
  } catch {}

  // Generate chunks
  const rawChunks = chunkNotebook(notes);
  const embeddedChunks: EmbeddedChunk[] = [];
  const cfg = getEmbeddingConfig();

  for (const chunk of rawChunks) {
    const vec = await getEmbedding(chunk.text, cfg);
    embeddedChunks.push({
      ...chunk,
      embedding: vec,
    });
  }

  // Cache in memory
  memoryIndex.set(notebookId, embeddedChunks);

  // Persist to local storage
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${notebookId}`, JSON.stringify(embeddedChunks));
  } catch (e) {
    console.warn('Storage quota exceeded, keeping vectors in memory only:', e);
  }

  return embeddedChunks;
}

export async function searchVault(
  query: string,
  options: {
    currentNotebookId?: string;
    scope: 'chapter' | 'notebook' | 'vault';
    activeChapterId?: string;
    topK?: number;
    threshold?: number;
  }
): Promise<SearchResult[]> {
  const { currentNotebookId, scope, activeChapterId, topK = 5, threshold = 0.25 } = options;

  const cfg = getEmbeddingConfig();
  const queryVec = await getEmbedding(query, cfg);

  let candidatePool: EmbeddedChunk[] = [];

  if (scope === 'chapter' && currentNotebookId) {
    const list = memoryIndex.get(currentNotebookId) || [];
    candidatePool = activeChapterId
      ? list.filter(c => c.chapterId === activeChapterId)
      : list.slice(0, 3);
  } else if (scope === 'notebook' && currentNotebookId) {
    candidatePool = memoryIndex.get(currentNotebookId) || [];
  } else {
    // Vault Scope: search across all cached notebooks in memory & storage
    for (const [_, chunks] of memoryIndex.entries()) {
      candidatePool.push(...chunks);
    }

    // Also check storage keys for other notebooks
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const nbId = key.replace(STORAGE_PREFIX, '');
          if (!memoryIndex.has(nbId)) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const loaded = JSON.parse(raw) as EmbeddedChunk[];
              memoryIndex.set(nbId, loaded);
              candidatePool.push(...loaded);
            }
          }
        }
      }
    } catch {}
  }

  const results: SearchResult[] = [];

  for (const chunk of candidatePool) {
    if (!chunk.embedding || chunk.embedding.length !== queryVec.length) continue;
    const score = cosineSimilarity(queryVec, chunk.embedding);
    if (score >= threshold) {
      results.push({ chunk, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

