import { useState, useCallback } from 'react';
import { ProcessingState, ProcessingStep, VideoNotes, TopicIndex } from '@/types';

const initialSteps: ProcessingStep[] = [
  { id: 'extract', label: 'Extracting Transcript', description: 'Fetching video transcript from YouTube', status: 'pending' },
  { id: 'index', label: 'Creating Topic Index', description: 'Analyzing content structure', status: 'pending' },
  { id: 'notes', label: 'Generating Notes', description: 'Creating topic-wise detailed notes', status: 'pending' },
  { id: 'assemble', label: 'Assembling Book', description: 'Merging into final document', status: 'pending' },
];

// Mock data for demonstration
const mockTopicIndex: TopicIndex[] = [
  { id: '1', title: 'Introduction', subtopics: ['Overview', 'Prerequisites'] },
  { id: '2', title: 'Core Concepts', subtopics: ['Fundamentals', 'Key Principles'] },
  { id: '3', title: 'Architecture Deep Dive', subtopics: ['Components', 'Data Flow'] },
  { id: '4', title: 'Implementation Guide', subtopics: ['Setup', 'Configuration'] },
  { id: '5', title: 'Best Practices', subtopics: ['Patterns', 'Anti-patterns'] },
  { id: '6', title: 'Common Pitfalls', subtopics: ['Debugging Tips'] },
  { id: '7', title: 'Summary & Next Steps' },
];

const mockNotes: VideoNotes = {
  videoId: 'demo',
  title: 'Complete Guide to Modern Web Development',
  index: mockTopicIndex,
  notes: mockTopicIndex.map(topic => ({
    topicId: topic.id,
    title: topic.title,
    content: `# ${topic.title}

## Overview
This section covers the essential aspects of ${topic.title.toLowerCase()}. Understanding these concepts is crucial for building robust applications.

## Key Points
- First important point about ${topic.title.toLowerCase()}
- Second key insight that developers should understand
- Third concept that ties everything together

## Code Example
\`\`\`javascript
// Example implementation
const example = () => {
  console.log("${topic.title}");
};
\`\`\`

## Common Mistakes to Avoid
- Not understanding the fundamentals before moving forward
- Skipping important configuration steps
- Ignoring best practices

## Takeaways
${topic.title} is a fundamental building block that you'll use throughout your development journey. Make sure to practice these concepts with real projects.
`,
  })),
  fullContent: `# Complete Guide to Modern Web Development

${mockTopicIndex.map((topic, i) => `
## ${i + 1}. ${topic.title}

This chapter covers ${topic.title.toLowerCase()} in detail. We'll explore the key concepts and practical applications.

### Key Concepts
- Understanding the fundamentals
- Applying best practices
- Avoiding common pitfalls

### Summary
${topic.title} forms an essential part of the learning journey. Practice these concepts to build mastery.
`).join('\n')}

---

## Conclusion

This comprehensive guide has covered all the essential topics for modern web development. Continue practicing and building projects to solidify your understanding.
`,
};

export const useProcessing = () => {
  const [state, setState] = useState<ProcessingState>({
    status: 'idle',
    currentStep: 0,
    steps: initialSteps,
  });

  const simulateStep = (stepIndex: number): Promise<void> => {
    return new Promise((resolve) => {
      const stepDuration = 1500 + Math.random() * 1000;
      let progress = 0;
      
      const interval = setInterval(() => {
        progress += 10;
        setState(prev => ({
          ...prev,
          steps: prev.steps.map((s, i) => 
            i === stepIndex ? { ...s, progress: Math.min(progress, 100) } : s
          ),
        }));
        
        if (progress >= 100) {
          clearInterval(interval);
          resolve();
        }
      }, stepDuration / 10);
    });
  };

  const startProcessing = useCallback(async (url: string) => {
    // Reset and start
    setState({
      status: 'extracting',
      currentStep: 0,
      steps: initialSteps.map((s, i) => ({ 
        ...s, 
        status: i === 0 ? 'active' : 'pending',
        progress: undefined 
      })),
      videoInfo: {
        id: 'demo',
        title: 'Complete Guide to Modern Web Development',
        duration: '45:32',
      },
    });

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

      await simulateStep(i);

      // Mark step as complete
      setState(prev => ({
        ...prev,
        steps: prev.steps.map((s, idx) => ({
          ...s,
          status: idx <= i ? 'complete' : s.status,
          progress: undefined,
        })),
      }));
    }

    // Complete
    setState(prev => ({
      ...prev,
      status: 'complete',
      topicIndex: mockTopicIndex,
      notes: mockNotes,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      currentStep: 0,
      steps: initialSteps,
    });
  }, []);

  return {
    state,
    startProcessing,
    reset,
  };
};
