import { useState, useCallback, useRef } from 'react';
import { ProcessingState, ProcessingStep, VideoNotes, TopicIndex } from '@/types';
import { api, JobStatus } from '@/services/api';

const initialSteps: ProcessingStep[] = [
  { id: 'extract', label: 'Extracting Transcripts', description: 'Fetching video transcripts from YouTube', status: 'pending' },
  { id: 'analyze', label: 'Analyzing Content', description: 'Analyzing transcript content and structure', status: 'pending' },
  { id: 'index', label: 'Generating Index', description: 'Creating unified topic index', status: 'pending' },
  { id: 'notes', label: 'Generating Notes', description: 'Writing detailed notes for each topic', status: 'pending' },
  { id: 'assemble', label: 'Assembling Notebook', description: 'Compiling final notebook', status: 'pending' },
];

export const useProcessing = () => {
  const [state, setState] = useState<ProcessingState>({
    status: 'idle',
    currentStep: 0,
    steps: initialSteps,
  });
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      console.log('Polling job status for:', jobId);
      const jobStatus: JobStatus = await api.getJobStatus(jobId);
      console.log('Job status received:', jobStatus);
      
      // Update steps based on backend status
      const updatedSteps = jobStatus.steps || initialSteps;
      
      setState(prev => ({
        ...prev,
        status: jobStatus.status as any,
        currentStep: jobStatus.currentStep,
        steps: updatedSteps,
        videoInfo: jobStatus.videoInfo,
      }));

      // If job is complete, stop polling and set final results
      if (jobStatus.status === 'complete' && jobStatus.notebook) {
        console.log('Job complete! Notebook:', jobStatus.notebook);
        
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Convert notebook to notes format
        const topicIndex: TopicIndex[] = jobStatus.notebook.index?.topics?.map((topic: any) => ({
          id: topic.id,
          title: topic.title,
          subtopics: topic.subtopics?.map((st: any) => st.title) || [],
        })) || [];

        // Extract all topic notes from chapters
        const allTopicNotes: any[] = [];
        if (jobStatus.notebook.chapters) {
          jobStatus.notebook.chapters.forEach((chapter: any) => {
            if (chapter.topics) {
              allTopicNotes.push(...chapter.topics);
            }
          });
        }

        console.log('Extracted topic notes:', allTopicNotes);

        // Convert to frontend format
        const notes: VideoNotes = {
          videoId: jobStatus.videoInfo?.id || 'unknown',
          title: jobStatus.notebook.title,
          index: topicIndex,
          notes: allTopicNotes.map((note: any) => ({
            topicId: note.topicId,
            title: note.topicTitle,
            content: note.sections?.map((s: any) => s.content).join('\n\n') || note.summary || '',
          })),
          fullContent: allTopicNotes.map((note: any) => {
            const sections = note.sections?.map((s: any) => s.content).join('\n\n') || '';
            return `# ${note.topicTitle}\n\n${sections}`;
          }).join('\n\n---\n\n'),
        };

        console.log('Converted notes for frontend:', notes);

        setState(prev => ({
          ...prev,
          status: 'complete',
          topicIndex,
          notes,
        }));
      }
      
      // If job failed, stop polling
      if (jobStatus.status === 'error') {
        console.error('Job failed:', jobStatus.error);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error polling job status:', error);
    }
  }, []);

  const startProcessing = useCallback(async (url: string) => {
    console.log('Starting processing for URL:', url);
    
    try {
      // Reset state
      setState({
        status: 'extracting',
        currentStep: 0,
        steps: initialSteps.map((s, i) => ({ 
          ...s, 
          status: i === 0 ? 'active' : 'pending',
        })),
      });

      // Start processing job
      const response = await api.startProcessing(url);
      console.log('Processing started:', response);
      
      const jobId = response.jobId;

      // Start polling for status updates
      pollingIntervalRef.current = setInterval(() => {
        pollJobStatus(jobId);
      }, 2000); // Poll every 2 seconds

      // Do initial poll immediately
      pollJobStatus(jobId);
      
    } catch (error) {
      console.error('Error starting processing:', error);
      setState(prev => ({
        ...prev,
        status: 'idle',
        steps: initialSteps.map(s => ({ ...s, status: 'error' })),
      }));
    }
  }, [pollJobStatus]);

  const reset = useCallback(() => {
    console.log('Resetting processing state');
    
    // Clear polling interval if active
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setState({
      status: 'idle',
      currentStep: 0,
      steps: initialSteps.map(s => ({ ...s, status: 'pending', progress: undefined })),
    });
  }, []);

  return {
    state,
    startProcessing,
    reset,
  };
};
