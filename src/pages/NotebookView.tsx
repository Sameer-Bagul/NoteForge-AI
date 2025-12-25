import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/services/api';
import { Notebook } from '@/types';
import NotesViewer from '@/components/NotesViewer';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotebookView = () => {
  const { id } = useParams<{ id: string }>();
  
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
        <Link to="/library" className="mt-4">
          <Button variant="outline">Back to Library</Button>
        </Link>
      </div>
    );
  }

  const markdownContent = notebookToMarkdown(notebook);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col fade-in">
      <div className="mb-4 flex items-center gap-4">
        <Link to="/library">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{notebook.title}</h1>
          <p className="text-sm text-muted-foreground">{notebook.description}</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <NotesViewer content={markdownContent} title={notebook.title} />
      </div>
    </div>
  );
};

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
      
      md += `---\n\n`;
    });
  });
  
  return md;
};

const slugify = (text: string) => {
  return text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
};

export default NotebookView;
