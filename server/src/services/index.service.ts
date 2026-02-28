import { v4 as uuidv4 } from 'uuid';
import { VideoTranscript, UnifiedIndex, TopicNode, SubTopic, JobOptions, CreativityLevel } from '../types';
import { multiLlmService as llmService } from './multi-llm.service';
import { chunkText } from '../utils/youtube';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = path.join(__dirname, '../../storage/indexes');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

interface RawTopic {
  title: string;
  description: string;
  subtopics: string[];
}

interface VideoTopics {
  videoId: string;
  topics: RawTopic[];
}

export class IndexService {

  // Generate unified index from multiple video transcripts
  async generateUnifiedIndex(transcripts: VideoTranscript[], title: string, options?: JobOptions): Promise<UnifiedIndex> {
    console.log(`Generating unified index for ${transcripts.length} videos...`);
    if (options?.userNotes) console.log(`  User notes: ${options.userNotes.slice(0, 80)}`);
    if (options?.creativityLevel) console.log(`  Creativity level: ${options.creativityLevel}`);

    // Step 1: Extract topics from each video
    const videoTopicsList: VideoTopics[] = [];

    for (const transcript of transcripts) {
      console.log(`Analyzing topics in: ${transcript.videoInfo.title}`);
      const topics = await this.extractVideoTopics(transcript, options);
      videoTopicsList.push({
        videoId: transcript.videoId,
        topics
      });
    }

    // Step 2: Merge and deduplicate topics across videos
    console.log('Merging topics across all videos...');
    const unifiedTopics = await this.mergeTopics(videoTopicsList, transcripts);

    // Step 3: Order topics from basic to advanced
    console.log('Ordering topics...');
    const orderedTopics = await this.orderTopics(unifiedTopics);

    const index: UnifiedIndex = {
      id: uuidv4(),
      title,
      topics: orderedTopics,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      videoCount: transcripts.length,
      topicCount: orderedTopics.length
    };

    // Store the index
    this.storeIndex(index);

    return index;
  }

