import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessingState, ProcessingStep, VideoNotes, TopicIndex, JobStatus } from '@/types';
import { api } from '@/services/api';
import { isTauri } from '@/services/tauri';
import { nativePipeline, PIPELINE_STEPS } from '@/services/nativePipeline';

export const useProcessing = (initialJobId?: string | null) => {
  const [state, setState] = useState<ProcessingState>({
    status: 'idle',
    currentStep: 0,
    steps: PIPELINE_STEPS,
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

    const updatedSteps = jobStatus.steps || PIPELINE_STEPS;
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

      if (jobStatus.status === 'complete' && jobStatus.notebook) {
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
            topicId: note.topicId,
            summary: note.summary,
            sections: note.sections || [],
            keyTakeaways: note.keyTakeaways || [],
            videoSources: note.videoSources || [],
            generatedAt: note.generatedAt || new Date().toISOString(),
          })),
          fullContent: allTopicNotes.map((note: any) => `## ${note.topicTitle}\n\n${buildContentFromSections(note)}`).join('\n\n---\n\n'),
        };
      }

      return newState;
    });
  }, []);

  const connectToStream = useCallback((jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    const url = `${apiBase}/process/stream/${jobId}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('job:update', (e) => {
      try {
        const job = JSON.parse(e.data);
        handleJobUpdate(job);
      } catch (err) {
        console.error('Failed to parse job update:', err);
      }
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [handleJobUpdate]);

  // Sync / Subscribe to job
  useEffect(() => {
    if (!initialJobId) return;
    currentJobIdRef.current = initialJobId;

    if (isTauri()) {
      // 1. Check if nativePipeline has an active in-memory session
      const active = nativePipeline.getSession(initialJobId);
      if (active) {
        const allNotes = active.notebook?.chapters?.flatMap(c => c.topics) || [];
        setState({
          status: active.status,
          currentStep: active.currentStep,
          steps: active.steps,
          videoCount: active.videoSources.length,
          videoInfo: active.videoSources[0],
          index: active.index as any,
          notes: active.notebook ? {
            videoId: active.notebook.metadata?.sourceVideos?.[0]?.id || '',
            notebookId: active.notebook.id,
            title: active.notebook.title,
            index: active.notebook.index.topics.map(t => ({ id: t.id, title: t.title, subtopics: t.subtopics.map(s => s.title) })),
            notes: allNotes as any,
            fullContent: allNotes.map(n => `## ${n.topicTitle}\n\n${n.content}`).join('\n\n---\n\n'),
          } : undefined,
          error: active.error,
        });
        setLogs([...active.logs]);
      } else {
        // 2. Not in memory, try loading from SQLite
        api.getJobStatus(initialJobId).then(job => {
          handleJobUpdate(job);
        }).catch(err => {
          console.error('Failed to load job from SQLite:', err);
          setState(prev => ({
            ...prev,
            status: 'error',
            error: `Unable to locate job: ${initialJobId}`,
          }));
        });
      }

      // 3. Subscribe to live pipeline events
      const unsubscribe = nativePipeline.subscribe(initialJobId, {
        onStepChange: (stepIndex, status, details) => {
          setState(prev => {
            const nextSteps = prev.steps.map((s, i) =>
              i === stepIndex ? { ...s, status, details } : s
            );
            return { ...prev, currentStep: stepIndex, steps: nextSteps };
          });
        },
        onStatusChange: (status) => {
          setState(prev => ({ ...prev, status }));
        },
        onLog: (msg, type) => {
          addLog(msg, type);
        },
        onAwaitingApproval: (index) => {
          setState(prev => ({
            ...prev,
            status: 'awaiting-approval',
            index: index as any,
          }));
        },
        onNoteDelta: (topicId, delta) => {
          setState(prev => {
            if (!prev.notes) {
              const dummyNotes: VideoNotes = {
                videoId: prev.videoInfo?.id || 'pending',
                title: prev.videoInfo?.title || 'Generating Notes...',
                index: prev.topicIndex || [],
                notes: [],
                fullContent: '',
              };
              prev = { ...prev, notes: dummyNotes };
            }

            const existingNoteIdx = prev.notes!.notes.findIndex(n => n.topicId === topicId);
            const updatedNotesList = [...prev.notes!.notes];

            if (existingNoteIdx >= 0) {
              const note = updatedNotesList[existingNoteIdx];
              updatedNotesList[existingNoteIdx] = {
                ...note,
                content: (note.content || '') + delta,
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
                title: 'Generating...',
              } as any);
            }

            return {
              ...prev,
              notes: {
                ...prev.notes!,
                notes: updatedNotesList,
                fullContent: updatedNotesList.map(n => `## ${n.title || n.topicTitle}\n\n${n.content}`).join('\n\n---\n\n'),
              },
            };
          });
        },
        onComplete: (notebook) => {
          const allNotes = notebook.chapters.flatMap(c => c.topics);
          setState(prev => ({
            ...prev,
            status: 'complete',
            currentStep: 4,
            steps: prev.steps.map(s => ({ ...s, status: 'complete' })),
            notes: {
              videoId: notebook.metadata?.sourceVideos?.[0]?.id || '',
              notebookId: notebook.id,
              title: notebook.title,
              index: notebook.index.topics.map(t => ({ id: t.id, title: t.title, subtopics: t.subtopics.map(s => s.title) })),
              notes: allNotes as any,
              fullContent: allNotes.map(n => `## ${n.topicTitle}\n\n${n.content}`).join('\n\n---\n\n'),
            },
          }));
        },
        onError: (err) => {
          setState(prev => ({
            ...prev,
            status: 'error',
            error: err,
            steps: prev.steps.map(s => s.status === 'active' ? { ...s, status: 'error' } : s),
          }));
        },
      });

      return () => {
        unsubscribe();
      };
    } else {
      // Legacy Web fallback with SSE
      api.getJobStatus(initialJobId).then(job => {
        handleJobUpdate(job);
        connectToStream(initialJobId);
      }).catch(err => {
        console.error('Failed to sync job:', err);
      });
    }
  }, [initialJobId, handleJobUpdate, connectToStream, addLog]);

  const startProcessing = useCallback(async (url: string, userNotes?: string, creativityLevel?: number, generationMode?: 'topical' | 'chronological') => {
    try {
      const jobId = `job-${Date.now()}`;
      currentJobIdRef.current = jobId;

      if (isTauri()) {
        // Kick off pipeline in background
        nativePipeline.start(
          jobId,
          url,
          userNotes,
          creativityLevel,
          generationMode
        ).catch(err => {
          console.error('Pipeline error:', err);
        });

        return jobId;
      }

      const response = await api.startProcessing(url, userNotes, creativityLevel, generationMode);
      const serverJobId = response.jobId;
      currentJobIdRef.current = serverJobId;
      connectToStream(serverJobId);
      return serverJobId;
    } catch (error) {
      console.error('Error starting processing:', error);
      setState(prev => ({
        ...prev,
        status: 'idle',
        steps: PIPELINE_STEPS.map(s => ({ ...s, status: 'error' })),
      }));
    }
  }, [connectToStream]);

  const approveIndex = useCallback(async (updatedIndex: any) => {
    const jobId = currentJobIdRef.current;
    if (!jobId) return;

    try {
      if (isTauri()) {
        setState(prev => ({ ...prev, status: 'generating' }));
        const notebook = await nativePipeline.approveAndContinue(jobId, updatedIndex);
        const allNotes = notebook.chapters.flatMap(c => c.topics);
        setState(prev => ({
          ...prev,
          status: 'complete',
          currentStep: 4,
          steps: prev.steps.map(s => ({ ...s, status: 'complete' })),
          notes: {
            videoId: notebook.metadata?.sourceVideos?.[0]?.id || '',
            notebookId: notebook.id,
            title: notebook.title,
            index: notebook.index.topics.map(t => ({ id: t.id, title: t.title, subtopics: t.subtopics.map(s => s.title) })),
            notes: allNotes as any,
            fullContent: allNotes.map(n => `## ${n.topicTitle}\n\n${n.content}`).join('\n\n---\n\n'),
          },
        }));
        return;
      }

      await api.approveIndex(jobId, updatedIndex);
      setState(prev => ({
        ...prev,
        status: 'generating',
        index: updatedIndex,
      }));

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
      steps: PIPELINE_STEPS.map(s => ({ ...s, status: 'pending', progress: undefined })),
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
