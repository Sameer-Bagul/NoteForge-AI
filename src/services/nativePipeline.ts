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
- Use blockquotes (> **Tip:** ... or > **Warning:** ... or > **Note:** ...) for critical callouts.
- Include tables for comparisons and syntax-highlighted code blocks where applicable.
- Where beneficial for understanding architecture or data flow, include an interactive Mermaid diagram.
- STRICT NO EMOJIS: Do NOT use emojis anywhere in your output (no emojis in headings, callouts, lists, code comments, or diagram labels). Maintain a clean, academic textbook tone.
- STRICT CLEAN MARKDOWN: NEVER output raw HTML tags (e.g. <span>, <font>, <div>).
- STRICT TIMESTAMP SYNTAX: Never wrap timestamps in extra brackets or spaces. Always write exactly [mm:ss] (e.g. [01:23]), NEVER [[01:23]], NEVER [ 01:23 ], and NEVER [ [01:23] ].
- STRICT CODE FENCE FORMATTING: Always place code fences (\`\`\`) on their own separate line. Never prefix or suffix text or timestamps on the same line as a code fence.
`;

export const PIPELINE_STEPS: ProcessingStep[] = [
  { id: 'extract', label: 'Transcript Ingestion', description: 'Fetching timestamped subtitles and video chapters', status: 'pending' },
  { id: 'index', label: 'Topic Discovery & Indexing', description: 'Analyzing semantic concepts and generating study outline', status: 'pending' },
  { id: 'notes', label: 'Comprehensive Notes & Diagrams', description: 'Synthesizing in-depth study notes with code and Mermaid diagrams', status: 'pending' },
  { id: 'assemble', label: 'Study Assets & Vault Archival', description: 'Generating flashcards, mind maps, quizzes, and saving to SQLite vault', status: 'pending' },
];

export function formatTimeDisplay(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getTranscriptDuration(t: ExtractedTranscript): number {
  if (t.segments && t.segments.length > 0) {
    const last = t.segments[t.segments.length - 1];
    return Math.round(last.start + (last.duration || 0));
  }
  return 0;
}

export interface VideoAnalysis {
  transcript: ExtractedTranscript;
  durationSeconds: number;
  chapters: Array<{
    title: string;
    start_seconds: number;
    end_seconds?: number;
    time_display: string;
  }>;
  isLongOrCompound: boolean;
}

export function analyzeVideoSyllabus(transcripts: ExtractedTranscript[]): VideoAnalysis[] {
  return transcripts.map(t => {
    const duration = getTranscriptDuration(t);
    const rawChapters = (t.chapters || t.video_info.chapters || []).map(c => ({
      title: c.title,
      start_seconds: c.start_seconds,
      end_seconds: c.end_seconds,
      time_display: c.time_display,
    }));

    // A video is ONLY considered a "Big Video" to be decomposed into sub-notes (e.g. 10.1, 10.2)
    // if its duration is genuinely long (> 40 minutes / 2400s).
    // Normal 5-35 minute lectures ALWAYS stay as 1 single cohesive lecture note.
    const isLongOrCompound = duration > 2400;

    let resolvedChapters = rawChapters;
    // If long video (> 40 mins) without creator chapters, synthesize 15-minute logical windows
    if (isLongOrCompound && resolvedChapters.length < 2 && duration > 0) {
      const windowSize = 900; // 15 mins (900 seconds)
      const windowCount = Math.max(2, Math.ceil(duration / windowSize));
      resolvedChapters = [];
      for (let i = 0; i < windowCount; i++) {
        const start = i * windowSize;
        const end = Math.min(duration, (i + 1) * windowSize);
        resolvedChapters.push({
          title: `${t.video_info.title} (Part ${i + 1})`,
          start_seconds: start,
          end_seconds: end,
          time_display: formatTimeDisplay(start),
        });
      }
    }

    return {
      transcript: t,
      durationSeconds: duration,
      chapters: resolvedChapters,
      isLongOrCompound,
    };
  });
}

export function buildLectureWiseOutline(videoAnalyses: VideoAnalysis[]): Array<{
  videoId: string;
  title: string;
  description: string;
  subtopics: string[];
  startTime: number;
  endTime?: number;
  timeDisplay: string;
}> {
  const topics: Array<{
    videoId: string;
    title: string;
    description: string;
    subtopics: string[];
    startTime: number;
    endTime?: number;
    timeDisplay: string;
  }> = [];

  const isMultiVideo = videoAnalyses.length > 1;

  videoAnalyses.forEach((va, vIdx) => {
    const lectureNum = vIdx + 1;
    const baseTitle = va.transcript.video_info.title.trim();
    // Clean redundant episode/lecture markers from the title to prevent "Lecture 1: Ep 1 ..."
    const cleanTitle = baseTitle
      .replace(/^(?:episode|ep\.?|lecture|lesson|session|#)\s*\d+[\s:\-–—|]*/i, '')
      .replace(/^\[(?:ep\.?|episode|lecture|lesson)\s*\d+\][\s:\-–—|]*/i, '')
      .trim() || baseTitle;

    if (!va.isLongOrCompound || va.chapters.length === 0) {
      // Standard lecture: 1 video = 1 chapter
      const subtopics = va.chapters.length > 0
        ? va.chapters.slice(0, 8).map(c => c.title)
        : ['Core Principles', 'Detailed Breakdown', 'Code & Practical Examples', 'Key Takeaways'];

      topics.push({
        videoId: va.transcript.video_info.id,
        title: isMultiVideo ? `Lecture ${lectureNum}: ${cleanTitle}` : cleanTitle,
        description: `Comprehensive study notes for ${cleanTitle}`,
        subtopics,
        startTime: 0,
        endTime: va.durationSeconds > 0 ? va.durationSeconds : undefined,
        timeDisplay: '0:00',
      });
    } else {
      // Long/compound lecture: ALWAYS maintains exactly 1 chapter per lecture.
      // Sub-chapters are nested as subtopics under this chapter.
      const subtopics = va.chapters.map((ch, chIdx) => {
        const chCleanTitle = ch.title
          .replace(/^(?:part|ch|chapter|section|#)\s*\d+[\s:\-–—|]*/i, '')
          .trim() || ch.title;
        return `${lectureNum}.${chIdx + 1}: ${chCleanTitle} [${ch.time_display}]`;
      });

      topics.push({
        videoId: va.transcript.video_info.id,
        title: isMultiVideo ? `Lecture ${lectureNum}: ${cleanTitle}` : cleanTitle,
        description: `In-depth masterclass comprising ${va.chapters.length} topics across ${formatTimeDisplay(va.durationSeconds)}`,
        subtopics,
        startTime: 0,
        endTime: va.durationSeconds > 0 ? va.durationSeconds : undefined,
        timeDisplay: '0:00',
      });
    }
  });

  return topics;
}

export interface ResolvedAIConfig {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export function isRateLimitOrQuotaError(err: any): boolean {
  const msg = (typeof err === 'string' ? err : err?.message || JSON.stringify(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('ratelimit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('tokens per minute') ||
    msg.includes('requests per minute') ||
    msg.includes('capacity') ||
    msg.includes('overloaded') ||
    msg.includes('too many requests') ||
    msg.includes('exceeded your current quota') ||
    msg.includes('credit limit')
  );
}

export function getAIConfigFallbackChain(task: 'notes' | 'indexing' | 'features'): ResolvedAIConfig[] {
  try {
    const raw = localStorage.getItem('noteforge_ai_settings');
    if (raw) {
      const parsed = JSON.parse(raw) as AppSettings;
      const assigned = parsed.taskMapping?.[task];
      const usableProviders: ResolvedAIConfig[] = [];
      const enabledList = (parsed.providers || []).filter(p => p.enabled);

      const toResolved = (p: ProviderConfig): ResolvedAIConfig => {
        let model = (task === 'indexing' && p.indexingModel)
          ? p.indexingModel
          : (p.model || (p.provider === 'ollama' ? 'llama3.2:1b' : 'gemini-flash-lite-latest'));
        if (model === 'gemini-flash-latest' || model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash') {
          model = 'gemini-flash-lite-latest';
        }
        return {
          provider: p.provider,
          model,
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
        };
      };

      const validProviders = enabledList.filter(p => {
        if (p.provider === 'ollama' || p.provider === 'lmstudio') return true;
        return Boolean(p.apiKey && p.apiKey.trim().length > 0);
      });

      if (assigned && assigned !== 'auto') {
        const assignedMatch = validProviders.find(p => p.provider === assigned);
        if (assignedMatch) {
          usableProviders.push(toResolved(assignedMatch));
        }
      }

      const remaining = validProviders
        .filter(p => !usableProviders.some(u => u.provider === p.provider))
        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

      remaining.forEach(p => usableProviders.push(toResolved(p)));

      if (usableProviders.length > 0) {
        return usableProviders;
      }
    }
  } catch (err) {
    console.warn('Error constructing fallback AI chain:', err);
  }

  return [
    { provider: 'ollama', model: 'llama3.2:1b', baseUrl: 'http://localhost:11434' },
    { provider: 'gemini', model: 'gemini-flash-lite-latest' },
  ];
}

export function getAIConfigForTask(task: 'notes' | 'indexing' | 'features'): ResolvedAIConfig {
  const chain = getAIConfigFallbackChain(task);
  return chain[0];
}

export interface PipelineCallbacks {
  onStepChange?: (stepIndex: number, status: 'pending' | 'active' | 'complete' | 'error', details?: string) => void;
  onStatusChange?: (status: ProcessingStatus) => void;
  onLog?: (message: string, type: 'info' | 'success' | 'error' | 'ai') => void;
  onAwaitingApproval?: (index: UnifiedIndex) => void;
  onNoteDelta?: (topicId: string, delta: string, topicTitle?: string) => void;
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
  checkpointedTopics?: TopicNotes[];
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

function notifyNoteDelta(session: ActivePipelineSession, topicId: string, delta: string, topicTitle?: string) {
  const set = listeners.get(session.jobId);
  if (set) {
    for (const cb of set) {
      cb.onNoteDelta?.(topicId, delta, topicTitle);
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

      const transcripts: ExtractedTranscript[] = [];
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
            const vsMatch = videoSources.find(vs => vs.id === v.id);
            if (vsMatch) {
              vsMatch.chapters = chapters;
            }
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
      const isPlaylist = transcripts.length > 1;
      const isLectureMode = isPlaylist || generationMode === 'chronological';
      const videoAnalyses = analyzeVideoSyllabus(transcripts);
      const combinedText = transcripts.map(t => t.full_text).join('\n\n');

      let parsedTopics: Array<{
        videoId?: string;
        title: string;
        description: string;
        subtopics: string[];
        startTime?: number;
        endTime?: number;
        timeDisplay?: string;
      }> = [];

      if (isLectureMode) {
        // Lecture-wise Mode: Deterministic 1:1 mapping for small videos (Lecture 1, Lecture 2...)
        // and granular chapter decomposition for big videos (Lecture 10.1, Lecture 10.2...)
        notifyStepChange(session, 1, 'active', `Assembling lecture outline for ${transcripts.length} lessons...`);
        notifyLog(session, `Building lecture-wise outline (${transcripts.length} lessons, decomposing multi-hour lectures)...`, 'ai');
        parsedTopics = buildLectureWiseOutline(videoAnalyses);
        notifyLog(session, `Generated ${parsedTopics.length} lecture topics across ${transcripts.length} video lessons`, 'success');
      } else {
        // Synthesis Mode: AI groups concepts thematically for a single lecture
        notifyLog(session, `Connecting to ${aiConfig.provider} (${aiConfig.model})...`, 'info');
        const firstVideoId = videoAnalyses[0]?.transcript.video_info.id || 'video_id';
        const maxSample = aiConfig.provider === 'ollama' ? 5000 : 16000;
        const textSample = combinedText.slice(0, maxSample);

        const indexPrompt = `Analyze this video transcript and generate a structured topic outline for study notes.
Title: "${overallTitle}"

Source Content:
"""
${textSample}
"""

Instructions:
1. Extract 4 to 8 clear, progressive study topics with "videoId": "${firstVideoId}", "startTime", and "timeDisplay".
2. Return ONLY a valid JSON array of topics matching this schema:
[
  {
    "videoId": "${firstVideoId}",
    "title": "Topic Name",
    "description": "Short overview of what is taught",
    "subtopics": ["Subtopic 1", "Subtopic 2"],
    "startTime": 0,
    "endTime": 600,
    "timeDisplay": "0:00"
  }
]`;

        const systemPrompt = "You are an expert curriculum designer. Output ONLY valid JSON array with no conversational filler or markdown fences. Do NOT use emojis anywhere in titles or descriptions.";

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

        let cleanedJson = rawIndexResponse.trim();
        if (cleanedJson.startsWith('```json')) cleanedJson = cleanedJson.slice(7);
        if (cleanedJson.startsWith('```')) cleanedJson = cleanedJson.slice(3);
        if (cleanedJson.endsWith('```')) cleanedJson = cleanedJson.slice(0, -3);
        cleanedJson = cleanedJson.trim();

        try {
          parsedTopics = JSON.parse(cleanedJson);
        } catch {
          notifyLog(session, 'Using robust outline fallback structure', 'info');
          parsedTopics = buildLectureWiseOutline(videoAnalyses);
        }
      }

      const allChapters = videoAnalyses.flatMap(va => 
        va.chapters.map(c => ({ ...c, videoId: va.transcript.video_info.id }))
      );

      const generatedIndex: UnifiedIndex = {
        id: `idx-${Date.now()}`,
        title: overallTitle,
        topics: parsedTopics.map((t, idx) => {
          // Resolve videoId
          let matchedVideoId = t.videoId;
          if (!matchedVideoId || !transcripts.some(tr => tr.video_info.id === matchedVideoId)) {
            const foundByTitle = videoAnalyses.find(va => 
              va.transcript.video_info.title.toLowerCase().includes(t.title.toLowerCase()) ||
              va.chapters.some(c => c.title.toLowerCase().includes(t.title.toLowerCase()))
            );
            matchedVideoId = foundByTitle?.transcript.video_info.id || videoSources[Math.min(idx, videoSources.length - 1)]?.id || videoSources[0]?.id || '';
          }

          const matchedChapter = allChapters.find(c =>
            c.videoId === matchedVideoId && (
              c.title.toLowerCase().includes(t.title.toLowerCase()) ||
              t.title.toLowerCase().includes(c.title.toLowerCase())
            )
          );

          const startTime = t.startTime ?? matchedChapter?.start_seconds ?? 0;
          const endTime = t.endTime ?? matchedChapter?.end_seconds;
          const timeDisplay = t.timeDisplay ?? matchedChapter?.time_display ?? formatTimeDisplay(startTime);

          return {
            id: `topic-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
            title: t.title,
            description: t.description,
            subtopics: (t.subtopics || []).map((st, sidx) => ({
              id: `sub-${idx}-${sidx}`,
              title: st,
              videoSources: [matchedVideoId],
            })),
            videoSources: [matchedVideoId],
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
      const errMsg = (typeof err === 'string' ? err : err?.message) || 'Pipeline execution failed';
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

    try {
      session.index = approvedIndex;
      notifyStatusChange(session, 'generating');
      notifyStepChange(session, 2, 'active', `Writing detailed study notes (1/${approvedIndex.topics.length})...`);
      notifyLog(session, `Beginning deep notes synthesis for ${approvedIndex.topics.length} topics...`, 'ai');

      return await executeGenerationLoop(session, approvedIndex, [], undefined);
    } catch (err: any) {
      if (err?.isQuotaExhausted || err?.message?.includes('QUOTA_EXHAUSTED')) {
        throw err;
      }
      console.error('Error during notes generation:', err);
      const errMsg = (typeof err === 'string' ? err : err?.message) || 'Notes generation failed';
      notifyStepChange(session, session.currentStep, 'error', errMsg);
      notifyStatusChange(session, 'error');
      notifyLog(session, errMsg, 'error');
      notifyError(session, errMsg);
      throw err;
    }
  },

  async resumeGeneration(jobId: string, overrideConfig?: ResolvedAIConfig): Promise<Notebook> {
    let session = activeSessions.get(jobId);
    if (!session) {
      const jobRecord = await tauriApi.getJob(jobId);
      if (!jobRecord || !jobRecord.options_json) {
        throw new Error(`Session ${jobId} not found in SQLite`);
      }
      const data = JSON.parse(jobRecord.options_json);
      session = {
        jobId,
        url: jobRecord.url,
        title: data.title || 'Study Notebook',
        status: 'generating',
        currentStep: 2,
        steps: PIPELINE_STEPS.map((s, idx) => idx < 2 ? { ...s, status: 'complete' } : (idx === 2 ? { ...s, status: 'active' } : s)),
        logs: [],
        transcripts: data.transcripts || [],
        videoSources: data.videoSources || [],
        options: data.options || {},
        index: data.approvedIndex,
        checkpointedTopics: data.completedTopics || [],
      };
      activeSessions.set(jobId, session);
    }

    try {
      notifyStatusChange(session, 'generating');
      const completed = session.checkpointedTopics || [];
      notifyLog(session, `Resuming generation from checkpoint (${completed.length} topics already completed)...`, 'info');
      notifyStepChange(session, 2, 'active', `Resuming topic generation (${completed.length + 1}/${session.index?.topics.length || 0})...`);

      return await executeGenerationLoop(session, session.index!, completed, overrideConfig);
    } catch (err: any) {
      if (err?.isQuotaExhausted || err?.message?.includes('QUOTA_EXHAUSTED')) {
        throw err;
      }
      console.error('Error resuming notes generation:', err);
      const errMsg = (typeof err === 'string' ? err : err?.message) || 'Resume generation failed';
      notifyStepChange(session, session.currentStep, 'error', errMsg);
      notifyStatusChange(session, 'error');
      notifyLog(session, errMsg, 'error');
      notifyError(session, errMsg);
      throw err;
    }
  },
};

async function executeGenerationLoop(
  session: ActivePipelineSession,
  approvedIndex: UnifiedIndex,
  existingCompletedNotes: TopicNotes[] = [],
  overrideConfig?: ResolvedAIConfig
): Promise<Notebook> {
  const { transcripts, videoSources, title, options, jobId } = session;

  const fallbackChain = overrideConfig
    ? [overrideConfig, ...getAIConfigFallbackChain('notes').filter(c => c.provider !== overrideConfig.provider)]
    : getAIConfigFallbackChain('notes');

  let currentProviderIndex = 0;
  const allTopicNotes: TopicNotes[] = [...existingCompletedNotes];
  const startIndex = existingCompletedNotes.length;

  for (let idx = startIndex; idx < approvedIndex.topics.length; idx++) {
    const topic = approvedIndex.topics[idx];
    const topicDisplayNum = idx + 1;
    notifyStepChange(session, 2, 'active', `Writing topic ${topicDisplayNum}/${approvedIndex.topics.length}: ${topic.title}...`);
    notifyLog(session, `Generating study notes for: "${topic.title}"`, 'ai');

    const creativity = options.creativityLevel || 2;
    const creativityMode =
      creativity === 1 ? 'Strict transcript adherence' :
      creativity === 2 ? 'Balanced with clear explanations' :
      creativity === 3 ? 'Enhanced with diagrams and deep context' :
      'Creative, comprehensive publication-grade mastery notes';

    const targetTranscript = (topic.videoSources && topic.videoSources.length > 0)
      ? transcripts.find(t => topic.videoSources.includes(t.video_info.id))
      : transcripts.find(t => t.video_info.title.toLowerCase() === topic.title.toLowerCase())
        || transcripts[Math.min(idx, transcripts.length - 1)];

    const activeTranscript = targetTranscript || transcripts[0];

    let segs = activeTranscript.segments;
    if (topic.startTime !== undefined && (topic.endTime !== undefined || activeTranscript.segments.length > 80)) {
      const start = topic.startTime;
      const end = topic.endTime ?? (start + 900);
      const filtered = segs.filter(s => s.start >= Math.max(0, start - 15) && s.start <= end + 15);
      if (filtered.length >= 5) {
        segs = filtered;
      }
    }

    const activeProvider = fallbackChain[currentProviderIndex] || fallbackChain[0];
    const maxExcerpt = activeProvider.provider === 'ollama' ? 7000 : 14000;
    const transcriptExcerpt = segs
      .slice(0, 250)
      .map(s => {
        const h = Math.floor(s.start / 3600);
        const m = Math.floor((s.start % 3600) / 60);
        const sec = Math.floor(s.start % 60);
        const ts = h > 0
          ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
          : `${m}:${sec.toString().padStart(2, '0')}`;
        return `[${ts}] ${s.text}`;
      })
      .join(' ')
      .slice(0, maxExcerpt);

    const prompt = `Write comprehensive, book-quality study notes for the following topic.
Topic: "${topic.title}"${topic.timeDisplay ? ` [Timeline Chapter: ${topic.timeDisplay}]` : ''}
Video Source: "${activeTranscript.video_info.title}"
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

    const systemPrompt = "You are an expert academic tutor and technical note author. Write thoroughly, formatting with rich markdown, clickable timestamps [mm:ss], and valid Mermaid diagrams where useful. Strictly avoid emojis and do NOT output raw HTML tags.";

    let topicSuccess = false;
    let topicContent = '';
    let lastError: any = null;

    while (!topicSuccess && currentProviderIndex < fallbackChain.length) {
      const curConfig = fallbackChain[currentProviderIndex];
      topicContent = '';
      try {
        await tauriApi.streamLLM(
          prompt,
          systemPrompt,
          curConfig.provider,
          curConfig.model,
          curConfig.baseUrl,
          (delta) => {
            topicContent += delta;
            notifyNoteDelta(session, topic.id, delta, topic.title);
          },
          curConfig.apiKey
        );
        topicSuccess = true;
      } catch (err: any) {
        lastError = err;
        console.warn(`Provider ${curConfig.provider} (${curConfig.model}) failed for topic "${topic.title}":`, err);

        if (currentProviderIndex + 1 < fallbackChain.length) {
          const nextConfig = fallbackChain[currentProviderIndex + 1];
          currentProviderIndex++;
          notifyLog(session, `Provider ${curConfig.provider} unavailable or quota reached. Failing over to ${nextConfig.provider} (${nextConfig.model})...`, 'info');
        } else {
          break; // Exhausted all providers in the fallback chain!
        }
      }
    }

    if (!topicSuccess) {
      const errStr = (typeof lastError === 'string' ? lastError : lastError?.message) || 'AI providers quota exhausted or unreachable';
      session.checkpointedTopics = allTopicNotes;
      session.error = errStr;

      // Checkpoint immediately to SQLite
      await tauriApi.saveJob({
        id: jobId,
        url: session.url,
        status: 'paused-rate-limit',
        current_step: 2,
        options_json: JSON.stringify({
          completedTopics: allTopicNotes,
          failedTopicIndex: idx,
          approvedIndex,
          videoSources,
          title,
          transcripts,
          options,
          error: errStr,
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).catch(console.warn);

      notifyStepChange(session, 2, 'active', `Paused: Quota exhausted at topic ${topicDisplayNum}/${approvedIndex.topics.length}. ${allTopicNotes.length} topics saved.`);
      notifyStatusChange(session, 'paused-rate-limit');
      notifyLog(session, `Quota exhausted on all providers. Generation paused at topic ${topicDisplayNum}. Completed topics (${allTopicNotes.length}) safely stored in SQLite.`, 'error');

      const haltErr = new Error(`QUOTA_EXHAUSTED: ${errStr}`);
      (haltErr as any).isQuotaExhausted = true;
      throw haltErr;
    }

    // Sanitize and validate Mermaid blocks
    const validatedContent = await sanitizeMarkdownMermaidBlocks(topicContent, {
      topicTitle: topic.title,
      useAiRepair: false,
    });

    const newTopicNote: TopicNotes = {
      topicId: topic.id,
      topicTitle: topic.title,
      summary: topic.description || topic.title,
      sections: [],
      keyTakeaways: [],
      videoSources: [{
        videoId: activeTranscript.video_info.id,
        videoTitle: activeTranscript.video_info.title,
        timestamps: topic.startTime !== undefined ? [topic.startTime] : undefined,
      }],
      generatedAt: new Date().toISOString(),
      content: validatedContent,
      title: topic.title,
      startTime: topic.startTime,
      endTime: topic.endTime,
      timeDisplay: topic.timeDisplay,
    };

    allTopicNotes.push(newTopicNote);
    session.checkpointedTopics = allTopicNotes;

    // Incremental checkpoint to SQLite after each successful topic
    await tauriApi.saveJob({
      id: jobId,
      url: session.url,
      status: 'generating',
      current_step: 2,
      options_json: JSON.stringify({
        completedTopics: allTopicNotes,
        currentTopicIndex: topicDisplayNum,
        approvedIndex,
        videoSources,
        title,
        transcripts,
        options,
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).catch(console.warn);

    notifyLog(session, `Completed notes for "${topic.title}" (${topicDisplayNum}/${approvedIndex.topics.length})`, 'success');
  }

  notifyStepChange(session, 2, 'complete', `Synthesized detailed notes for ${allTopicNotes.length} topics`);

  // ── Step 3: Assembling Notebook & Archiving to SQLite Vault ────────
  notifyStatusChange(session, 'assembling');
  notifyStepChange(session, 3, 'active', 'Synthesizing quizzes, concept diagrams & archiving to SQLite...');
  notifyLog(session, 'Generating self-check quiz and concept flow diagrams...', 'info');

  const notebookId = `nb-${Date.now()}`;
  const fullMarkdown = allTopicNotes
    .map(n => `## ${n.topicTitle}\n\n${n.content}`)
    .join('\n\n---\n\n');

  const wordCount = fullMarkdown.split(/\s+/).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  // Quiz generation
  let generatedQuiz: any[] = [];
  try {
    const topicNames = approvedIndex.topics.map(t => t.title);
    const quizRes = await api.generateQuiz(topicNames, fullMarkdown.slice(0, 4000));
    if (Array.isArray(quizRes) && quizRes.length > 0) {
      generatedQuiz = quizRes;
      notifyLog(session, `Synthesized ${quizRes.length} interactive self-check questions`, 'success');
    }
  } catch (qErr) {
    console.warn('Pipeline automatic quiz generation skipped:', qErr);
  }

  // Mind map generation
  const generatedMindMaps: Record<string, any> = {};
  try {
    const primaryTopic = approvedIndex.topics[0];
    if (primaryTopic) {
      const subtopicTitles = primaryTopic.subtopics.map(s => typeof s === 'string' ? s : s.title);
      const mapRes = await api.generateMindMap(
        primaryTopic.title,
        subtopicTitles,
        allTopicNotes[0]?.content?.slice(0, 3000) || fullMarkdown.slice(0, 3000)
      );
      if (mapRes && Array.isArray(mapRes.nodes) && mapRes.nodes.length > 0) {
        generatedMindMaps[primaryTopic.id] = {
          topicId: primaryTopic.id,
          nodes: mapRes.nodes,
          edges: mapRes.edges || [],
        };
        notifyLog(session, `Constructed visual concept flow diagram for "${primaryTopic.title}"`, 'success');
      }
    }
  } catch (mmErr) {
    console.warn('Pipeline automatic mind map generation skipped:', mmErr);
  }

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
    quiz: generatedQuiz.length > 0 ? generatedQuiz : undefined,
    mindMaps: Object.keys(generatedMindMaps).length > 0 ? generatedMindMaps : undefined,
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
}