  // Extract topics from a single video transcript
  private async extractVideoTopics(transcript: VideoTranscript, options?: JobOptions): Promise<RawTopic[]> {
    const level = options?.creativityLevel ?? 2;

    const creativityInstruction =
      level === 1 ? 'STRICT MODE: Only extract topics that are EXPLICITLY stated in the transcript. Do NOT infer or add topics not clearly mentioned.'
        : level === 2 ? 'BALANCED MODE: Extract topics clearly discussed. You may group closely related ideas together.'
          : level === 3 ? 'ENHANCED MODE: Extract topics discussed, and also identify related sub-topics that would logically follow from the content.'
            : 'CREATIVE MODE: Extract all topics and freely identify implicit themes and related areas even if only briefly mentioned.';

    const userNotesSection = options?.userNotes
      ? `\n\nUSER INSTRUCTIONS (apply these when selecting topics):\n"""\n${options.userNotes}\n"""`
      : '';

    const systemPrompt = `You are a technical content analyzer. Your job is to identify the main topics and subtopics discussed in video transcripts.

${creativityInstruction}

Extract topics that represent distinct concepts, techniques, or ideas. Each topic should be substantial enough to have its own section in a technical book.

Focus on:
- Core concepts and fundamentals
- Technical implementations
- Architectures and patterns
- Best practices and common mistakes
- Tools and technologies discussed`;

    // Chunk transcript if too long (use smaller chunks for better LLM processing)
    const chunks = chunkText(transcript.fullText, 4000);
    const allTopics: RawTopic[] = [];

    console.log(`  📄 Processing ${chunks.length} chunk(s) from transcript`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prompt = `Analyze this video transcript excerpt and extract the main topics discussed.${userNotesSection}

Transcript:
"""
${chunk}
"""

Return a JSON array of topics. EXAMPLE FORMAT:
[
  {
    "title": "JavaScript Execution Context",
    "description": "How JavaScript code is executed in the browser",
    "subtopics": ["Memory Allocation", "Code Execution Phase"]
  }
]

IMPORTANT:
- Only include topics that are substantively discussed, not just mentioned
- Return an empty array [] if no clear topics are found
- Ensure all strings are properly quoted
- Do not add comments in the JSON`;

      try {
        console.log(`    Chunk ${i + 1}/${chunks.length}...`);
        const rawTopics = await llmService.generateJSONLocal<RawTopic[]>(prompt, systemPrompt);

        // Normalize topics to handle malformed data
        const normalizedTopics = this.normalizeRawTopics(rawTopics);
        allTopics.push(...normalizedTopics);
        console.log(`    ✓ Found ${normalizedTopics.length} topic(s) in chunk ${i + 1}`);
      } catch (error) {
        console.warn(`    ⚠️ Failed to extract topics from chunk ${i + 1}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Deduplicate topics within this video
    return this.deduplicateRawTopics(allTopics);
  }

  // Merge topics from multiple videos into a unified structure
  private async mergeTopics(videoTopicsList: VideoTopics[], transcripts: VideoTranscript[]): Promise<TopicNode[]> {
    // Collect all topics with their sources
    const topicMap = new Map<string, {
      title: string;
      description: string;
      subtopics: Set<string>;
      videoSources: Set<string>;
    }>();

    for (const vt of videoTopicsList) {
      for (const topic of vt.topics) {
        const key = this.normalizeTopicTitle(topic.title);

        if (topicMap.has(key)) {
          const existing = topicMap.get(key)!;
          existing.videoSources.add(vt.videoId);
          topic.subtopics.forEach(st => existing.subtopics.add(st));
          // Merge descriptions if different
          if (topic.description && !existing.description.includes(topic.description)) {
            existing.description += ' ' + topic.description;
          }
        } else {
          topicMap.set(key, {
            title: topic.title,
            description: topic.description,
            subtopics: new Set(topic.subtopics),
            videoSources: new Set([vt.videoId])
          });
        }
      }
    }

    // Use LLM to intelligently merge similar topics
    const allTopicTitles = Array.from(topicMap.values()).map(t => t.title);

    if (allTopicTitles.length > 5) {
      const mergePrompt = `Given these topic titles from a technical video series, identify topics that should be merged because they cover the same concept:

Topics:
${allTopicTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Return a JSON object mapping topic indices (1-based) that should be merged. EXAMPLE:
{
  "merges": [
    { "keep": 1, "merge": [3, 7] },
    { "keep": 2, "merge": [5] }
  ]
}

RULES:
- Only merge topics that clearly cover the same concept
- If no merges needed, return {"merges": []}
- Ensure valid JSON with proper quotes and commas
- Do not include comments in JSON`;

      try {
        const mergeResult = await llmService.generateJSONLocal<{ merges: { keep: number; merge: number[] }[] }>(mergePrompt);

        // Validate the merge result structure
        if (!mergeResult || typeof mergeResult !== 'object') {
          console.warn('⚠️ Invalid merge result: not an object');
        } else if (!Array.isArray(mergeResult.merges)) {
          console.warn('⚠️ Invalid merge result: merges is not an array', mergeResult);
        } else {
          console.log(`📊 Applying ${mergeResult.merges.length} topic merge(s)...`);

          // Apply merges
          for (const merge of mergeResult.merges) {
            if (!merge || typeof merge.keep !== 'number' || !Array.isArray(merge.merge)) {
              console.warn('⚠️ Skipping invalid merge entry:', merge);
              continue;
            }

            const keepTitle = allTopicTitles[merge.keep - 1];
            if (!keepTitle) {
              console.warn(`⚠️ Invalid keep index: ${merge.keep}`);
              continue;
            }

            const keepKey = this.normalizeTopicTitle(keepTitle);
            const keepTopic = topicMap.get(keepKey);

            if (keepTopic) {
              for (const mergeIdx of merge.merge) {
                if (typeof mergeIdx !== 'number' || mergeIdx < 1 || mergeIdx > allTopicTitles.length) {
                  console.warn(`⚠️ Invalid merge index: ${mergeIdx}`);
                  continue;
                }

                const mergeTitle = allTopicTitles[mergeIdx - 1];
                const mergeKey = this.normalizeTopicTitle(mergeTitle);
                const mergeTopic = topicMap.get(mergeKey);

                if (mergeTopic) {
                  console.log(`  ✓ Merging "${mergeTitle}" into "${keepTitle}"`);
                  mergeTopic.videoSources.forEach(vs => keepTopic.videoSources.add(vs));
                  mergeTopic.subtopics.forEach(st => keepTopic.subtopics.add(st));
                  topicMap.delete(mergeKey);
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('❌ Topic merge failed, using original topics:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Convert to TopicNode array
    const transcriptMap = new Map(transcripts.map(t => [t.videoId, t]));

    return Array.from(topicMap.values()).map((topic, index): TopicNode => ({
      id: uuidv4(),
      title: topic.title,
      description: topic.description,
      subtopics: Array.from(topic.subtopics).map(st => ({
        id: uuidv4(),
        title: st,
        videoSources: Array.from(topic.videoSources)
      })),
      videoSources: Array.from(topic.videoSources),
      order: index
    }));
  }

  // Order topics from basic to advanced
  private async orderTopics(topics: TopicNode[]): Promise<TopicNode[]> {
    if (topics.length <= 2) {
      return topics;
    }

    const systemPrompt = `You are organizing a technical curriculum. Order topics from foundational/basic concepts to advanced/specialized topics.`;

    const prompt = `Order these topics from most fundamental to most advanced:

${topics.map((t, i) => `${i + 1}. ${t.title}: ${t.description || 'No description'}`).join('\n')}

Return a JSON array of the topic numbers in the correct order:
{ "order": [1, 3, 2, 5, 4] }`;

    try {
      const result = await llmService.generateJSONLocal<{ order: number[] }>(prompt, systemPrompt);

      const orderedTopics: TopicNode[] = [];
      for (let i = 0; i < result.order.length; i++) {
        const originalIndex = result.order[i] - 1;
        if (originalIndex >= 0 && originalIndex < topics.length) {
          const topic = { ...topics[originalIndex], order: i };
          orderedTopics.push(topic);
        }
      }

      // Add any missing topics at the end
      for (const topic of topics) {
        if (!orderedTopics.find(t => t.id === topic.id)) {
          orderedTopics.push({ ...topic, order: orderedTopics.length });
        }
      }

      return orderedTopics;
    } catch (error) {
      console.warn('Topic ordering failed, using original order:', error);
      return topics.map((t, i) => ({ ...t, order: i }));
    }
  }

  // Normalize topic title for comparison
  private normalizeTopicTitle(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Normalize raw topics to ensure they have all required fields
  private normalizeRawTopics(topics: any): RawTopic[] {
    if (!Array.isArray(topics)) {
      console.warn('Topics is not an array, returning empty array');
      return [];
    }

    return topics
      .filter(topic => topic && typeof topic === 'object')
      .map(topic => ({
        title: topic.title || topic.name || 'Untitled Topic',
        description: topic.description || topic.desc || '',
        subtopics: Array.isArray(topic.subtopics)
          ? topic.subtopics.filter((st: any) => typeof st === 'string' && st.trim().length > 0)
          : []
      }))
      .filter(topic => topic.title !== 'Untitled Topic' && topic.title.trim().length > 0);
  }

  // Deduplicate raw topics
  private deduplicateRawTopics(topics: RawTopic[]): RawTopic[] {
    const seen = new Map<string, RawTopic>();

    for (const topic of topics) {
      const key = this.normalizeTopicTitle(topic.title);
      if (!seen.has(key)) {
        seen.set(key, topic);
      } else {
        // Merge subtopics
        const existing = seen.get(key)!;
        topic.subtopics.forEach(st => {
          if (!existing.subtopics.includes(st)) {
            existing.subtopics.push(st);
          }
        });
      }
    }

    return Array.from(seen.values());
  }

  // Store index to disk
  private storeIndex(index: UnifiedIndex): void {
    const filePath = path.join(STORAGE_DIR, `${index.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(index, null, 2));
    console.log(`Index stored: ${filePath}`);
  }

  // Load index from disk
  loadIndex(indexId: string): UnifiedIndex | null {
    const filePath = path.join(STORAGE_DIR, `${indexId}.json`);

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as UnifiedIndex;
    }

    return null;
  }
}

export const indexService = new IndexService();
