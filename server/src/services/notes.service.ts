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
  VideoSourceReference
} from '../types';
import { llmService } from './llm.service';
import { countWords, estimateReadingTime } from '../utils/youtube';
import * as fs from 'fs';
import * as path from 'path';

const NOTES_DIR = path.join(__dirname, '../../storage/notes');
const NOTEBOOKS_DIR = path.join(__dirname, '../../storage/notebooks');

// Ensure storage directories exist
[NOTES_DIR, NOTEBOOKS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export class NotesService {

  // Generate notes for a single topic
  async generateTopicNotes(
    topic: TopicNode, 
    transcripts: VideoTranscript[]
  ): Promise<TopicNotes> {
    console.log(`Generating notes for topic: ${topic.title}`);

    // Get relevant transcript excerpts for this topic
    const relevantExcerpts = this.extractRelevantExcerpts(topic, transcripts);
    
    const systemPrompt = `You are a technical writer creating comprehensive study notes. Your notes should be:

1. **Detailed and Educational**: Explain concepts thoroughly, including fundamentals and advanced aspects
2. **Well-Structured**: Use clear headings, paragraphs, bullet points, and numbered lists
3. **Practical**: Include code examples, architecture diagrams (as mermaid), and real-world applications
4. **Rich in Content**: Use special callout boxes for tips, warnings, and important notes

Output Format Requirements:
- Use markdown formatting
- Include code blocks with language specification
- Add mermaid diagrams for architecture/flow explanations
- Use blockquotes for important quotes or definitions
- Include bullet points for lists of features/steps
- Add special notes using: > **💡 Tip:** or > **⚠️ Warning:** or > **📌 Important:**`;

    const prompt = `Create comprehensive study notes for the topic: "${topic.title}"

Topic Description: ${topic.description || 'No description provided'}

Subtopics to cover:
${topic.subtopics.map(st => `- ${st.title}`).join('\n')}

Source Material:
"""
${relevantExcerpts.map(e => `[From: ${e.videoTitle}]\n${e.text}`).join('\n\n---\n\n')}
"""

Create detailed notes that:
1. Start with an overview/introduction
2. Cover each subtopic in depth
3. Include code examples where relevant (use proper code blocks)
4. Add mermaid diagrams for architectures or processes
5. Include practical tips and common pitfalls
6. End with key takeaways

Format the response as markdown with rich formatting.`;

    try {
      const response = await llmService.generate(prompt, systemPrompt);
      const sections = this.parseMarkdownToSections(response.content);
      const keyTakeaways = this.extractKeyTakeaways(response.content);

      const notes: TopicNotes = {
        topicId: topic.id,
        topicTitle: topic.title,
        summary: this.generateSummary(response.content),
        sections,
        keyTakeaways,
        videoSources: relevantExcerpts.map(e => ({
          videoId: e.videoId,
          videoTitle: e.videoTitle,
          timestamps: e.timestamps
        })),
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

  // Generate all notes for an index
  async generateAllNotes(
    index: UnifiedIndex, 
    transcripts: VideoTranscript[]
  ): Promise<TopicNotes[]> {
    const allNotes: TopicNotes[] = [];

    for (const topic of index.topics) {
      try {
        const notes = await this.generateTopicNotes(topic, transcripts);
        allNotes.push(notes);
        
        // Small delay between topics
        await this.delay(1000);
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
      sourceVideos: transcripts.map(t => t.videoInfo)
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
    const notesMap = new Map(notes.map(n => [n.topicId, n]));
    const chapters: Chapter[] = [];
    
    // Group into chapters of 3-4 topics each
    const topicsPerChapter = 4;
    let chapterIndex = 0;
    
    for (let i = 0; i < topics.length; i += topicsPerChapter) {
      const chapterTopics = topics.slice(i, i + topicsPerChapter);
      const chapterNotes = chapterTopics
        .map(t => notesMap.get(t.id))
        .filter((n): n is TopicNotes => n !== undefined);
      
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const notesService = new NotesService();
