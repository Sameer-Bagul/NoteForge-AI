import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Notebook, VideoNotes, TopicIndex, TopicNotes } from '@/types';
import { NotebookShell } from '@/components/notebook/NotebookShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotebookViewContent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: notebook, isLoading, error } = useQuery({
    queryKey: ['notebook', id],
    queryFn: () => api.getNotebook(id!),
    enabled: !!id,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-mono">Loading notebook from SQLite vault...</p>
      </div>
    );
  }

  if (error || !notebook) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 max-w-sm mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Notebook Not Found</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error instanceof Error ? error.message : 'Unable to locate notebook in local database.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/library')} className="mt-2 text-xs h-8">
          Back to Library
        </Button>
      </div>
    );
  }

  // Extract real YouTube Video ID from notebook metadata/sources
  const sourceVideoId =
    notebook.metadata?.sourceVideos?.[0]?.id ||
    notebook.index?.topics?.[0]?.videoSources?.[0] ||
    (notebook.chapters?.[0]?.topics?.[0]?.videoSources?.[0] as any)?.videoId ||
    '';

  // Map persisted Notebook to the VideoNotes format expected by NotebookShell
  const videoNotes: VideoNotes = {
    videoId: sourceVideoId,
    notebookId: notebook.id,
    title: notebook.title,
    index: (notebook.index?.topics || []).map((t) => ({
      id: t.id,
      title: t.title,
      subtopics: (t.subtopics || []).map((st: any) => (typeof st === 'string' ? st : (st?.title || ''))),
      startTime: t.startTime,
      endTime: t.endTime,
      timeDisplay: t.timeDisplay,
    }) as TopicIndex),
    notes: (notebook.chapters || []).flatMap((c) => c.topics || []).map((topic) => ({
      ...topic,
      content: topic.content || topicToMarkdown(topic),
    })),
    fullContent: (notebook as any).fullContent || notebookToMarkdown(notebook),
    mindMaps: notebook.mindMaps,
    quiz: notebook.quiz,
    interviewQA: notebook.interviewQA,
    isFavorite: notebook.isFavorite,
    isArchived: notebook.isArchived,
    tags: notebook.tags,
  };

  return (
    <div className="w-full h-full flex-1 flex flex-col overflow-hidden">
      <NotebookShell
        notes={videoNotes}
        onReset={() => navigate('/library')}
      />
    </div>
  );
};

const NotebookView = () => {
  const navigate = useNavigate();
  return (
    <ErrorBoundary
      fallbackTitle="Could not display notebook"
      onReset={() => navigate('/library')}
    >
      <NotebookViewContent />
    </ErrorBoundary>
  );
};

// Helper to convert a single TopicNotes to markdown
const topicToMarkdown = (topic: TopicNotes): string => {
  let md = '';

  (topic.sections || []).forEach((section) => {
    if (section.type === 'heading') {
      md += `${'#'.repeat((section.level || 3) + 1)} ${section.content}\n\n`;
    } else if (section.type === 'code') {
      md += '```' + (section.codeSnippet?.language || '') + '\n';
      md += section.codeSnippet?.code + '\n';
      md += '```\n\n';
    } else if (section.type === 'bullets') {
      section.items?.forEach((item) => (md += `- ${item}\n`));
      md += '\n';
    } else if (section.type === 'numbered') {
      section.items?.forEach((item, i) => (md += `${i + 1}. ${item}\n`));
      md += '\n';
    } else if (section.type === 'quote') {
      md += `> ${section.content}\n\n`;
    } else if (section.type === 'special') {
      const type = section.specialNote?.type || 'info';
      md += `> **${type.toUpperCase()}:** ${section.specialNote?.content || section.content}\n\n`;
    } else {
      md += `${section.content}\n\n`;
    }
  });

  if (topic.keyTakeaways && topic.keyTakeaways.length > 0) {
    md += `#### Key Takeaways\n`;
    topic.keyTakeaways.forEach((takeaway) => {
      md += `- ${takeaway}\n`;
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

  md += `*Generated on ${new Date(notebook.createdAt).toLocaleDateString()} • ${notebook.metadata?.totalTopics || 0} Topics • ${notebook.metadata?.estimatedReadTime || 5} min read*\n\n`;
  md += `---\n\n`;

  // Table of Contents
  md += `## Table of Contents\n\n`;
  (notebook.chapters || []).forEach((chapter, i) => {
    md += `${i + 1}. [${chapter.title}](#${slugify(chapter.title)})\n`;
    (chapter.topics || []).forEach((topic) => {
      md += `   - [${topic.topicTitle}](#${slugify(topic.topicTitle)})\n`;
    });
  });
  md += `\n---\n\n`;

  (notebook.chapters || []).forEach((chapter) => {
    md += `## ${chapter.title}\n\n`;

    (chapter.topics || []).forEach((topic) => {
      md += `### ${topic.topicTitle}\n\n`;

      if (topic.summary) {
        md += `**Summary**: ${topic.summary}\n\n`;
      }

      md += topic.content || topicToMarkdown(topic);
      md += `\n\n---\n\n`;
    });
  });

  return md;
};

const slugify = (text: string) => {
  return text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
};

export default NotebookView;
