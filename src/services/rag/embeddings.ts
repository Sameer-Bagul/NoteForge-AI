import { AppSettings, ProviderConfig } from '@/types/settings';

export interface EmbeddingProviderConfig {
  provider: 'gemini' | 'ollama' | 'local';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export function getEmbeddingConfig(): EmbeddingProviderConfig {
  try {
    const raw = localStorage.getItem('noteforge_ai_settings');
    if (raw) {
      const parsed = JSON.parse(raw) as AppSettings;
      const gemini = parsed.providers?.find(p => p.provider === 'gemini' && p.enabled && p.apiKey?.trim());
      if (gemini && gemini.apiKey) {
        return {
          provider: 'gemini',
          apiKey: gemini.apiKey,
          model: 'text-embedding-004',
        };
      }
      const ollama = parsed.providers?.find(p => p.provider === 'ollama' && p.enabled);
      if (ollama) {
        return {
          provider: 'ollama',
          baseUrl: ollama.baseUrl || 'http://localhost:11434',
          model: 'nomic-embed-text',
        };
      }
    }
  } catch {}

  return { provider: 'local' };
}

// Universal fast hashing vector generator (100% offline, zero dependencies)
export function generateLocalSemanticVector(text: string, dim: number = 256): number[] {
  const vec = new Float32Array(dim);
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);

  if (words.length === 0) return Array.from(vec);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Fowler-Noll-Vo / 32-bit FNV-1a hash
    let hash = 2166136261;
    for (let j = 0; j < word.length; j++) {
      hash ^= word.charCodeAt(j);
      hash = Math.imul(hash, 16777619);
    }
    const idx = Math.abs(hash) % dim;
    const weight = 1.0 + Math.log(1 + (word.length / 5));
    vec[idx] += weight;

    // Bi-gram hash for word sequences
    if (i < words.length - 1) {
      const nextWord = words[i + 1];
      let biHash = hash ^ 37;
      for (let j = 0; j < nextWord.length; j++) {
        biHash ^= nextWord.charCodeAt(j);
        biHash = Math.imul(biHash, 16777619);
      }
      const biIdx = Math.abs(biHash) % dim;
      vec[biIdx] += 1.5;
    }
  }

  // L2 Normalize vector
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vec[i] /= norm;
    }
  }

  return Array.from(vec);
}

export async function getEmbedding(text: string, config?: EmbeddingProviderConfig): Promise<number[]> {
  const cfg = config || getEmbeddingConfig();

  if (cfg.provider === 'gemini' && cfg.apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${cfg.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: text.slice(0, 4000) }] },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.embedding?.values && Array.isArray(data.embedding.values)) {
          return data.embedding.values;
        }
      }
    } catch (err) {
      console.warn('Gemini embedding failed, falling back to local vector:', err);
    }
  }

  if (cfg.provider === 'ollama' && cfg.baseUrl) {
    try {
      const url = `${cfg.baseUrl.replace(/\/$/, '')}/api/embeddings`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cfg.model || 'nomic-embed-text',
          prompt: text.slice(0, 4000),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.embedding && Array.isArray(data.embedding)) {
          return data.embedding;
        }
      }
    } catch (err) {
      console.warn('Ollama embedding failed, falling back to local vector:', err);
    }
  }

  // Universal offline fallback
  return generateLocalSemanticVector(text);
}

export async function getEmbeddingsBatch(texts: string[], config?: EmbeddingProviderConfig): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    const vec = await getEmbedding(text, config);
    results.push(vec);
  }
  return results;
}

