import { Copy, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface NotesViewerProps {
  content: string;
  title?: string;
}

const NotesViewer = ({ content, title }: NotesViewerProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'notes'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Simple markdown to HTML conversion
  const renderMarkdown = (md: string) => {
    return md
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-medium mt-4 mb-2 text-foreground">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-semibold mt-6 mb-3 text-foreground">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-2xl font-bold mt-8 mb-4 text-foreground">{line.slice(2)}</h1>;
        }
        // List items
        if (line.startsWith('- ')) {
          return <li key={i} className="ml-4 mb-1 text-foreground/90">{line.slice(2)}</li>;
        }
        // Code blocks
        if (line.startsWith('```')) {
          return null;
        }
        // Empty lines
        if (line.trim() === '') {
          return <br key={i} />;
        }
        // Regular paragraphs
        return <p key={i} className="mb-2 text-foreground/90 leading-relaxed">{line}</p>;
      });
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">
          {title || 'Generated Notes'}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="markdown-content max-w-none">
          {renderMarkdown(content)}
        </div>
      </div>
    </div>
  );
};

export default NotesViewer;
