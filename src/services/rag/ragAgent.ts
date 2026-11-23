import { VideoNotes, Notebook } from '@/types';
import { CopilotScope, MentionItem, CopilotMessage } from './ragTypes';
import { getAIConfigFallbackChain } from '../nativePipeline';
import { tauriApi } from '../tauri';
import { api } from '../api';

export interface AssembleContextParams {
  scope: CopilotScope;
  currentNotes: VideoNotes;
  activeTopicId?: string;
  quotedText?: string;
  mentions?: MentionItem[];
  extraContext?: string;
}

export function parseTimestampToSeconds(ts: string): number {
  const clean = ts.replace(/[[\]]/g, '').trim();
  const parts = clean.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

export async function assemblePromptContext({
  scope,
  currentNotes,
  activeTopicId,
  quotedText,
  mentions = [],
  extraContext = '',
}: AssembleContextParams): Promise<{ systemPrompt: string; contextPrompt: string }> {
  const systemPrompt = `You are NoteForge Copilot, an expert AI study assistant and technical tutor embedded inside NoteForge AI.
Your goal is to help the user master technical subjects, understand lecture materials, clarify difficult formulas, and debug code from their video notebooks.

RULES:
1. Ground your answers primarily in the provided notebook and chapter materials.
2. Whenever you reference an explanation, code demonstration, formula, or topic that occurs in the lecture video, ALWAYS include clickable timestamp badges in the exact format [MM:SS] or [HH:MM:SS] (e.g. [04:15], [14:22], [01:12:40]). The user can click these to jump the synchronized video player!
3. If the user selected and quoted a specific text excerpt, direct your answer specifically to explain, clarify, or expand upon that quoted passage.
4. Format code using proper Markdown code fences (\`\`\`python, \`\`\`typescript, etc.).
5. Use clear, unslop technical writing. Be concise, direct, and rigorous without fluffy filler.`;

  let context = `### Notebook: "${currentNotes.title}"\n`;

  // Find active chapter if specified
  const activeTopic = activeTopicId
    ? currentNotes.index.find(t => t.id === activeTopicId)
    : currentNotes.index[0];

  const activeNote = activeTopicId
    ? currentNotes.notes.find(n => (n as any).topicId === activeTopicId || n.id === activeTopicId)
    : currentNotes.notes[0];

  // 1. Quoted text takes top priority
  if (quotedText && quotedText.trim().length > 0) {
    context += `\n#### User Highlighted Excerpt:\n> ${quotedText.trim()}\n`;
  }

  // 2. Add Scope-based Context
  if (scope === 'chapter' && activeTopic) {
    context += `\n#### Active Chapter: "${activeTopic.title}" (${activeTopic.timeDisplay || '00:00'})\n`;
    if (activeNote) {
      context += `Content:\n${activeNote.content || ''}\n`;
      if (activeNote.keyTakeaways && activeNote.keyTakeaways.length > 0) {
        context += `Key Takeaways:\n${activeNote.keyTakeaways.map(k => `- ${k}`).join('\n')}\n`;
      }
    }
  } else {
    // Notebook Scope (or Vault baseline)
    context += `\n#### Curriculum Index (${currentNotes.index.length} chapters):\n`;
    currentNotes.index.forEach((t, i) => {
      context += `${i + 1}. [${t.timeDisplay || '00:00'}] ${t.title}\n`;
      if (t.subtopics && t.subtopics.length > 0) {
        context += `   Subtopics: ${t.subtopics.join(', ')}\n`;
      }
    });

    if (activeTopic) {
      context += `\n#### Current Chapter In View: "${activeTopic.title}" (${activeTopic.timeDisplay || '00:00'})\n`;
      if (activeNote) {
        context += `${(activeNote.content || '').slice(0, 3000)}\n`;
      }
    }
  }

  // 3. Add Context from @mentions
  if (mentions.length > 0) {
    context += `\n#### Explicitly Mentioned Context:\n`;
    for (const mention of mentions) {
      if (mention.type === 'chapter') {
        const found = currentNotes.notes.find(n => (n as any).topicId === mention.id || n.id === mention.id);
        if (found) {
          context += `\n--- Mentioned Chapter: "${mention.title}" ---\n${found.content || ''}\n`;
        }
      } else if (mention.type === 'notebook') {
        try {
          const externalNotebook = await api.getNotebook(mention.id);
          if (externalNotebook) {
            context += `\n--- Mentioned Notebook: "${externalNotebook.title}" ---\n`;
            if (externalNotebook.description) context += `Description: ${externalNotebook.description}\n`;
            const chaps = externalNotebook.chapters || [];
            chaps.slice(0, 5).forEach((c, idx) => {
              context += `Chapter ${idx + 1}: ${c.title}\n`;
            });
          }
        } catch (err) {
          console.warn('Failed to load mentioned notebook:', mention.id, err);
        }
      }
    }
  }

  // 4. Extra Vault / Semantic search context if available
  if (extraContext && extraContext.trim()) {
    context += `\n#### Additional Retrieved Knowledge Vault Context:\n${extraContext.trim()}\n`;
  }

  return { systemPrompt, contextPrompt: context };
}

export async function streamCopilotReply(
  userQuery: string,
  history: CopilotMessage[],
  contextInfo: { systemPrompt: string; contextPrompt: string },
  onToken: (token: string) => void
): Promise<string> {
  const fallbackChain = getAIConfigFallbackChain('features');
  if (fallbackChain.length === 0) {
    throw new Error('No AI providers enabled. Please configure Gemini, Grok, or Ollama in Settings.');
  }

  // Format conversational context
  let conversationHistory = '';
  const recentHistory = history.slice(-6); // last 6 turns
  for (const msg of recentHistory) {
    if (msg.role === 'user') {
      conversationHistory += `User: ${msg.content}\n`;
    } else if (msg.role === 'assistant') {
      conversationHistory += `Assistant: ${msg.content}\n`;
    }
  }

  const finalPrompt = `${contextInfo.contextPrompt}

${conversationHistory ? `### Previous Conversation:\n${conversationHistory}\n` : ''}
### Current User Question:
${userQuery}

Please answer accurately and helpfully, citing [MM:SS] timestamps where appropriate:`;

  let lastError: any = null;

  for (let i = 0; i < fallbackChain.length; i++) {
    const aiConfig = fallbackChain[i];
    try {
      const result = await tauriApi.streamLLM(
        finalPrompt,
        contextInfo.systemPrompt,
        aiConfig.provider,
        aiConfig.model,
        aiConfig.baseUrl,
        onToken,
        aiConfig.apiKey
      );

      if (result && result.trim().length > 0) {
        return result;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Copilot] Provider ${aiConfig.provider} (${aiConfig.model}) failed, trying next in chain:`, err);
    }
  }

  throw lastError || new Error('All AI providers in fallback chain failed to generate response.');
}

