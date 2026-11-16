import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { repairMermaidDeterministic } from '../src/services/mermaid/repair';
import type {
  Notebook,
  Chapter,
  TopicNode,
  TopicNotes,
  QuizQuestion,
  InterviewQuestion,
  MindMapData,
} from '../src/types';

// Target database paths
const DB_PATHS = [
  '/home/sameer/.local/share/com.noteforge.ai/noteforge.db',
  '/home/sameer/.local/share/com.tauri.dev/noteforge.db',
];

function parseTime(t: string | undefined): number {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

interface ParsedLecture {
  number: string;
  title: string;
  timeDisplay: string;
  startTime: number;
  content: string;
}

function parseMarkdownFile(filePath: string): {
  notebook: Notebook;
  jobId: string;
  playlistUrl: string;
  wordCount: number;
  lecturesCount: number;
  diagramsRepaired: number;
} {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');

  // 1. Extract metadata from header block
  const mainTitle = lines[0].replace(/^#\s*/, '').trim();
  let playlistUrl = '';
  let notebookId = '';
  let jobId = '';
  let createdAt = new Date().toISOString();

  for (let i = 1; i < 20; i++) {
    const l = lines[i] || '';
    if (l.includes('**Source Playlist**:')) {
      const m = l.match(/\*\*Source Playlist\*\*:\s*(\S+)/);
      if (m) playlistUrl = m[1].trim();
    }
    if (l.includes('**Notebook ID**:')) {
      const m = l.match(/\*\*Notebook ID\*\*:\s*(\S*)/);
      if (m && m[1]) notebookId = m[1].trim();
      else if (lines[i + 1] && !lines[i + 1].startsWith('>')) {
        notebookId = lines[i + 1].trim();
      }
    }
    if (l.includes('**Job ID**:')) {
      const m = l.match(/\*\*Job ID\*\*:\s*(\S+)/);
      if (m) jobId = m[1].trim();
    }
    if (l.includes('**Backup Date**:') || l.includes('**Generated Date**:')) {
      const m = l.match(/\*\*(?:Backup|Generated) Date\*\*:\s*(\S+)/);
      if (m) createdAt = m[1].trim();
    }
  }

  // Normalize IDs
  if (notebookId.startsWith('b-')) notebookId = 'n' + notebookId;
  if (!notebookId && jobId) notebookId = jobId.replace('job-', 'nb-');
  if (!notebookId) notebookId = `nb-${Date.now()}`;
  if (!jobId) jobId = notebookId.replace('nb-', 'job-');

  // 2. Parse lectures
  const lectureRegex = /^## Lecture\s+([\d.]+):\s*(.+?)(?:\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\])?$/;
  const rawLectures: ParsedLecture[] = [];
  let cur: Omit<ParsedLecture, 'content'> | null = null;
  let curLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const match = l.match(lectureRegex);

    if (match && (i <= 15 || lines[i - 1]?.trim() === '---' || lines[i - 2]?.trim() === '---')) {
      if (cur) {
        rawLectures.push({
          ...cur,
          content: curLines.join('\n').trim(),
        });
      }
      cur = {
        number: match[1],
        title: match[2].trim(),
        timeDisplay: match[3] || '0:00',
        startTime: parseTime(match[3] || '0:00'),
      };
      curLines = [];
    } else if (cur) {
      curLines.push(l);
    }
  }
  if (cur) {
    rawLectures.push({
      ...cur,
      content: curLines.join('\n').trim(),
    });
  }

  // 3. Clean up content and repair Mermaid diagrams
  let diagramsRepaired = 0;
  const mermaidRegex = /```mermaid([\s\S]*?)```/g;

  const topicNodes: TopicNode[] = [];
  const topicNotes: TopicNotes[] = [];

  rawLectures.forEach((lec, idx) => {
    const topicId = `topic-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`;

    // Repair Mermaid diagrams in lecture content
    let cleanedContent = lec.content.replace(mermaidRegex, (match, code) => {
      const rawCode = code.trim();
      const repaired = repairMermaidDeterministic(rawCode);
      if (repaired !== rawCode) {
        diagramsRepaired++;
      }
      return `\`\`\`mermaid\n${repaired}\n\`\`\``;
    });

    // Strip any raw HTML span tags wrapping timestamps
    cleanedContent = cleanedContent
      .replace(/<span[^>]*style="[^"]*monospace[^"]*"[^>]*>(\d{1,2}:\d{2}(?::\d{2})?)<\/span>/gi, '$1')
      .replace(/<span[^>]*>(\d{1,2}:\d{2}(?::\d{2})?)<\/span>/gi, '$1');

    // Extract subtopic titles from headings
    const headingMatches = cleanedContent.match(/^###?\s+([^[\n]+)/gm) || [];
    const subtopics = headingMatches
      .map((h) => h.replace(/^###?\s+/, '').trim())
      .filter((h) => !h.startsWith('Lecture') && !h.startsWith('Comprehensive') && h !== lec.title)
      .slice(0, 6)
      .map((stTitle, sIdx) => ({
        id: `sub-${idx}-${sIdx}`,
        title: stTitle,
        videoSources: [lec.title],
      }));

    // Extract summary snippet
    const summaryMatch = cleanedContent.match(/(?:### Summary|## Introduction[^\n]*)\n+([^#>\n][^\n]+)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : `Master study notes for ${lec.title}`;

    topicNodes.push({
      id: topicId,
      title: lec.title,
      description: summary,
      subtopics:
        subtopics.length > 0
          ? subtopics
          : [{ id: `sub-${idx}-0`, title: 'Core Concepts', videoSources: [lec.title] }],
      videoSources: [lec.title],
      order: idx + 1,
      startTime: lec.startTime,
      timeDisplay: lec.timeDisplay,
    });

    topicNotes.push({
      topicId,
      topicTitle: lec.title,
      title: lec.title,
      summary,
      sections: [],
      keyTakeaways: [],
      videoSources: [
        {
          videoId: lec.title,
          videoTitle: lec.title,
          timestamps: [lec.startTime],
        },
      ],
      generatedAt: createdAt,
      content: cleanedContent,
      startTime: lec.startTime,
      timeDisplay: lec.timeDisplay,
    });
  });

  const fullContent = rawLectures.map((l) => `## ${l.title}\n\n${l.content}`).join('\n\n---\n\n');
  const wordCount = fullContent.split(/\s+/).filter(Boolean).length;
  const estimatedReadTime = Math.max(1, Math.round(wordCount / 200));

  // 4. Quizzes and Interview QA
  const isSeason1 = filePath.includes('Season_01');
  const quiz: QuizQuestion[] = isSeason1
    ? [
        {
          id: 'q1',
          type: 'mcq',
          question: 'What is the Execution Context in JavaScript made of?',
          options: [
            'Memory Component (Variable Environment) and Code Component (Thread of Execution)',
            'Call Stack and Event Loop only',
            'DOM Tree and CSSOM Tree',
            'Microtask Queue and Callback Queue',
          ],
          answer: 'Memory Component (Variable Environment) and Code Component (Thread of Execution)',
          explanation: 'Every execution context has two components: the Memory component (stores variables and functions as key-value pairs) and the Code component (where code is executed line-by-line).',
          topic: 'Execution Context',
          difficulty: 'easy',
        },
        {
          id: 'q2',
          type: 'mcq',
          question: 'What is the Temporal Dead Zone (TDZ) for let and const variables?',
          options: [
            'The phase between memory allocation (hoisting) and actual initialization in code',
            'The duration a script waits for setTimeout to complete',
            'The time spent waiting for garbage collection',
            'The time taken to download external JavaScript files',
          ],
          answer: 'The phase between memory allocation (hoisting) and actual initialization in code',
          explanation: 'let and const variables are hoisted in a separate memory space (Script) and cannot be accessed before their initialization line, throwing a ReferenceError.',
          topic: 'let & const / Hoisting',
          difficulty: 'medium',
        },
        {
          id: 'q3',
          type: 'mcq',
          question: 'Which queue has higher priority in JavaScript: Microtask Queue or Callback (Task) Queue?',
          options: [
            'Microtask Queue',
            'Callback Queue',
            'Both have identical priority',
            'Priority depends on the browser thread pool',
          ],
          answer: 'Microtask Queue',
          explanation: 'The event loop gives strict priority to the Microtask Queue (Promises, MutationObserver). The Callback Queue tasks only execute after the Microtask Queue is completely empty.',
          topic: 'Event Loop & Microtasks',
          difficulty: 'medium',
        },
        {
          id: 'q4',
          type: 'mcq',
          question: 'What happens when a closure is created in JavaScript?',
          options: [
            'A function retains a reference to its lexical environment even when executed outside its scope',
            'The function variables are cloned into global memory',
            'The outer function cannot be garbage-collected until page reload',
            'Variables become immutable constants',
          ],
          answer: 'A function retains a reference to its lexical environment even when executed outside its scope',
          explanation: 'A closure is a function bundled together with references to its lexical environment (its surrounding state).',
          topic: 'Closures',
          difficulty: 'hard',
        },
      ]
    : [
        {
          id: 'q1',
          type: 'mcq',
          question: 'What are the three possible states of a JavaScript Promise?',
          options: [
            'pending, fulfilled, rejected',
            'waiting, completed, failed',
            'idle, active, resolved',
            'initial, executing, terminated',
          ],
          answer: 'pending, fulfilled, rejected',
          explanation: 'A Promise is always in one of three mutually exclusive states: pending (initial), fulfilled (resolved successfully), or rejected (failed with an error).',
          topic: 'Promises',
          difficulty: 'easy',
        },
        {
          id: 'q2',
          type: 'mcq',
          question: 'How does Promise.all() differ from Promise.allSettled()?',
          options: [
            'Promise.all rejects immediately upon the first rejection; Promise.allSettled waits for all promises regardless of success or failure',
            'Promise.all runs sequentially, while Promise.allSettled runs in parallel',
            'Promise.all works only with fetch requests; Promise.allSettled works with any function',
            'There is no difference in modern browsers',
          ],
          answer: 'Promise.all rejects immediately upon the first rejection; Promise.allSettled waits for all promises regardless of success or failure',
          explanation: 'Promise.all fails-fast on the first rejection, whereas Promise.allSettled waits for every promise to settle and provides an array of result objects with status and value/reason.',
          topic: 'Promise APIs',
          difficulty: 'medium',
        },
        {
          id: 'q3',
          type: 'mcq',
          question: 'What does the async keyword do when placed before a function declaration?',
          options: [
            'Ensures the function always returns a Promise (wrapping non-promise return values automatically)',
            'Forces the function to run on a background Web Worker thread',
            'Converts all synchronous calls inside into asynchronous ones',
            'Prevents any errors from throwing',
          ],
          answer: 'Ensures the function always returns a Promise (wrapping non-promise return values automatically)',
          explanation: 'An async function always returns a Promise. If the function returns a value that is not a Promise, JavaScript wraps it in a resolved Promise automatically.',
          topic: 'async / await',
          difficulty: 'medium',
        },
        {
          id: 'q4',
          type: 'mcq',
          question: 'In JavaScript non-strict mode, what does `this` point to inside a standalone regular function call?',
          options: [
            'The global window / globalThis object',
            'undefined',
            'The function object itself',
            'The nearest parent object',
          ],
          answer: 'The global window / globalThis object',
          explanation: 'In non-strict mode, "this substitution" occurs so `this` references the global object (`window` in browsers). In strict mode (`"use strict"`), `this` remains `undefined`.',
          topic: 'this Keyword',
          difficulty: 'hard',
        },
      ];

  const interviewQA: InterviewQuestion[] = isSeason1
    ? [
        {
          id: 'i1',
          category: 'conceptual',
          question: 'Explain JavaScript Hoisting and why let/const behave differently from var.',
          answer: 'Hoisting is JavaScript\'s default behavior of moving variable and function declarations to the top of their containing scope during the memory allocation phase before execution. While `var` is initialized with `undefined`, `let` and `const` are hoisted in a distinct Script/Block scope and remain uninitialized in the "Temporal Dead Zone" (TDZ). Accessing them before declaration causes a ReferenceError.',
          followUp: 'Why was the Temporal Dead Zone introduced in ES6?',
          difficulty: 'junior',
          topic: 'Hoisting & Scope',
        },
        {
          id: 'i2',
          category: 'technical',
          question: 'How do closures work under the hood, and how can they cause memory leaks if not managed carefully?',
          answer: 'When a function is declared inside another function, it maintains an internal reference `[[Scopes]]` to its lexical environment. Even after the outer function returns and pops off the call stack, the memory allocated for variables referenced by the inner function cannot be reclaimed by garbage collection. Memory leaks occur when long-lived closures (e.g. event listeners or global timers) retain large objects or unused variables indefinitely.',
          followUp: 'How can you clean up event listener closures to prevent leaks?',
          difficulty: 'mid',
          topic: 'Closures & Memory',
        },
        {
          id: 'i3',
          category: 'practical',
          question: 'Explain the Event Loop starvation problem caused by microtasks.',
          answer: 'The Event Loop checks the Microtask Queue before the Callback (Macrotask) Queue. If microtasks continuously schedule more microtasks (e.g. infinite Promise recursion or MutationObserver callbacks), the Microtask Queue never empties. Consequently, tasks in the Callback Queue (such as UI rendering, setTimeout, click handlers) never execute, freezing user interaction.',
          followUp: 'How does the browser rendering step integrate with the Event Loop?',
          difficulty: 'senior',
          topic: 'Event Loop & Concurrency',
        },
      ]
    : [
        {
          id: 'i1',
          category: 'conceptual',
          question: 'What is Inversion of Control and how do Promises solve it over callbacks?',
          answer: 'Inversion of Control occurs when we pass a callback function to a third-party or asynchronous function, handing over control of execution. The third-party API might call our callback zero times, multiple times, or with unexpected parameters. Promises invert this control back to the caller: a Promise is an immutable container for a future value, ensuring callbacks registered with `.then()` are executed exactly once when the promise settles.',
          followUp: 'What are the three guarantees provided by the Promises/A+ specification?',
          difficulty: 'junior',
          topic: 'Inversion of Control & Promises',
        },
        {
          id: 'i2',
          category: 'technical',
          question: 'Compare Promise.all, Promise.allSettled, Promise.race, and Promise.any.',
          answer: '1. Promise.all: Waits for all to fulfill; rejects immediately on the first rejection.\n2. Promise.allSettled: Waits for all to settle (fulfilled or rejected) and returns an array of status descriptors.\n3. Promise.race: Settles as soon as the first promise settles (winner takes all, success or failure).\n4. Promise.any: Waits for the first promise to fulfill; only rejects if all promises reject (AggregateError).',
          followUp: 'When would you specifically choose Promise.any over Promise.race?',
          difficulty: 'mid',
          topic: 'Promise Combinators',
        },
        {
          id: 'i3',
          category: 'practical',
          question: 'How does async/await suspend and resume execution on the JavaScript call stack behind the scenes?',
          answer: 'Under the hood, async/await is syntactic sugar over Promises and Generator functions. When an `await` expression is encountered, execution of the async function suspends, its current execution context is popped off the Call Stack, and control returns to the caller. When the awaited Promise settles, a microtask is queued to push the suspended context back onto the Call Stack and resume execution right after the await.',
          followUp: 'Does async/await block the main JavaScript thread?',
          difficulty: 'senior',
          topic: 'async / await & Engine Internals',
        },
      ];

  // 5. Concept Map for Topic 1
  const primaryTopic = topicNodes[0];
  const primarySubtopics = primaryTopic.subtopics || [];
  const mindMaps: Record<string, MindMapData> = {};

  if (primaryTopic) {
    const mmNodes: any[] = [
      {
        id: 'root',
        type: 'central',
        data: { label: primaryTopic.title },
        position: { x: 0, y: 0 },
      },
    ];
    const mmEdges: any[] = [];
    const branchColors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

    primarySubtopics.slice(0, 5).forEach((st, sIdx) => {
      const bId = `branch-${sIdx}`;
      const color = branchColors[sIdx % branchColors.length];
      mmNodes.push({
        id: bId,
        type: 'branch',
        data: { label: typeof st === 'string' ? st : st.title, color },
        position: { x: 280, y: (sIdx - 2) * 100 },
      });
      mmEdges.push({
        id: `e-root-${bId}`,
        source: 'root',
        target: bId,
      });

      // Sample leaf nodes
      const lId = `leaf-${sIdx}-1`;
      mmNodes.push({
        id: lId,
        type: 'leaf',
        data: { label: `Key principles of ${typeof st === 'string' ? st : st.title}`, color },
        position: { x: 560, y: (sIdx - 2) * 100 },
      });
      mmEdges.push({
        id: `e-${bId}-${lId}`,
        source: bId,
        target: lId,
      });
    });

    mindMaps[primaryTopic.id] = {
      topicId: primaryTopic.id,
      nodes: mmNodes,
      edges: mmEdges,
    };
  }

  const notebook: Notebook = {
    id: notebookId,
    title: mainTitle,
    description: `Complete Master Study Guide with ${topicNodes.length} comprehensive lectures, code walkthroughs, and architecture diagrams.`,
    chapters: [
      {
        id: 'chap-1',
        title: 'Curriculum Notes',
        order: 1,
        topics: topicNotes,
      },
    ],
    index: {
      id: `idx-${notebookId}`,
      title: mainTitle,
      topics: topicNodes,
      createdAt,
      updatedAt: createdAt,
      videoCount: topicNodes.length,
      topicCount: topicNodes.length,
    },
    metadata: {
      totalVideos: isSeason1 ? 23 : 8,
      totalTopics: topicNodes.length,
      totalWords: wordCount,
      estimatedReadTime,
      sourcePlaylistId: playlistUrl.split('list=')[1] || '',
      sourceVideos: rawLectures.map((l, i) => ({
        id: `lec-${i + 1}`,
        title: l.title,
        chapters: [{ title: l.title, start_seconds: l.startTime, time_display: l.timeDisplay }],
      })),
    },
    quiz,
    interviewQA,
    mindMaps,
    createdAt,
    updatedAt: createdAt,
  };

  return {
    notebook,
    jobId,
    playlistUrl,
    wordCount,
    lecturesCount: topicNodes.length,
    diagramsRepaired,
  };
}

// ── Main Ingestion Runner ───────────────────────────────────────────────────────

async function run() {
  console.log('Starting NoteForge Backup Ingestion Pipeline...\n');

  const files = [
    '/home/sameer/Projects/NoteForge-AI/Playlist_1_Namaste_JavaScript_Season_01_Complete_Notes.md',
    '/home/sameer/Projects/NoteForge-AI/Playlist_2_Namaste_JavaScript_Season_02_Complete_Notes.md',
  ];

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }

    console.log(`Parsing backup file: ${path.basename(filePath)}...`);
    const parsed = parseMarkdownFile(filePath);
    const { notebook, jobId, playlistUrl, wordCount, lecturesCount, diagramsRepaired } = parsed;

    console.log(`  Title: ${notebook.title}`);
    console.log(`  Notebook ID: ${notebook.id}`);
    console.log(`  Job ID: ${jobId}`);
    console.log(`  Lectures / Topics: ${lecturesCount}`);
    console.log(`  Total Word Count: ${wordCount.toLocaleString()} words (~${notebook.metadata.estimatedReadTime}m read)`);
    console.log(`  Diagrams repaired: ${diagramsRepaired}`);
    console.log(`  Quiz questions: ${notebook.quiz?.length || 0}`);
    console.log(`  Interview QA: ${notebook.interviewQA?.length || 0}`);

    // Serialize payload
    const contentJson = JSON.stringify(notebook);
    const optionsJson = JSON.stringify({
      notebookId: notebook.id,
      notebook,
      videoSources: notebook.metadata.sourceVideos,
      index: notebook.index,
    });

    const tempJsonPath = `/tmp/noteforge_import_${notebook.id}.json`;
    const tempOptsPath = `/tmp/noteforge_options_${notebook.id}.json`;
    fs.writeFileSync(tempJsonPath, contentJson, 'utf8');
    fs.writeFileSync(tempOptsPath, optionsJson, 'utf8');

    for (const dbPath of DB_PATHS) {
      if (!fs.existsSync(dbPath)) {
        console.log(`  Database not found at ${dbPath}, skipping.`);
        continue;
      }

      console.log(`  Writing to SQLite vault: ${dbPath}`);

      // Upsert notebook
      const escapedTitle = notebook.title.replace(/'/g, "''");
      const upsertNotebookCmd = `sqlite3 "${dbPath}" "INSERT OR REPLACE INTO notebooks (id, job_id, title, content_json, created_at) VALUES ('${notebook.id}', '${jobId}', '${escapedTitle}', CAST(readfile('${tempJsonPath}') AS TEXT), '${notebook.createdAt}');"`;
      execSync(upsertNotebookCmd);

      // Upsert job
      const upsertJobCmd = `sqlite3 "${dbPath}" "INSERT OR REPLACE INTO jobs (id, url, status, current_step, options_json, created_at, updated_at) VALUES ('${jobId}', '${playlistUrl}', 'complete', 3, CAST(readfile('${tempOptsPath}') AS TEXT), '${notebook.createdAt}', '${notebook.updatedAt}');"`;
      execSync(upsertJobCmd);

      console.log(`  Successfully archived "${notebook.title}" to ${dbPath}`);
    }

    // Cleanup temp files
    if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
    if (fs.existsSync(tempOptsPath)) fs.unlinkSync(tempOptsPath);

    console.log('');
  }

  // Verification step
  console.log('Verifying SQLite Vault Content...');
  for (const dbPath of DB_PATHS) {
    if (!fs.existsSync(dbPath)) continue;
    console.log(`\nDatabase: ${dbPath}`);
    const checkCmd = `sqlite3 "${dbPath}" "SELECT id, title, created_at FROM notebooks;"`;
    const output = execSync(checkCmd, { encoding: 'utf8' });
    console.log(output);
  }

  console.log('Migration completed successfully!');
}

run().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
