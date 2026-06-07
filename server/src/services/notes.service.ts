import { v4 as uuidv4 } from 'uuid';
import {
  VideoTranscript,
  UnifiedIndex,
  TopicNode,
  TopicNotes,
  NoteSection,
  Notebook,
  Chapter,
  NotebookMetadata,
  VideoSourceReference,
  JobOptions
} from '../types/index.js';
import { multiLlmService as llmService } from './multi-llm.service.js';
import { ragService } from './rag.service.js';
import { countWords, estimateReadingTime } from '../utils/youtube.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NOTES_DIR = path.join(__dirname, '../../storage/notes');
const NOTEBOOKS_DIR = path.join(__dirname, '../../storage/notebooks');

// Ensure storage directories exist
[NOTES_DIR, NOTEBOOKS_DIR].forEach((dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export class NotesService {

  // Generate notes for a single topic
  async generateTopicNotes(
    topic: TopicNode,
    transcripts: VideoTranscript[],
    onSubProgress?: (detail: string) => void,
    options?: JobOptions
  ): Promise<TopicNotes> {
    console.log(`Generating notes for topic: ${topic.title}`);

    const level = options?.creativityLevel ?? 2;
    const userNotesSection = options?.userNotes
      ? `\n\nUSER INSTRUCTIONS (follow these throughout):\n"""\n${options.userNotes}\n"""`
      : '';

    // Build creativity-aware writer persona
    const creativityGuidance =
      level === 1
        ? `STRICT MODE: Write notes based STRICTLY on what is said in the transcript. Do NOT add any information not explicitly present in the source material.`
        : level === 2
          ? `BALANCED MODE: Primarily use transcript content. Add brief clarifications of unclear terms — keep additions minimal and clearly grounded.`
          : level === 3
            ? `ENHANCED MODE: Use the transcript as the foundation. Enrich with related concepts, practical examples, and diagrams (mermaid) to deepen understanding. Additions should feel like natural extensions.`
            : `CREATIVE MODE: Use the transcript as a starting point. Write deeply detailed notes enriched with full subject knowledge — background theory, advanced insights, real-world applications, code examples. Make it publication-quality.`;

    // Running notes format guidance
    const runningNotesGuidance = `RUNNING NOTES FORMAT:
Write like a very attentive, knowledgeable student taking comprehensive class notes in real-time:
- Open with a brief framing paragraph ("In this section we explore...")
- Write in flowing, connected prose with smooth transitions between ideas
- Use headings (##, ###) to break major sections, but write WITHIN sections in paragraphs
- Reserve bullet points only for genuinely list-like content (steps, comparisons, feature lists)
- Highlight key terms in **bold** when first introduced
- Add inline \`code\` for technical identifiers
- CITE TIMESTAMPS: Whenever you mention a specific concept, feature, or claim from the transcript, cite the exact timestamp (e.g., "[12:34]") if available in the text.
- End each major section with a brief connector to the next
- Close the entire topic with a "## Key Takeaways" section in bullet form
- AIM FOR LENGTH: write at least 600-1000 words per topic — comprehensive beats concise`;

    const systemPrompt = `You are an expert technical writer producing premium, long-form study notes.

${creativityGuidance}

${runningNotesGuidance}

Formatting requirements:
- Use markdown (##/### headings, flowing paragraphs, bullets only when truly list-like)
- Code blocks with language tag: \`\`\`javascript ... \`\`\`
- Mermaid diagrams for architectures/flows: \`\`\`mermaid ... \`\`\`
- Callouts: > **💡 Tip:** ..., > **⚠️ Warning:** ..., > **📌 Important:** ...
- Bold for key terms on first mention${userNotesSection}`;

    try {
      const isCloud = llmService.isPrimaryCloudProvider();
      const provider = llmService.getPrimaryProvider();
      let generatedContent: string;

      if (isCloud) {
        // ─── CLOUD PATH (Gemini / Grok) ──────────────────────────────────────────
        // Use RAG to get the most dense and relevant chunks, but fetch a large number (e.g. k=50) 
        // to give the Cloud LLM rich context without stuffing 400k characters blindly.
        if (onSubProgress) onSubProgress(`Retrieving dense context for ${provider} (Map-Reduce)...`);
        console.log(`[Notes] Cloud mode (${provider}): using RAG dense context for ${topic.title}`);

        const sourceMaterial = await ragService.retrieveContext(topic.title, transcripts, onSubProgress, 50);

        const prompt = `Write comprehensive, detailed running notes for: "${topic.title}"${userNotesSection}

Topic Description: ${topic.description || ''}

Subtopics to cover (cover each one deeply):
${topic.subtopics.map((st: any) => `- ${st.title}${st.description ? ': ' + st.description : ''}`).join('\n')}

Primary source material (timestamped excerpts from video transcript):
"""
${sourceMaterial}
"""

Write flowing, deeply detailed notes that:
1. Open with a framing paragraph contextualising this topic
2. Cover each subtopic with multiple connected paragraphs (not just bullets)
3. Include relevant code examples with explanations
4. Add mermaid diagrams where they clarify architecture or flows
5. Weave in practical insights and common pitfalls
6. Close with a "## Key Takeaways" section
7. IMPORTANT: Include timestamp citations like [12:34] directly in your paragraphs when explaining a concept derived from the text.

Be comprehensive and thorough — aim for at least 800 words of rich, educational content.
Format as markdown.`;

        const response = await llmService.generateNotesContent(prompt, systemPrompt);
        generatedContent = response.content;

      } else {
        // ─── LOCAL PATH (Ollama / LMStudio) ──────────────────────────────────────
        // Use RAG retrieval (Ollama embeddings) to find the most relevant chunks,
        // then generate notes from them. Also runs the self-correction loop.
        if (onSubProgress) onSubProgress(`Retrieving context via RAG for ${topic.title}...`);
        console.log(`[Notes] Local mode (${provider}): using RAG for ${topic.title}`);

        const sourceMaterial = await ragService.retrieveContext(topic.title, transcripts, onSubProgress);

        const prompt = `Write comprehensive running notes for: "${topic.title}"${userNotesSection}

Topic Description: ${topic.description || ''}

Subtopics to cover:
${topic.subtopics.map((st: any) => `- ${st.title}`).join('\n')}

Primary source material (from video transcript):
"""
${sourceMaterial}
"""

Write flowing, connected notes that cover all subtopics with transitions. Start with a short framing paragraph, expand each subtopic in prose, and close with Key Takeaways bullets.
Format as markdown. Keep it rich, educational, and readable.`;

        const initialResponse = await llmService.generate(prompt, systemPrompt);

        // Self-correction pass (Ollama is fast enough locally)
        if (onSubProgress) onSubProgress(`Self-correcting draft for ${topic.title}...`);
        generatedContent = await ragService.generateGroundedNotes(
          `Verify and refine these notes about ${topic.title} based on the transcript context. Draft: ${initialResponse.content}`,
          transcripts,
          onSubProgress
        );
      }

      const sections = this.parseMarkdownToSections(generatedContent);
      const keyTakeaways = this.extractKeyTakeaways(generatedContent);

      const notes: TopicNotes = {
        topicId: topic.id,
        topicTitle: topic.title,
        summary: this.generateSummary(generatedContent),
        sections,
        keyTakeaways,
        videoSources: [], // Managed by RAG service now, could be derived from docs
        generatedAt: new Date().toISOString()
      };

      // Store the notes
      this.storeTopicNotes(notes);

      return notes;
    } catch (error) {
      console.error(`Failed to generate notes for ${topic.title}:`, error);
      throw error;
    }
  }

  /**
   * generateTopicNotesStream — streaming version of generateTopicNotes.
   * Optimized for local path (Ollama) to provide instant feedback.
   */
  async *generateTopicNotesStream(
    topic: TopicNode,
    transcripts: VideoTranscript[],
    options?: JobOptions
  ): AsyncGenerator<string> {
    const level = options?.creativityLevel ?? 2;
    const userNotesSection = options?.userNotes
      ? `\n\nUSER INSTRUCTIONS (follow these throughout):\n"""\n${options.userNotes}\n"""`
      : '';

    const creativityGuidance =
      level === 1 ? `STRICT MODE: Source-material ONLY.`
        : level === 2 ? `BALANCED MODE: Mixed source + brief clarifications.`
          : level === 3 ? `ENHANCED MODE: Enriched with diagrams/concepts.`
            : `CREATIVE MODE: Full AI knowledge + deep dives.`;

    const systemPrompt = `You are an expert technical writer. Produce high-quality, long-form study notes.
${creativityGuidance} ${userNotesSection}
Use markdown: ## headings, paragraphs, and \`\`\`mermaid or code blocks.`;

    const isCloud = llmService.isPrimaryCloudProvider();
    let prompt: string;

    if (isCloud) {
      const fullTranscriptText = transcripts
        .map(t => `### Source: ${t.videoInfo?.title || t.videoId}\n\n${t.fullText}`)
        .join('\n\n---\n\n')
        .slice(0, 300_000);

      prompt = `Write comprehensive running notes for: "${topic.title}" from this transcript:\n\n${fullTranscriptText}`;
    } else {
      const sourceMaterial = await ragService.retrieveContext(topic.title, transcripts);
      prompt = `Write comprehensive running notes for: "${topic.title}" based on this context:\n\n${sourceMaterial}`;
    }

    yield* llmService.generateNotesStream(prompt, systemPrompt);
  }

  // Generate all notes for an index
  async generateAllNotes(
    index: UnifiedIndex,
    transcripts: VideoTranscript[],
    onProgress?: (progress: { currentItem: number; totalItems: number; itemName: string; subProgress?: string }) => void,
    onDelta?: (topicId: string, textDelta: string) => void,
    options?: JobOptions
  ): Promise<TopicNotes[]> {
    const allNotes: TopicNotes[] = [];

    // We no longer clear the RAG index so we can reuse the persistent timestamped chunks
    // ragService.clearIndex();

    for (let i = 0; i < index.topics.length; i++) {
      const topic = index.topics[i];
      try {
        if (onProgress) {
          onProgress({
            currentItem: i + 1,
            totalItems: index.topics.length,
            itemName: 'Topic',
            subProgress: `Generating notes for: ${topic.title}`
          });
        }

        let fullText = '';
        const stream = this.generateTopicNotesStream(topic, transcripts, options);

        for await (const token of stream) {
          fullText += token;
          if (onDelta) onDelta(topic.id, token);
        }

        // Parse structured data from the full text
        const sections = this.parseMarkdownToSections(fullText);
        const keyTakeaways = this.extractKeyTakeaways(fullText);

        const notes: TopicNotes = {
          topicId: topic.id,
          topicTitle: topic.title,
          summary: this.generateSummary(fullText),
          sections,
          keyTakeaways,
          videoSources: [],
          generatedAt: new Date().toISOString()
        };

        allNotes.push(notes);
        this.storeTopicNotes(notes);

      } catch (error) {
        console.warn(`Skipping notes for ${topic.title}:`, error);
      }
    }
    return allNotes;
  }

  // Assemble complete notebook
  async assembleNotebook(
    title: string,
    index: UnifiedIndex,
    topicNotes: TopicNotes[],
    transcripts: VideoTranscript[]
  ): Promise<Notebook> {
    console.log('Assembling notebook...');

    // Group topics into chapters (3-5 topics per chapter)
    const chapters = await this.organizeChapters(index.topics, topicNotes);

    // Calculate metadata
    const allContent = topicNotes.map(n =>
      n.sections.map(s => s.content).join(' ')
    ).join(' ');

    const metadata: NotebookMetadata = {
      totalVideos: transcripts.length,
      totalTopics: index.topicCount,
      totalWords: countWords(allContent),
      estimatedReadTime: estimateReadingTime(allContent),
      sourceVideos: transcripts.map((t: VideoTranscript) => t.videoInfo)
    };

    const notebook: Notebook = {
      id: uuidv4(),
      title,
      description: `Comprehensive notes generated from ${transcripts.length} videos covering ${index.topicCount} topics.`,
      chapters,
      index,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store the notebook
    this.storeNotebook(notebook);

    return notebook;
  }

  // Extract relevant transcript excerpts for a topic using cleaned fullText
  private extractRelevantExcerpts(
    topic: TopicNode,
    transcripts: VideoTranscript[]
  ): Array<{ videoId: string; videoTitle: string; text: string; timestamps: number[] }> {
    const excerpts: Array<{ videoId: string; videoTitle: string; text: string; timestamps: number[] }> = [];

    // Keywords to search for relevant content
    const keywords = [
      topic.title.toLowerCase(),
      ...topic.subtopics.map(st => st.title.toLowerCase())
    ];

    for (const transcript of transcripts) {
      // Check if this video is a source for this topic
      if (!topic.videoSources.includes(transcript.videoId)) {
        continue;
      }

      // Use the clean fullText (already processed with buildCleanTranscript)
      const fullText = transcript.fullText;
      if (!fullText || fullText.length < 100) {
        continue;
      }

      const fullTextLower = fullText.toLowerCase();

      // Check if transcript contains topic keywords
      const hasKeywords = keywords.some(kw => fullTextLower.includes(kw));

      if (hasKeywords) {
        // Extract keyword-relevant sentences
        const sentences = fullText.split(/[.!?]+\s+/);
        const relevantSentences: string[] = [];

        for (const sentence of sentences) {
          if (sentence.length < 10) continue; // Skip very short fragments

          const sentenceLower = sentence.toLowerCase();
          if (keywords.some(kw => sentenceLower.includes(kw))) {
            relevantSentences.push(sentence.trim());
          }
        }

        if (relevantSentences.length > 0) {
          // Join relevant sentences and limit to 5000 chars to avoid token overflow
          const relevantText = relevantSentences.join('. ') + '.';
          excerpts.push({
            videoId: transcript.videoId,
            videoTitle: transcript.videoInfo.title,
            text: relevantText.length > 5000 ? relevantText.substring(0, 5000) + '...' : relevantText,
            timestamps: [] // fullText doesn't preserve exact timestamps
          });
        } else {
          // Fallback: use beginning of transcript
          excerpts.push({
            videoId: transcript.videoId,
            videoTitle: transcript.videoInfo.title,
            text: fullText.substring(0, 4000) + (fullText.length > 4000 ? '...' : ''),
            timestamps: []
          });
        }
      } else {
        // No keyword matches - include a representative portion
        excerpts.push({
          videoId: transcript.videoId,
          videoTitle: transcript.videoInfo.title,
          text: fullText.substring(0, 4000) + (fullText.length > 4000 ? '...' : ''),
          timestamps: []
        });
      }
    }

    return excerpts;
  }

  // Parse markdown content into structured sections
  private parseMarkdownToSections(markdown: string): NoteSection[] {
    const sections: NoteSection[] = [];
    const lines = markdown.split('\n');

    let currentSection: Partial<NoteSection> | null = null;
    let currentContent: string[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeContent: string[] = [];
    let inMermaid = false;
    let mermaidContent: string[] = [];

    const flushSection = () => {
      if (currentSection && currentContent.length > 0) {
        currentSection.content = currentContent.join('\n').trim();
        if (currentSection.content) {
          sections.push({
            id: uuidv4(),
            type: currentSection.type || 'paragraph',
            content: currentSection.content,
            ...currentSection
          } as NoteSection);
        }
      }
      currentSection = null;
      currentContent = [];
    };

    for (const line of lines) {
      // Handle code blocks
      if (line.startsWith('```mermaid')) {
        flushSection();
        inMermaid = true;
        mermaidContent = [];
        continue;
      }

      if (line.startsWith('```') && inMermaid) {
        sections.push({
          id: uuidv4(),
          type: 'mermaid',
          content: mermaidContent.join('\n'),
          diagram: {
            type: 'flowchart',
            code: mermaidContent.join('\n')
          }
        });
        inMermaid = false;
        continue;
      }

      if (inMermaid) {
        mermaidContent.push(line);
        continue;
      }

      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          flushSection();
          inCodeBlock = true;
          codeLanguage = line.slice(3).trim() || 'plaintext';
          codeContent = [];
        } else {
          sections.push({
            id: uuidv4(),
            type: 'code',
            content: codeContent.join('\n'),
            codeSnippet: {
              language: codeLanguage,
              code: codeContent.join('\n')
            }
          });
          inCodeBlock = false;
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // Handle headings
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        flushSection();
        sections.push({
          id: uuidv4(),
          type: 'heading',
          content: headingMatch[2],
          level: headingMatch[1].length
        });
        continue;
      }

      // Handle special notes (tips, warnings, etc.)
      if (line.match(/>\s*\*\*(💡|⚠️|📌|ℹ️)/)) {
        flushSection();
        const noteType = line.includes('💡') ? 'tip'
          : line.includes('⚠️') ? 'warning'
            : line.includes('📌') ? 'important'
              : 'info';
        sections.push({
          id: uuidv4(),
          type: 'special',
          content: line.replace(/>\s*\*\*[^*]+\*\*:?\s*/, ''),
          specialNote: {
            type: noteType,
            content: line.replace(/>\s*\*\*[^*]+\*\*:?\s*/, '')
          }
        });
        continue;
      }

      // Handle blockquotes
      if (line.startsWith('>')) {
        if (!currentSection || currentSection.type !== 'quote') {
          flushSection();
          currentSection = { type: 'quote' };
          currentContent = [];
        }
        currentContent.push(line.slice(1).trim());
        continue;
      }

      // Handle bullet points
      if (line.match(/^[\s]*[-*]\s/)) {
        if (!currentSection || currentSection.type !== 'bullets') {
          flushSection();
          currentSection = { type: 'bullets', items: [] };
          currentContent = [];
        }
        currentContent.push(line.replace(/^[\s]*[-*]\s/, '').trim());
        continue;
      }

      // Handle numbered lists
      if (line.match(/^[\s]*\d+\.\s/)) {
        if (!currentSection || currentSection.type !== 'numbered') {
          flushSection();
          currentSection = { type: 'numbered', items: [] };
          currentContent = [];
        }
        currentContent.push(line.replace(/^[\s]*\d+\.\s/, '').trim());
        continue;
      }

      // Regular paragraph
      if (line.trim()) {
        if (!currentSection || currentSection.type !== 'paragraph') {
          flushSection();
          currentSection = { type: 'paragraph' };
          currentContent = [];
        }
        currentContent.push(line);
      } else if (currentContent.length > 0) {
        flushSection();
      }
    }

    flushSection();

    return sections;
  }

  // Extract key takeaways from content
  private extractKeyTakeaways(content: string): string[] {
    const takeaways: string[] = [];

    // Look for sections marked as takeaways
    const takeawaySection = content.match(/key takeaways?:?([\s\S]*?)(?=\n##|\n\*\*|$)/i);

    if (takeawaySection) {
      const bullets = takeawaySection[1].match(/[-*]\s+(.+)/g);
      if (bullets) {
        takeaways.push(...bullets.map(b => b.replace(/^[-*]\s+/, '').trim()));
      }
    }

    // If no explicit takeaways, extract from important notes
    if (takeaways.length === 0) {
      const importantMatches = content.match(/>\s*\*\*(💡|📌)[^*]+\*\*:?\s*(.+)/g);
      if (importantMatches) {
        takeaways.push(...importantMatches.map(m =>
          m.replace(/>\s*\*\*[^*]+\*\*:?\s*/, '').trim()
        ).slice(0, 5));
      }
    }

    return takeaways.slice(0, 5);
  }

  // Generate summary from content
  private generateSummary(content: string): string {
    // Extract first paragraph or introduction
    const firstPara = content.split('\n\n')[0];
    const cleanPara = firstPara.replace(/^#+\s+/, '').replace(/\*\*/g, '').trim();

    if (cleanPara.length > 200) {
      return cleanPara.substring(0, 200) + '...';
    }

    return cleanPara;
  }

  // Organize topics into chapters
  private async organizeChapters(topics: TopicNode[], notes: TopicNotes[]): Promise<Chapter[]> {
    const notesMap = new Map(notes.map((n: TopicNotes) => [n.topicId, n]));
    const chapters: Chapter[] = [];

    // Group into chapters of 3-4 topics each
    const topicsPerChapter = 4;
    let chapterIndex = 0;

    for (let i = 0; i < topics.length; i += topicsPerChapter) {
      const chapterTopics = topics.slice(i, i + topicsPerChapter);
      const chapterNotes = chapterTopics
        .map((t: TopicNode) => notesMap.get(t.id))
        .filter((n: any): n is TopicNotes => n !== undefined);

      chapters.push({
        id: uuidv4(),
        title: `Chapter ${chapterIndex + 1}: ${chapterTopics[0].title}`,
        order: chapterIndex,
        topics: chapterNotes
      });

      chapterIndex++;
    }

    return chapters;
  }

  // Storage methods
  private storeTopicNotes(notes: TopicNotes): void {
    const filePath = path.join(NOTES_DIR, `${notes.topicId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(notes, null, 2));
  }

  private storeNotebook(notebook: Notebook): void {
    const filePath = path.join(NOTEBOOKS_DIR, `${notebook.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(notebook, null, 2));
    console.log(`Notebook stored: ${filePath}`);
  }

  loadNotebook(notebookId: string): Notebook | null {
    const filePath = path.join(NOTEBOOKS_DIR, `${notebookId}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return null;
  }

  // Update an existing notebook with partial data
  updateNotebook(notebookId: string, updates: Partial<Notebook>): Notebook {
    const notebook = this.loadNotebook(notebookId);
    if (!notebook) {
      throw new Error(`Notebook ${notebookId} not found`);
    }

    const updatedNotebook: Notebook = {
      ...notebook,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.storeNotebook(updatedNotebook);
    return updatedNotebook;
  }

  // Get all stored notebooks
  getAllNotebooks(): Notebook[] {
    if (!fs.existsSync(NOTEBOOKS_DIR)) return [];

    const files = fs.readdirSync(NOTEBOOKS_DIR).filter(f => f.endsWith('.json'));
    return files.map(file => {
      const data = fs.readFileSync(path.join(NOTEBOOKS_DIR, file), 'utf-8');
      return JSON.parse(data) as Notebook;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const notesService = new NotesService();
