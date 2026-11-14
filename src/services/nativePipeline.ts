import { tauriApi, ExtractedTranscript, PlaylistMetadata } from './tauri';
import {
  UnifiedIndex,
  Notebook,
  TopicNotes,
  ProcessingStatus,
  ProcessingStep,
  VideoInfo,
} from '@/types';
import { AppSettings } from '@/types/settings';
import { sanitizeMarkdownMermaidBlocks } from './mermaid';

const MERMAID_PROMPT = `
MERMAID DIAGRAM RELIABILITY RULES:
When generating a Mermaid diagram (\`\`\`mermaid ... \`\`\`), adhere to these strict syntax safeguards:
1. Header: Use 'flowchart TD', 'flowchart LR', 'sequenceDiagram', 'classDiagram', or 'erDiagram'.
2. Node IDs: Simple alphanumeric/snake_case ONLY (e.g., client_app, api_gw, db_primary). NEVER use spaces, hyphens, colons, or parentheses in IDs.
3. Shape Labels: ALWAYS wrap the label text in double quotes inside brackets:
   - Correct: id["Client Application (React)"]
   - WRONG: id[Client Application (React)]
   - Database: db[("Primary Database (PostgreSQL)")]
   - Decision: check{"Validation Check?"}
4. Edges: Connect using standard arrows with piped labels:
   - Correct: nodeA -->|"HTTP Request"| nodeB
   - WRONG: nodeA -- "HTTP Request" --> nodeB
5. Subgraphs: Always close every subgraph with 'end'.
6. Keep diagrams focused, legible, and directly aligned with the topic concepts.
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

export const PIPELINE_STEPS: ProcessingStep[] = [
  { id: 'extract', label: 'Transcript Ingestion', description: 'Fetching timestamped subtitles and video chapters', status: 'pending' },
  { id: 'index', label: 'Topic Discovery & Indexing', description: 'Analyzing semantic concepts and generating study outline', status: 'pending' },
  { id: 'notes', label: 'Comprehensive Notes & Diagrams', description: 'Synthesizing in-depth study notes with code and Mermaid diagrams', status: 'pending' },
  { id: 'assemble', label: 'Study Assets & Vault Archival', description: 'Generating flashcards, mind maps, quizzes, and saving to SQLite vault', status: 'pending' },
];

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
        let model = (task === 'indexing' && providerConfig.indexingModel)
          ? providerConfig.indexingModel
          : (providerConfig.model || 'gemini-flash-lite-latest');

        // Migrate away from models experiencing high-demand outages or deprecations
        if (model === 'gemini-flash-latest' || model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash') {
          model = 'gemini-flash-lite-latest';
        }

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
    model: 'gemini-flash-lite-latest',
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

export interface PipelineLogItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'ai';
  timestamp: string;
}

// In-memory active session map to allow approval resumption and real-time subscription
export interface ActivePipelineSession {
  jobId: string;
  url: string;
  title: string;
  status: ProcessingStatus;
  currentStep: number;
  steps: ProcessingStep[];
  logs: PipelineLogItem[];
  transcripts: ExtractedTranscript[];
  videoSources: VideoInfo[];
  options: {
    userNotes?: string;
    creativityLevel?: number;
    generationMode?: 'topical' | 'chronological';
  };
  index?: UnifiedIndex;
  notebook?: Notebook;
  error?: string;
}

const activeSessions = new Map<string, ActivePipelineSession>();
const listeners = new Map<string, Set<PipelineCallbacks>>();

function notifyStatusChange(session: ActivePipelineSession, status: ProcessingStatus) {
  session.status = status;
  const set = listeners.get(session.jobId);
  if (set) {
    for (const cb of set) {
      cb.onStatusChange?.(status);
    }
  }
}

function notifyStepChange(session: ActivePipelineSession, stepIndex: number, status: 'pending' | 'active' | 'complete' | 'error', details?: string) {
  session.currentStep = stepIndex;
  session.steps = session.steps.map((s, idx) => {
    if (idx === stepIndex) {
      return { ...s, status, details: details !== undefined ? details : s.details };
    }
    // Safety guard: when advancing to an active step, mark all prior steps complete
    if (status === 'active' && idx < stepIndex && s.status !== 'complete') {
      return { ...s, status: 'complete' };
    }
    return s;
  });
  const set = listeners.get(session.jobId);
  if (set) {
    for (const cb of set) {
      cb.onStepChange?.(stepIndex, status, details);
    }
  }
}

function notifyLog(session: ActivePipelineSession, message: string, type: 'info' | 'success' | 'error' | 'ai' = 'info') {
  const item: PipelineLogItem = {
    id: Math.random().toString(36).substring(7),
    message,
    type,
    timestamp: new Date().toLocaleTimeString(),
  };
  session.logs.unshift(item);
  if (session.logs.length > 50) session.logs.pop();

  const set = listeners.get(session.jobId);
  if (set) {
    for (const cb of set) {
      cb.onLog?.(message, type);
    }
  }
}

function notifyAwaitingApproval(session: ActivePipelineSession, index: UnifiedIndex) {
  session.index = index;
  session.status = 'awaiting-approval';
  const set = listeners.get(session.jobId);
  if (set) {
    for (const cb of set) {
      cb.onAwaitingApproval?.(index);
    }
  }
}

function notifyNoteDelta(session: ActivePipelineSession, topicId: string, delta: string) {
  const set = listeners.get(session.jobId);
  if (set) {
    for (const cb of set) {
      cb.onNoteDelta?.(topicId, delta);
    }
  }
}

function notifyComplete(session: ActivePipelineSession, notebook: Notebook) {
  session.notebook = notebook;
  session.status = 'complete';
  const set = listeners.get(session.jobId);
  if (set) {
    for (const cb of set) {
      cb.onComplete?.(notebook);
    }
  }
}

function notifyError(session: ActivePipelineSession, err: string) {
  session.error = err;
  session.status = 'error';
  const set = listeners.get(session.jobId);
  if (set) {
    for (const cb of set) {
      cb.onError?.(err);
    }
  }
}

export const nativePipeline = {
  getSession(jobId: string): ActivePipelineSession | undefined {
    return activeSessions.get(jobId);
  },

  isJobActive(jobId: string): boolean {
    return activeSessions.has(jobId);
  },

  getActiveJobIds(): string[] {
    return Array.from(activeSessions.keys());
  },

  subscribe(jobId: string, callbacks: PipelineCallbacks): () => void {
    if (!listeners.has(jobId)) {
      listeners.set(jobId, new Set());
    }
    listeners.get(jobId)!.add(callbacks);

    return () => {
      listeners.get(jobId)?.delete(callbacks);
    };
  },

  async start(
    jobId: string,
    url: string,
    userNotes?: string,
    creativityLevel: number = 2,
    generationMode: 'topical' | 'chronological' = 'topical',
    callbacks: PipelineCallbacks = {}
  ): Promise<void> {
    // 1. Initialize session in memory immediately
    const session: ActivePipelineSession = {
      jobId,
      url,
      title: 'Validating Video URL...',
      status: 'extracting',
      currentStep: 0,
      steps: PIPELINE_STEPS.map((s, idx) => ({
        ...s,
        status: idx === 0 ? 'active' : 'pending',
      })),
      logs: [],
      transcripts: [],
      videoSources: [],
      options: { userNotes, creativityLevel, generationMode },
    };
    activeSessions.set(jobId, session);

    // Register caller callbacks
    if (!listeners.has(jobId)) {
      listeners.set(jobId, new Set());
    }
    listeners.get(jobId)!.add(callbacks);

    // Persist initial job record to SQLite immediately so any route can find it
    await tauriApi.saveJob({
      id: jobId,
      url,
      status: 'extracting',
      current_step: 0,
      options_json: JSON.stringify({ videoSources: [] }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).catch(console.warn);

    try {
      notifyLog(session, `Initiating native pipeline for job ${jobId.slice(0, 8)}...`, 'info');
      notifyStatusChange(session, 'extracting');
      notifyStepChange(session, 0, 'active', 'Validating URL & extracting captions...');

      const validation = await tauriApi.validateUrl(url);
      if (!validation.valid) {
        throw new Error('Invalid YouTube URL or unsupported format');
      }

      let transcripts: ExtractedTranscript[] = [];
      let videoSources: VideoInfo[] = [];
      let overallTitle = 'Study Notebook';

      // ── Step 1: Caption Extraction ──────────────────────────────────────────
      if (validation.playlist_id) {
        notifyLog(session, `Extracting playlist metadata (ID: ${validation.playlist_id})...`, 'info');
        const playlist = await tauriApi.fetchPlaylist(validation.playlist_id);
        overallTitle = playlist.title;
        videoSources = playlist.videos.map(v => ({
          id: v.id,
          title: v.title,
          thumbnail: v.thumbnail,
        }));

        notifyLog(session, `Found ${playlist.videos.length} videos in playlist. Extracting captions...`, 'info');
        let count = 0;
        for (const v of playlist.videos) {
          try {
            count++;
            notifyStepChange(session, 0, 'active', `Extracting captions ${count}/${playlist.videos.length}: ${v.title.slice(0, 30)}...`);
            const t = await tauriApi.fetchTranscript(v.id);
            transcripts.push(t);
            const chapters = t.chapters || t.video_info.chapters || [];
            if (chapters.length > 0) {
              notifyLog(session, `Discovered ${chapters.length} creator chapters for "${t.video_info.title}"`, 'info');
            }
            notifyLog(session, `Extracted captions for "${t.video_info.title}"`, 'success');
          } catch (e) {
            notifyLog(session, `Skipped captions for ${v.id}: ${e}`, 'error');
          }
        }
      } else if (validation.video_id) {
        notifyStepChange(session, 0, 'active', `Fetching captions for video ${validation.video_id}...`);
        const t = await tauriApi.fetchTranscript(validation.video_id);
        transcripts.push(t);
        overallTitle = t.video_info.title;
        const chapters = t.chapters || t.video_info.chapters || [];
        videoSources.push({
          id: t.video_info.id,
          title: t.video_info.title,
          thumbnail: t.video_info.thumbnail,
          chapters,
        });
        if (chapters.length > 0) {
          notifyLog(session, `Discovered ${chapters.length} YouTube creator timeline chapters`, 'success');
        }
        notifyLog(session, `Extracted ${t.segments.length} timestamped caption segments`, 'success');
      }

      session.title = overallTitle;
      session.transcripts = transcripts;
      session.videoSources = videoSources;

      if (transcripts.length === 0 || transcripts.every(t => !t.full_text)) {
        throw new Error('No closed captions or transcripts could be retrieved for this YouTube video.');
      }

      const totalSegments = transcripts.reduce((acc, t) => acc + t.segments.length, 0);
      notifyStepChange(
        session,
        0,
        'complete',
        totalSegments > 0
          ? `Extracted ${totalSegments.toLocaleString()} caption segments`
          : `Extracted ${transcripts.length} transcript(s)`
      );

      // ── Step 1: Topic Discovery & Indexing ──────────────────────────
      notifyStatusChange(session, 'indexing');
      notifyStepChange(session, 1, 'active', 'Analyzing video structure and generating curriculum outline...');
      notifyLog(session, 'Analyzing video structure with AI...', 'ai');

      const aiConfig = getAIConfigForTask('indexing');
      notifyLog(session, `Connecting to ${aiConfig.provider} (${aiConfig.model})...`, 'info');
      const combinedText = transcripts.map(t => `Video: ${t.video_info.title}\n${t.full_text}`).join('\n\n---\n\n');
      const textSample = combinedText.slice(0, 16000); // 16k chars sample for indexing

      const allDiscoveredChapters = transcripts.flatMap(t => t.chapters || t.video_info.chapters || []);

      const chaptersContext = allDiscoveredChapters.length > 0
        ? `\nYouTube Creator Timeline Chapters (${allDiscoveredChapters.length} markers found on video timeline):\n` +
          allDiscoveredChapters.map(c => `- [${c.time_display}] ${c.title}`).join('\n') +
          `\n\nCRITICAL INSTRUCTION: The video creator marked these exact chapters on the YouTube timeline. You MUST base your curriculum outline directly on these timeline markers! Keep each topic faithful to the creator's timeline label, provide a clear 1-2 sentence description, 2-4 subtopics, and include "startTime" (${allDiscoveredChapters[0].start_seconds}) and "timeDisplay" ("${allDiscoveredChapters[0].time_display}").`
        : '';

      const indexPrompt = `Analyze this video transcript and generate a structured topic outline for study notes.
Title: "${overallTitle}"
${chaptersContext}

Source Transcript:
"""
${textSample}
"""

Instructions:
1. ${allDiscoveredChapters.length > 0 ? `Create a topic for each creator timeline chapter (or group tightly-spaced ones if >16 chapters).` : `Extract 4 to 8 clear, progressive study topics.`}
2. For each topic, supply a title, short description, 2-4 subtopics, and matching "startTime" and "timeDisplay".
3. Return ONLY a valid JSON array of topics matching this schema:
[
  {
    "title": "Topic Name",
    "description": "Short overview of what is taught",
    "subtopics": ["Subtopic 1", "Subtopic 2"],
    "startTime": 0,
    "timeDisplay": "0:00"
  }
]`;

      const systemPrompt = "You are an expert curriculum designer. Output ONLY valid JSON array with no conversational filler or markdown fences.";

      let streamedChars = 0;
      const rawIndexResponse = await tauriApi.streamLLM(
        indexPrompt,
        systemPrompt,
        aiConfig.provider,
        aiConfig.model,
        aiConfig.baseUrl,
        (token) => {
          streamedChars += token.length;
          notifyStepChange(
            session,
            1,
            'active',
            `Streaming curriculum outline (${Math.round(streamedChars / 4)} tokens)...`
          );
        },
        aiConfig.apiKey
      );

      // Clean JSON
      let cleanedJson = rawIndexResponse.trim();
      if (cleanedJson.startsWith('```json')) cleanedJson = cleanedJson.slice(7);
      if (cleanedJson.startsWith('```')) cleanedJson = cleanedJson.slice(3);
      if (cleanedJson.endsWith('```')) cleanedJson = cleanedJson.slice(0, -3);
      cleanedJson = cleanedJson.trim();

      let parsedTopics: Array<{
        title: string;
        description: string;
        subtopics: string[];
        startTime?: number;
        endTime?: number;
        timeDisplay?: string;
      }> = [];

      try {
        parsedTopics = JSON.parse(cleanedJson);
      } catch {
        notifyLog(session, 'Using robust outline fallback structure', 'info');
        if (allDiscoveredChapters.length > 0) {
          parsedTopics = allDiscoveredChapters.map(c => ({
            title: c.title,
            description: `Core analysis and takeaways for ${c.title} [${c.time_display}]`,
            subtopics: ['Key Concepts', 'Detailed Breakdown', 'Practical Implications'],
            startTime: c.start_seconds,
            endTime: c.end_seconds,
            timeDisplay: c.time_display,
          }));
        } else {
          parsedTopics = [
            { title: 'Core Concepts & Fundamentals', description: 'Overview and fundamental concepts', subtopics: ['Architecture', 'Setup'] },
            { title: 'In-Depth Walkthrough', description: 'Detailed implementation steps', subtopics: ['Execution', 'Configuration'] },
            { title: 'Summary & Key Takeaways', description: 'Conclusion and practical guidelines', subtopics: ['Best Practices', 'Next Steps'] }
          ];
        }
      }

      const generatedIndex: UnifiedIndex = {
        id: `idx-${Date.now()}`,
        title: overallTitle,
        topics: parsedTopics.map((t, idx) => {
          const matched = allDiscoveredChapters.find(c =>
            c.title.toLowerCase().includes(t.title.toLowerCase()) ||
            t.title.toLowerCase().includes(c.title.toLowerCase())
          ) || allDiscoveredChapters[idx];

          const startTime = t.startTime ?? matched?.start_seconds;
          const endTime = t.endTime ?? matched?.end_seconds;
          const timeDisplay = t.timeDisplay ?? matched?.time_display;

          return {
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
            startTime,
            endTime,
            timeDisplay,
          };
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        videoCount: videoSources.length,
        topicCount: parsedTopics.length,
      };

      notifyStepChange(session, 1, 'complete', `Generated curriculum outline with ${generatedIndex.topicCount} topics`);
      notifyLog(session, `Generated topic index with ${generatedIndex.topicCount} chapters`, 'success');

      // ── Step 1 Complete: Pause for User Review / Approval ───────────
      notifyStatusChange(session, 'awaiting-approval');
      notifyLog(session, 'Index ready for review. Click "Approve & Generate" to produce notes.', 'info');

      // Update SQLite state
      await tauriApi.saveJob({
        id: jobId,
        url,
        status: 'awaiting-approval',
        current_step: 1,
        options_json: JSON.stringify({ index: generatedIndex, videoSources }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).catch(console.warn);

      notifyAwaitingApproval(session, generatedIndex);
    } catch (err: any) {
      console.error('Native pipeline error:', err);
      const errMsg = err?.message || 'Pipeline execution failed';
      const failedStep = session.currentStep ?? 1;
      notifyStepChange(session, failedStep, 'error', errMsg);
      notifyStatusChange(session, 'error');
      notifyLog(session, `Pipeline halted: ${errMsg}`, 'error');
      notifyError(session, errMsg);

      await tauriApi.saveJob({
        id: jobId,
        url,
        status: 'error',
        current_step: failedStep,
        options_json: JSON.stringify({ error: errMsg }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).catch(console.warn);
    }
  },

  async approveAndContinue(jobId: string, approvedIndex: UnifiedIndex): Promise<Notebook> {
    const session = activeSessions.get(jobId);
    if (!session) {
      throw new Error(`No active session found for job ${jobId}`);
    }

    const { transcripts, videoSources, title, options } = session;

    try {
      session.index = approvedIndex;
      notifyStatusChange(session, 'generating');
      notifyStepChange(session, 2, 'active', `Writing detailed study notes (1/${approvedIndex.topics.length})...`);
      notifyLog(session, `Beginning deep notes synthesis for ${approvedIndex.topics.length} topics...`, 'ai');

      const aiConfig = getAIConfigForTask('notes');
      const allTopicNotes: TopicNotes[] = [];

      let topicIndex = 0;
      for (const topic of approvedIndex.topics) {
        topicIndex++;
        notifyStepChange(session, 2, 'active', `Writing topic ${topicIndex}/${approvedIndex.topics.length}: ${topic.title}...`);
        notifyLog(session, `Generating study notes for: "${topic.title}"`, 'ai');

        const creativity = options.creativityLevel || 2;
        const creativityMode =
          creativity === 1 ? 'Strict transcript adherence' :
          creativity === 2 ? 'Balanced with clear explanations' :
          creativity === 3 ? 'Enhanced with diagrams and deep context' :
          'Creative, comprehensive publication-grade mastery notes';

        const transcriptExcerpt = transcripts
          .map(t => {
            let segs = t.segments;
            if (topic.startTime !== undefined) {
              const start = topic.startTime;
              const end = topic.endTime ?? (start + 600);
              const filtered = segs.filter(s => s.start >= Math.max(0, start - 15) && s.start <= end + 15);
              if (filtered.length >= 5) {
                segs = filtered;
              }
            }
            if (segs === t.segments && approvedIndex.topics.length > 1) {
              const segsPerTopic = Math.max(30, Math.floor(t.segments.length / approvedIndex.topics.length));
              const startIdx = Math.min((topicIndex - 1) * segsPerTopic, Math.max(0, t.segments.length - segsPerTopic));
              segs = t.segments.slice(startIdx, startIdx + segsPerTopic * 2);
            }
            return segs
              .slice(0, 200)
              .map(s => {
                const h = Math.floor(s.start / 3600);
                const m = Math.floor((s.start % 3600) / 60);
                const sec = Math.floor(s.start % 60);
                const ts = h > 0
                  ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
                  : `${m}:${sec.toString().padStart(2, '0')}`;
                return `[${ts}] ${s.text}`;
              })
              .join(' ');
          })
          .join('\n\n')
          .slice(0, 14000);

        const prompt = `Write comprehensive, book-quality study notes for the following topic.
Topic: "${topic.title}"${topic.timeDisplay ? ` [Timeline Chapter: ${topic.timeDisplay}]` : ''}
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
            notifyNoteDelta(session, topic.id, delta);
          },
          aiConfig.apiKey
        );

        // Sanitize and validate any Mermaid blocks generated by the LLM
        const validatedContent = await sanitizeMarkdownMermaidBlocks(topicContent, {
          topicTitle: topic.title,
          useAiRepair: false,
        });

        allTopicNotes.push({
          topicId: topic.id,
          topicTitle: topic.title,
          summary: topic.description || topic.title,
          sections: [],
          keyTakeaways: [],
          videoSources: [{
            videoId: videoSources[0]?.id || '',
            videoTitle: videoSources[0]?.title || '',
            timestamps: topic.startTime !== undefined ? [topic.startTime] : undefined,
          }],
          generatedAt: new Date().toISOString(),
          content: validatedContent,
          title: topic.title,
          startTime: topic.startTime,
          endTime: topic.endTime,
          timeDisplay: topic.timeDisplay,
        });

        notifyLog(session, `Completed notes for "${topic.title}"`, 'success');
      }

      notifyStepChange(session, 2, 'complete', `Synthesized detailed notes for ${allTopicNotes.length} topics`);

      // ── Step 3: Assembling Notebook & Saving to SQLite Vault ──────────────
      notifyStatusChange(session, 'assembling');
      notifyStepChange(session, 3, 'active', 'Compiling study guide and archiving to SQLite vault...');
      notifyLog(session, 'Archiving notebook in SQLite database...', 'info');

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
        current_step: 3,
        options_json: JSON.stringify({ notebookId, notebook: finalNotebook }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      notifyStepChange(session, 3, 'complete', 'Notebook archived to local SQLite vault');
      notifyStatusChange(session, 'complete');
      notifyLog(session, 'Notebook generated successfully and stored in SQLite!', 'success');

      notifyComplete(session, finalNotebook);
      activeSessions.delete(jobId);

      return finalNotebook;
    } catch (err: any) {
      console.error('Error during notes generation:', err);
      const errMsg = err?.message || 'Notes generation failed';
      notifyStepChange(session, session.currentStep, 'error', errMsg);
      notifyStatusChange(session, 'error');
      notifyLog(session, errMsg, 'error');
      notifyError(session, errMsg);
      throw err;
    }
  },
};
