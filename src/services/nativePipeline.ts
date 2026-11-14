import { tauriApi, ExtractedTranscript, PlaylistMetadata } from './tauri';
import {
  UnifiedIndex,
  TopicNode,
  Notebook,
  Chapter,
  TopicNotes,
  ProcessingStatus,
  VideoInfo,
} from '@/types';
import { AppSettings, DEFAULT_SETTINGS } from '@/types/settings';

const MERMAID_PROMPT = `
MERMAID DIAGRAM GUIDELINES:
When including Mermaid diagrams (\`\`\`mermaid ... \`\`\`), follow these strict rules:
1. Chart types: 'flowchart TD' or 'flowchart LR', 'sequenceDiagram', 'classDiagram', 'erDiagram'.
2. Node IDs: Simple alphanumeric identifiers (e.g. client_app, api_gw, db_primary).
3. Quotes: ALWAYS wrap node label text in double quotes if it contains spaces or symbols: nodeA["Client App (React)"] --> nodeB["API Gateway"].
4. Standard arrow: --> or -->|"Label"|.
5. Keep diagrams concise, readable, and visually clean.
`;

const RUNNING_NOTES_RULES = `
FORMATTING RULES:
- Write in rich, educational Markdown.
- Use headings (##, ###) for major sections.
- When key concepts are explained, insert clickable timestamp badges in format [mm:ss] or [hh:mm:ss] based on the video context.
- Use blockquotes (> **💡 Tip:** ... or > **⚠️ Warning:** ...) for critical callouts.
- Include tables for comparisons and syntax-highlighted code blocks where applicable.
- Where beneficial for understanding architecture or data flow, include an interactive Mermaid diagram.
`;

export function getAIConfigForTask(task: 'notes' | 'indexing' | 'features'): { provider: string; model: string; baseUrl?: string; apiKey?: string } {
  try {
    const raw = localStorage.getItem('noteforge_ai_settings');
    if (raw) {
      const parsed = JSON.parse(raw) as AppSettings;
      const assigned = parsed.taskMapping?.[task];
      let providerConfig = (assigned && assigned !== 'auto')
        ? parsed.providers.find(p => p.provider === assigned && p.enabled)
        : null;

      if (!providerConfig) {
        providerConfig = parsed.providers.find(p => p.enabled) || parsed.providers[0];
      }

      if (providerConfig) {
        const model = (task === 'indexing' && providerConfig.indexingModel)
          ? providerConfig.indexingModel
          : (providerConfig.model || 'gemini-flash-latest');

        return {
          provider: providerConfig.provider,
          model,
          baseUrl: providerConfig.baseUrl,
          apiKey: providerConfig.apiKey,
        };
      }
    }
  } catch {}

  return {
    provider: 'gemini',
    model: 'gemini-flash-latest',
  };
}

export interface PipelineCallbacks {
  onStepChange?: (stepIndex: number, status: 'pending' | 'active' | 'complete' | 'error', details?: string) => void;
  onStatusChange?: (status: ProcessingStatus) => void;
  onLog?: (message: string, type: 'info' | 'success' | 'error' | 'ai') => void;
  onAwaitingApproval?: (index: UnifiedIndex) => void;
  onNoteDelta?: (topicId: string, delta: string) => void;
  onComplete?: (notebook: Notebook) => void;
  onError?: (err: string) => void;
}

// In-memory active session map to allow approval resumption
interface ActivePipelineSession {
  jobId: string;
  url: string;
  title: string;
  transcripts: ExtractedTranscript[];
  videoSources: VideoInfo[];
  options: {
    userNotes?: string;
    creativityLevel?: number;
    generationMode?: 'topical' | 'chronological';
  };
  callbacks: PipelineCallbacks;
  index?: UnifiedIndex;
}

const activeSessions = new Map<string, ActivePipelineSession>();

