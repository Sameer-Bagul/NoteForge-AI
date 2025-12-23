import { useState, useCallback } from 'react';
import { ProcessingState, ProcessingStep, VideoNotes, TopicIndex } from '@/types';
import mockData from '@/data/mockData.json';

const initialSteps: ProcessingStep[] = [
  { id: 'extract', label: 'Extracting Transcript', description: 'Fetching video transcript from YouTube', status: 'pending' },
  { id: 'index', label: 'Creating Topic Index', description: 'Analyzing content structure with LLM', status: 'pending' },
  { id: 'notes', label: 'Generating Topic Notes', description: 'Creating detailed notes for each topic', status: 'pending' },
  { id: 'assemble', label: 'Assembling Final Book', description: 'Merging into complete documentation', status: 'pending' },
];

export const useProcessing = () => {
  const [state, setState] = useState<ProcessingState>({
    status: 'idle',
    currentStep: 0,
    steps: initialSteps,
  });

  const simulateStep = (stepIndex: number, duration: number = 2000): Promise<void> => {
    return new Promise((resolve) => {
      let progress = 0;
      const increment = 100 / (duration / 100);
      
      const interval = setInterval(() => {
        progress = Math.min(progress + increment, 100);
        setState(prev => ({
          ...prev,
          steps: prev.steps.map((s, i) => 
            i === stepIndex ? { ...s, progress: Math.round(progress) } : s
          ),
        }));
        
        if (progress >= 100) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  };

  const startProcessing = useCallback(async (url: string) => {
    // Extract video ID from URL for display purposes
    let videoId = 'unknown';
    try {
      const urlObj = new URL(url);
      videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || 'unknown';
    } catch {
      // Invalid URL, use default
    }

    // Reset and start with video info from mock data
    setState({
      status: 'extracting',
      currentStep: 0,
      steps: initialSteps.map((s, i) => ({ 
        ...s, 
        status: i === 0 ? 'active' : 'pending',
        progress: i === 0 ? 0 : undefined 
      })),
      videoInfo: {
        id: videoId,
        title: mockData.video.title,
        duration: mockData.video.duration,
        thumbnail: mockData.video.thumbnail,
      },
    });

    // Step durations for realistic feeling
    const stepDurations = [2500, 3000, 4000, 2000];

    // Simulate each step
    for (let i = 0; i < initialSteps.length; i++) {
      setState(prev => ({
        ...prev,
        currentStep: i,
        status: i === 0 ? 'extracting' : i === 1 ? 'indexing' : i === 2 ? 'generating' : 'assembling',
        steps: prev.steps.map((s, idx) => ({
          ...s,
          status: idx < i ? 'complete' : idx === i ? 'active' : 'pending',
          progress: idx === i ? 0 : undefined,
        })),
      }));

      await simulateStep(i, stepDurations[i]);

      // Mark step as complete
      setState(prev => ({
        ...prev,
        steps: prev.steps.map((s, idx) => ({
          ...s,
          status: idx <= i ? 'complete' : s.status,
          progress: undefined,
        })),
      }));

      // Small delay between steps
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Convert mock data to our types
    const topicIndex: TopicIndex[] = mockData.topicIndex.map(t => ({
      id: t.id,
      title: t.title,
      subtopics: t.subtopics,
    }));

    const notes: VideoNotes = {
      videoId: mockData.video.id,
      title: mockData.video.title,
      index: topicIndex,
      notes: mockData.topicNotes.map(n => ({
        topicId: n.topicId,
        title: n.title,
        content: n.content,
      })),
      fullContent: mockData.fullBook,
    };

    // Complete
    setState(prev => ({
      ...prev,
      status: 'complete',
      topicIndex,
      notes,
    }));
  }, []);

  const reset = useCallback(() => {
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
