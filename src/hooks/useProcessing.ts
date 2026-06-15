import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessingState, ProcessingStep, VideoNotes, TopicIndex, JobStatus } from '@/types';
import { api } from '@/services/api';

const initialSteps: ProcessingStep[] = [
  { id: 'extract', label: 'Extracting Transcripts', description: 'Fetching video transcripts from YouTube', status: 'pending' },
  { id: 'analyze', label: 'Analyzing Content', description: 'Analyzing transcript content and structure', status: 'pending' },
  { id: 'index', label: 'Generating Index', description: 'Creating unified topic index', status: 'pending' },
  { id: 'notes', label: 'Generating Notes', description: 'Writing detailed notes for each topic', status: 'pending' },
  { id: 'assemble', label: 'Assembling Notebook', description: 'Compiling final notebook', status: 'pending' },
];

export const useProcessing = (initialJobId?: string | null) => {
  const [state, setState] = useState<ProcessingState>({
    status: 'idle',
    currentStep: 0,
    steps: initialSteps,
  });

  const [logs, setLogs] = useState<{ id: string; message: string; type: 'info' | 'success' | 'error' | 'ai'; timestamp: string }[]>([]);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'ai' = 'info') => {
    setLogs(prev => [{
      id: Math.random().toString(36).substring(7),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 50));
  }, []);

  const eventSourceRef = useRef<EventSource | null>(null);
  const currentJobIdRef = useRef<string | null>(null);

  // Helper to build markdown from sections
  const buildContentFromSections = (note: any): string => {
    if (!note.sections?.length) return note.summary || '';
    return note.sections.map((s: any) => {
      if (s.type === 'heading') return `${'#'.repeat((s.level || 2) + 1)} ${s.content}`;
      if (s.type === 'code') return `\`\`\`${s.codeSnippet?.language || ''}\n${s.codeSnippet?.code || s.content}\n\`\`\``;
      if (s.type === 'bullets') return s.items?.map((i: string) => `- ${i}`).join('\n') || s.content;
      if (s.type === 'numbered') return s.items?.map((i: string, idx: number) => `${idx + 1}. ${i}`).join('\n') || s.content;
      if (s.type === 'quote' || s.type === 'special') return `> ${s.specialNote?.content || s.content}`;
      return s.content || '';
    }).join('\n\n');
  };

  const handleJobUpdate = useCallback((jobStatus: JobStatus) => {
    // Map backend status to frontend status
    const mapStatus = (backendStatus: string): string => {
      switch (backendStatus) {
        case 'extracting-transcripts': return 'extracting';
        case 'analyzing-content':
        case 'generating-index': return 'indexing';
        case 'awaiting-approval': return 'awaiting-approval';
        case 'generating-notes': return 'generating';
        case 'assembling-notebook': return 'assembling';
        case 'complete': return 'complete';
        case 'error': return 'error';
        case 'paused-rate-limit': return 'paused-rate-limit';
        default: return backendStatus;
      }
    };

    const updatedSteps = jobStatus.steps || initialSteps;
    const mappedStatus = mapStatus(jobStatus.status);

    setState(prev => {
      const newState: ProcessingState = {
        ...prev,
        status: mappedStatus as any,
        currentStep: jobStatus.currentStep,
        steps: updatedSteps,
        videoInfo: jobStatus.videoInfo,
        videoCount: jobStatus.videos?.length,
        ...(jobStatus.index && { index: jobStatus.index }),
      };

      // Add logs based on status changes
      if (prev.status !== newState.status) {
        addLog(`Transitioned to state: ${newState.status}`, 'info');
      }

      // If job is complete, transform notebook to notes format
      if (jobStatus.status === 'complete' && jobStatus.notebook) {
        // ... (rest of transformation logic)
        const topicIndex: TopicIndex[] = jobStatus.notebook.index?.topics?.map((topic: any) => ({
          id: topic.id,
          title: topic.title,
          subtopics: topic.subtopics?.map((st: any) => st.title) || [],
        })) || [];

        const allTopicNotes: any[] = [];
        if (jobStatus.notebook.chapters) {
          jobStatus.notebook.chapters.forEach((chapter: any) => {
            if (chapter.topics) allTopicNotes.push(...chapter.topics);
          });
        }

        newState.topicIndex = topicIndex;
        newState.notes = {
          videoId: jobStatus.videoInfo?.id || 'unknown',
          notebookId: jobStatus.notebook.id,
          title: jobStatus.notebook.title,
          index: topicIndex,
          notes: allTopicNotes.map((note: any) => ({
            ...note,
            content: buildContentFromSections(note),
            title: note.topicTitle,
          })) as any,
          fullContent: allTopicNotes.map((note: any) => `## ${note.topicTitle}\n\n${buildContentFromSections(note)}`).join('\n\n---\n\n'),
        };
        addLog('Notebook generation complete!', 'success');
      }

      return newState;
    });

    if (jobStatus.status === 'complete' || jobStatus.status === 'error') {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [addLog]);

  const connectToStream = useCallback((jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    const url = `${apiBase}/process/stream/${jobId}`;

    console.log(`🔌 Connecting to SSE stream: ${url}`);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('job:update', (e) => {
      try {
        const job = JSON.parse(e.data);
        handleJobUpdate(job);

        // Log important updates
        const activeStep = job.steps[job.currentStep];
        if (activeStep) {
          addLog(`${activeStep.label}: ${activeStep.details || 'Processing...'}`, 'ai');
        }
      } catch (err) {
        console.error('Failed to parse job update:', err);
      }
    });

    es.addEventListener('note:delta', (e) => {
      try {
        const { topicId, delta } = JSON.parse(e.data);
        setState(prev => {
          if (!prev.notes) {
            // Initialize notes structure if missing
            const dummyNotes: VideoNotes = {
              videoId: prev.videoInfo?.id || 'pending',
              title: prev.videoInfo?.title || 'Generating Notes...',
              index: [],
              notes: [],
              fullContent: ''
            };
            prev = { ...prev, notes: dummyNotes };
          }

          const existingNoteIdx = prev.notes!.notes.findIndex(n => n.topicId === topicId);
          const updatedNotesList = [...prev.notes!.notes];

          if (existingNoteIdx >= 0) {
            const note = updatedNotesList[existingNoteIdx];
            updatedNotesList[existingNoteIdx] = {
              ...note,
              content: (note.content || '') + delta
            };
          } else {
            updatedNotesList.push({
              topicId,
              topicTitle: 'Generating...',
              content: delta,
              summary: '',
              sections: [],
              keyTakeaways: [],
              videoSources: [],
              generatedAt: new Date().toISOString(),
              title: 'Generating...'
            } as any);
          }

          return {
            ...prev,
            notes: {
              ...prev.notes!,
              notes: updatedNotesList,
              fullContent: updatedNotesList.map(n => `## ${n.title || n.topicTitle}\n\n${n.content}`).join('\n\n---\n\n')
            }
          };
        });
      } catch (err) {
        console.error('Failed to parse note delta:', err);
      }
    });

    es.onerror = (err) => {
      console.error('SSE Error:', err);
      es.close();
      eventSourceRef.current = null;
    };

    return () => {
      es.close();
    };
  }, [handleJobUpdate, addLog]);

  // Synchronize with an existing job
  const syncJob = useCallback(async (jobId: string) => {
    try {
      addLog(`Synchronizing with job ${jobId.slice(0, 8)}...`, 'info');
      const jobStatus = await api.getJobStatus(jobId);
      currentJobIdRef.current = jobId;
      handleJobUpdate(jobStatus);
      connectToStream(jobId);
    } catch (err) {
      console.error('Failed to sync job:', err);
      addLog('Failed to find existing job', 'error');
    }
  }, [handleJobUpdate, connectToStream, addLog]);

  useEffect(() => {
    if (initialJobId && !currentJobIdRef.current) {
      syncJob(initialJobId);
    }
  }, [initialJobId, syncJob]);

  const startProcessing = useCallback(async (url: string, userNotes?: string, creativityLevel?: number, generationMode?: 'topical' | 'chronological') => {
    try {
      setState({
        status: 'extracting',
        currentStep: 0,
        steps: initialSteps.map((s, i) => ({
          ...s,
          status: i === 0 ? 'active' : 'pending',
        })),
      });

      const response = await api.startProcessing(url, userNotes, creativityLevel, generationMode);
      const jobId = response.jobId;
      currentJobIdRef.current = jobId;

      connectToStream(jobId);
      return jobId;
    } catch (error) {
      console.error('Error starting processing:', error);
      setState(prev => ({
        ...prev,
        status: 'idle',
        steps: initialSteps.map(s => ({ ...s, status: 'error' })),
      }));
    }
  }, [connectToStream]);

  const approveIndex = useCallback(async (updatedIndex: any) => {
    const jobId = currentJobIdRef.current;
    if (!jobId) return;

    try {
      await api.approveIndex(jobId, updatedIndex);
      setState(prev => ({
        ...prev,
        status: 'generating',
        index: updatedIndex,
      }));

      // Ensure we are connected
      if (!eventSourceRef.current) {
        connectToStream(jobId);
      }
    } catch (error) {
      console.error('Error approving index:', error);
      setState(prev => ({ ...prev, error: 'Failed to approve index' }));
    }
  }, [connectToStream]);

  const resumeJob = useCallback(async () => {
    const jobId = currentJobIdRef.current;
    if (!jobId) return;

    try {
      addLog('Resuming job generation...', 'info');
      await api.resumeJob(jobId);
      setState(prev => ({
        ...prev,
        status: 'generating',
      }));

      if (!eventSourceRef.current) {
        connectToStream(jobId);
      }
    } catch (error) {
      console.error('Error resuming job:', error);
      addLog('Failed to resume job', 'error');
    }
  }, [connectToStream, addLog]);

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState({
      status: 'idle',
      currentStep: 0,
      steps: initialSteps.map(s => ({ ...s, status: 'pending', progress: undefined })),
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    state,
    logs,
    startProcessing,
    approveIndex,
    resumeJob,
    reset,
  };
};