export const nativePipeline = {
  async start(
    jobId: string,
    url: string,
    userNotes?: string,
    creativityLevel: number = 2,
    generationMode: 'topical' | 'chronological' = 'topical',
    callbacks: PipelineCallbacks = {}
  ): Promise<void> {
    const { onStepChange, onStatusChange, onLog, onAwaitingApproval, onError } = callbacks;

    try {
      onLog?.(`Initiating native pipeline for job ${jobId.slice(0, 8)}...`, 'info');
      onStatusChange?.('extracting');
      onStepChange?.(0, 'active', 'Validating URL & extracting captions...');

      const validation = await tauriApi.validateUrl(url);
      if (!validation.valid) {
        throw new Error('Invalid YouTube URL or unsupported format');
      }

      let transcripts: ExtractedTranscript[] = [];
      let videoSources: VideoInfo[] = [];
      let overallTitle = 'Study Notebook';

      // ── Step 1: Caption Extraction ──────────────────────────────────────────
      if (validation.playlist_id) {
        onLog?.(`Extracting playlist metadata (ID: ${validation.playlist_id})...`, 'info');
        const playlist = await tauriApi.fetchPlaylist(validation.playlist_id);
        overallTitle = playlist.title;
        videoSources = playlist.videos.map(v => ({
          id: v.id,
          title: v.title,
          thumbnail: v.thumbnail,
        }));

        onLog?.(`Found ${playlist.videos.length} videos in playlist. Extracting captions...`, 'info');
        let count = 0;
        for (const v of playlist.videos) {
          try {
            count++;
            onStepChange?.(0, 'active', `Extracting captions ${count}/${playlist.videos.length}: ${v.title.slice(0, 30)}...`);
            const t = await tauriApi.fetchTranscript(v.id);
            transcripts.push(t);
            onLog?.(`Extracted captions for "${t.video_info.title}"`, 'success');
          } catch (e) {
            onLog?.(`Skipped captions for ${v.id}: ${e}`, 'error');
          }
        }
      } else if (validation.video_id) {
        onStepChange?.(0, 'active', `Fetching captions for video ${validation.video_id}...`);
        const t = await tauriApi.fetchTranscript(validation.video_id);
        transcripts.push(t);
        overallTitle = t.video_info.title;
        videoSources.push({
          id: t.video_info.id,
          title: t.video_info.title,
          thumbnail: t.video_info.thumbnail,
        });
        onLog?.(`Extracted ${t.segments.length} timestamped caption segments`, 'success');
      }

      if (transcripts.length === 0 || transcripts.every(t => !t.full_text)) {
        throw new Error('No transcripts or closed captions could be retrieved for this video.');
      }

      onStepChange?.(0, 'complete', `Extracted ${transcripts.length} transcript(s)`);

      // ── Step 2: Content Analysis & Topic Indexing ──────────────────────────
      onStatusChange?.('indexing');
      onStepChange?.(1, 'active', 'Analyzing concepts and semantic structure...');
      onLog?.('Analyzing video structure with AI...', 'ai');

      const aiConfig = getAIConfigForTask('indexing');
      const combinedText = transcripts.map(t => `Video: ${t.video_info.title}\n${t.full_text}`).join('\n\n---\n\n');
      const textSample = combinedText.slice(0, 16000); // 16k chars sample for indexing

      const indexPrompt = `Analyze this video transcript and generate a structured topic outline for study notes.
Title: "${overallTitle}"

Source Transcript:
"""
${textSample}
"""

Instructions:
1. Extract 4 to 8 clear, progressive study topics.
2. For each topic, supply a title, short description, and 2-4 subtopics.
3. Return ONLY a valid JSON array of topics matching this schema:
[
  {
    "title": "Topic Name",
    "description": "Short overview of what is taught",
    "subtopics": ["Subtopic 1", "Subtopic 2"]
  }
]`;

      const systemPrompt = "You are an expert curriculum designer. Output ONLY valid JSON array with no conversational filler or markdown fences.";

      onStepChange?.(2, 'active', 'Generating unified topic index...');
      const rawIndexResponse = await tauriApi.streamLLM(
        indexPrompt,
        systemPrompt,
        aiConfig.provider,
        aiConfig.model,
        aiConfig.baseUrl,
        () => {},
        aiConfig.apiKey
      );

      // Clean JSON
      let cleanedJson = rawIndexResponse.trim();
      if (cleanedJson.startsWith('```json')) cleanedJson = cleanedJson.slice(7);
      if (cleanedJson.startsWith('```')) cleanedJson = cleanedJson.slice(3);
      if (cleanedJson.endsWith('```')) cleanedJson = cleanedJson.slice(0, -3);
      cleanedJson = cleanedJson.trim();

      let parsedTopics: Array<{ title: string; description: string; subtopics: string[] }> = [];
      try {
        parsedTopics = JSON.parse(cleanedJson);
      } catch (err) {
        onLog?.('Fallback parsing for topic index', 'info');
        parsedTopics = [
          { title: 'Core Concepts & Fundamentals', description: 'Overview and fundamental concepts', subtopics: ['Architecture', 'Setup'] },
          { title: 'In-Depth Walkthrough', description: 'Detailed implementation steps', subtopics: ['Execution', 'Configuration'] },
          { title: 'Summary & Key Takeaways', description: 'Conclusion and practical guidelines', subtopics: ['Best Practices', 'Next Steps'] }
        ];
      }

      const generatedIndex: UnifiedIndex = {
        id: `idx-${Date.now()}`,
        title: overallTitle,
        topics: parsedTopics.map((t, idx) => ({
          id: `topic-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
          title: t.title,
          description: t.description,
          subtopics: (t.subtopics || []).map((st, sidx) => ({
            id: `sub-${idx}-${sidx}`,
            title: st,
            videoSources: [videoSources[0]?.id || ''],
          })),
          videoSources: [videoSources[0]?.id || ''],
          order: idx + 1,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        videoCount: videoSources.length,
        topicCount: parsedTopics.length,
      };

      onStepChange?.(1, 'complete', 'Content analysis complete');
      onStepChange?.(2, 'complete', `Generated index with ${generatedIndex.topicCount} topics`);
      onLog?.(`Generated topic index with ${generatedIndex.topicCount} chapters`, 'success');

      // ── Step 3: Pause for User Review / Approval ───────────────────────────
      onStatusChange?.('awaiting-approval');
      onLog?.('Index ready for review. Click "Approve & Generate" to produce notes.', 'info');

      // Save session in memory and save initial job in SQLite
      const session: ActivePipelineSession = {
        jobId,
        url,
        title: overallTitle,
        transcripts,
        videoSources,
        options: { userNotes, creativityLevel, generationMode },
        callbacks,
        index: generatedIndex,
      };
      activeSessions.set(jobId, session);

      await tauriApi.saveJob({
        id: jobId,
        url,
        status: 'awaiting-approval',
        current_step: 3,
        options_json: JSON.stringify({ index: generatedIndex, videoSources }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).catch(console.warn);

      onAwaitingApproval?.(generatedIndex);
    } catch (err: any) {
      console.error('Native pipeline error:', err);
      onStepChange?.(0, 'error', err?.message || 'Pipeline failed');
      onStatusChange?.('error');
      onLog?.(err?.message || 'Pipeline execution failed', 'error');
      onError?.(err?.message || 'Pipeline execution failed');
    }
  },

  async approveAndContinue(jobId: string, approvedIndex: UnifiedIndex): Promise<Notebook> {
    const session = activeSessions.get(jobId);
    if (!session) {
      throw new Error(`No active session found for job ${jobId}`);
    }

    const { callbacks, transcripts, videoSources, title, options } = session;
    const { onStepChange, onStatusChange, onLog, onNoteDelta, onComplete, onError } = callbacks;

    try {
      session.index = approvedIndex;
      onStatusChange?.('generating');
      onStepChange?.(3, 'active', `Generating notes for ${approvedIndex.topics.length} topics...`);
      onLog?.(`Beginning deep notes synthesis for ${approvedIndex.topics.length} topics...`, 'ai');

      const aiConfig = getAIConfigForTask('indexing');
      const allTopicNotes: TopicNotes[] = [];

      let topicIndex = 0;
      for (const topic of approvedIndex.topics) {
        topicIndex++;
        onStepChange?.(3, 'active', `Writing topic ${topicIndex}/${approvedIndex.topics.length}: ${topic.title}...`);
        onLog?.(`Generating study notes for: "${topic.title}"`, 'ai');

        const creativity = options.creativityLevel || 2;
        const creativityMode =
          creativity === 1 ? 'Strict transcript adherence' :
          creativity === 2 ? 'Balanced with clear explanations' :
          creativity === 3 ? 'Enhanced with diagrams and deep context' :
          'Creative, comprehensive publication-grade mastery notes';

        const transcriptExcerpt = transcripts
          .map(t => t.segments.slice(0, 150).map(s => `[${Math.floor(s.start / 60)}:${Math.floor(s.start % 60).toString().padStart(2, '0')}] ${s.text}`).join(' '))
          .join('\n\n')
          .slice(0, 12000);

        const prompt = `Write comprehensive, book-quality study notes for the following topic.
Topic: "${topic.title}"
Description: ${topic.description || ''}
Subtopics to cover:
${topic.subtopics.map(s => `- ${s.title}`).join('\n')}

Creativity Mode: ${creativityMode}
${options.userNotes ? `User Special Instructions:\n"""\n${options.userNotes}\n"""` : ''}

Source Video Transcripts with Timestamps:
"""
${transcriptExcerpt}
"""

${RUNNING_NOTES_RULES}
${MERMAID_PROMPT}

Begin directly with the topic notes in structured Markdown.`;

        const systemPrompt = "You are an expert academic tutor and technical note author. Write thoroughly, formatting with rich markdown, clickable timestamps [mm:ss], and valid Mermaid diagrams where useful.";

        let topicContent = '';
        await tauriApi.streamLLM(
          prompt,
          systemPrompt,
          aiConfig.provider,
          aiConfig.model,
          aiConfig.baseUrl,
          (delta) => {
            topicContent += delta;
            onNoteDelta?.(topic.id, delta);
          },
          aiConfig.apiKey
        );

        allTopicNotes.push({
          topicId: topic.id,
          topicTitle: topic.title,
          summary: topic.description || topic.title,
          sections: [],
          keyTakeaways: [],
          videoSources: [{
            videoId: videoSources[0]?.id || '',
            videoTitle: videoSources[0]?.title || '',
          }],
          generatedAt: new Date().toISOString(),
          content: topicContent,
          title: topic.title,
        });

        onLog?.(`Completed notes for "${topic.title}"`, 'success');
      }

      onStepChange?.(3, 'complete', `Generated notes for ${allTopicNotes.length} topics`);

      // ── Step 5: Assembling Notebook & Saving to SQLite ────────────────────
      onStatusChange?.('assembling');
      onStepChange?.(4, 'active', 'Compiling chapters and saving to SQLite...');
      onLog?.('Assembling notebook in SQLite database...', 'info');

      const notebookId = `nb-${Date.now()}`;
      const fullMarkdown = allTopicNotes
        .map(n => `## ${n.topicTitle}\n\n${n.content}`)
        .join('\n\n---\n\n');

      const wordCount = fullMarkdown.split(/\s+/).length;
      const readTime = Math.max(1, Math.round(wordCount / 200));

      const finalNotebook: Notebook = {
        id: notebookId,
        title: title || 'Study Notebook',
        description: `Comprehensive synthesis from YouTube with ${approvedIndex.topics.length} chapters.`,
        chapters: [
          {
            id: 'chap-1',
            title: title || 'Main Study Guide',
            order: 1,
            topics: allTopicNotes,
          },
        ],
        index: approvedIndex,
        metadata: {
          totalVideos: videoSources.length,
          totalTopics: approvedIndex.topics.length,
          totalWords: wordCount,
          estimatedReadTime: readTime,
          sourceVideos: videoSources,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Persist to native SQLite
      await tauriApi.saveNotebook({
        id: notebookId,
        job_id: jobId,
        title: finalNotebook.title,
        content_json: JSON.stringify(finalNotebook),
        created_at: finalNotebook.createdAt,
      });

      await tauriApi.saveJob({
        id: jobId,
        url: session.url,
        status: 'complete',
        current_step: 5,
        options_json: JSON.stringify({ notebookId, notebook: finalNotebook }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      onStepChange?.(4, 'complete', 'Notebook assembled and stored');
      onStatusChange?.('complete');
      onLog?.('Notebook generated successfully and stored in SQLite!', 'success');

      activeSessions.delete(jobId);
      onComplete?.(finalNotebook);

      return finalNotebook;
    } catch (err: any) {
      console.error('Error during notes generation:', err);
      onStepChange?.(3, 'error', err?.message || 'Notes generation failed');
      onStatusChange?.('error');
      onLog?.(err?.message || 'Notes generation failed', 'error');
      onError?.(err?.message || 'Notes generation failed');
      throw err;
    }
  },
};

