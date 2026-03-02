import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Notebook, VideoNotes, TopicIndex, TopicNotes } from '@/types';
import { NotebookShell } from '@/components/notebook/NotebookShell';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotebookView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: notebook, isLoading, error } = useQuery({
    queryKey: ['notebook', id],
    queryFn: () => api.getNotebook(id!),
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading notebook...</p>
      </div>
    );
  }

  if (error || !notebook) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-destructive">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>Failed to load notebook. It may not exist or has been deleted.</p>
        <Button variant="outline" onClick={() => navigate('/library')} className="mt-4">
          Back to Library
        </Button>
      </div>
    );
  }

  // Map persisted Notebook to the VideoNotes format expected by NotebookShell
  const videoNotes: VideoNotes = {
    videoId: notebook.id,
    title: notebook.title,
    index: notebook.index.topics.map(t => ({
      id: t.id,
      title: t.title,
      subtopics: t.subtopics.map(st => st.title)
    }) as TopicIndex),
    notes: notebook.chapters.flatMap(c => c.topics).map(topic => ({
      ...topic,
      // Ensure content is populated for RunningNotesViewer
      content: topic.content || topicToMarkdown(topic)
    })),
    fullContent: notebookToMarkdown(notebook),
    mindMaps: notebook.mindMaps,
    quiz: notebook.quiz,
    interviewQA: notebook.interviewQA
  };

  return (
    <div className="w-full">
      <NotebookShell
        notes={videoNotes}
        onReset={() => navigate('/library')}
      />
    </div>
  );
};

// Helper to convert a single TopicNotes to markdown
const topicToMarkdown = (topic: TopicNotes): string => {
  let md = '';

  topic.sections.forEach(section => {
    if (section.type === 'heading') {
      md += `${'#'.repeat((section.level || 3) + 1)} ${section.content}\n\n`;
    } else if (section.type === 'code') {
      md += '```' + (section.codeSnippet?.language || '') + '\n';
      md += section.codeSnippet?.code + '\n';
      md += '```\n\n';
    } else if (section.type === 'bullets') {
      section.items?.forEach(item => md += `- ${item}\n`);
      md += '\n';
    } else if (section.type === 'numbered') {
      section.items?.forEach((item, i) => md += `${i + 1}. ${item}\n`);
      md += '\n';
    } else if (section.type === 'quote') {
      md += `> ${section.content}\n\n`;
    } else if (section.type === 'special') {
      const type = section.specialNote?.type || 'info';
      const icon = type === 'warning' ? '⚠️' : type === 'tip' ? '💡' : 'ℹ️';
      md += `> **${icon} ${type.toUpperCase()}**: ${section.specialNote?.content || section.content}\n\n`;
    } else {
      md += `${section.content}\n\n`;
    }
  });

  if (topic.keyTakeaways && topic.keyTakeaways.length > 0) {
    md += `#### Key Takeaways\n`;
    topic.keyTakeaways.forEach(takeaway => {
      md += `- ✅ ${takeaway}\n`;
    });
    md += `\n`;
  }

  return md;
};

// Internal helper to generate the full markdown string for download/RAG
const notebookToMarkdown = (notebook: Notebook): string => {
  let md = `# ${notebook.title}\n\n`;
  if (notebook.description) {
    md += `> ${notebook.description}\n\n`;
  }

  md += `*Generated on ${new Date(notebook.createdAt).toLocaleDateString()} • ${notebook.metadata.totalTopics} Topics • ${notebook.metadata.estimatedReadTime} min read*\n\n`;
  md += `---\n\n`;

  // Table of Contents
  md += `## Table of Contents\n\n`;
  notebook.chapters.forEach((chapter, i) => {
    md += `${i + 1}. [${chapter.title}](#${slugify(chapter.title)})\n`;
    chapter.topics.forEach(topic => {
      md += `   - [${topic.topicTitle}](#${slugify(topic.topicTitle)})\n`;
    });
  });
  md += `\n---\n\n`;

  notebook.chapters.forEach(chapter => {
    md += `## ${chapter.title}\n\n`;

    chapter.topics.forEach(topic => {
      md += `### ${topic.topicTitle}\n\n`;

      if (topic.summary) {
        md += `**Summary**: ${topic.summary}\n\n`;
      }

      md += topicToMarkdown(topic);
      md += `---\n\n`;
    });
  });

  return md;
};

const slugify = (text: string) => {
  return text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
};


export default NotebookView;
