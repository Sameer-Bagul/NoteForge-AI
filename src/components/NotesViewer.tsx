import { Copy, Download, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface NotesViewerProps {
  content: string;
  title?: string;
}

const NotesViewer = ({ content, title }: NotesViewerProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Notes copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title?.replace(/[^a-z0-9]/gi, '_') || 'notes'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded!",
      description: "Notes saved as Markdown file.",
    });
  };

  // Enhanced markdown to HTML conversion
  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    const elements: JSX.Element[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeLanguage = '';
    let inTable = false;
    let tableRows: string[][] = [];
    let listItems: JSX.Element[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={`list-${elements.length}`} className={listType === 'ul' ? 'list-disc pl-6 mb-4 space-y-1' : 'list-decimal pl-6 mb-4 space-y-1'}>
            {listItems}
          </ListTag>
        );
        listItems = [];
        listType = null;
      }
    };

    const flushTable = () => {
      if (tableRows.length > 0) {
        elements.push(
          <div key={`table-${elements.length}`} className="overflow-x-auto mb-4">
            <table className="min-w-full border border-border rounded-lg overflow-hidden">
              <thead className="bg-secondary">
                <tr>
                  {tableRows[0]?.map((cell, i) => (
                    <th key={i} className="px-4 py-2 text-left text-sm font-medium text-foreground border-b border-border">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(2).map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-card' : 'bg-secondary/30'}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-2 text-sm text-foreground/90 border-b border-border">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    lines.forEach((line, i) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${i}`} className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 text-sm">
              <code className="text-foreground/90 font-mono">{codeContent.join('\n')}</code>
            </pre>
          );
          codeContent = [];
          inCodeBlock = false;
        } else {
          flushList();
          codeLanguage = line.slice(3);
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      // Tables
      if (line.includes('|') && line.trim().startsWith('|')) {
        flushList();
        if (!inTable) inTable = true;
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        tableRows.push(cells);
        return;
      } else if (inTable) {
        flushTable();
      }

      // Headers
      if (line.startsWith('### ')) {
        flushList();
        elements.push(<h3 key={i} className="text-lg font-semibold mt-6 mb-3 text-foreground">{line.slice(4)}</h3>);
        return;
      }
      if (line.startsWith('## ')) {
        flushList();
        elements.push(<h2 key={i} className="text-xl font-semibold mt-8 mb-4 text-foreground border-b border-border pb-2">{line.slice(3)}</h2>);
        return;
      }
      if (line.startsWith('# ')) {
        flushList();
        elements.push(<h1 key={i} className="text-2xl font-bold mt-8 mb-4 text-foreground">{line.slice(2)}</h1>);
        return;
      }

      // Horizontal rule
      if (line.trim() === '---') {
        flushList();
        elements.push(<hr key={i} className="my-6 border-border" />);
        return;
      }

      // Unordered list
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        const text = line.slice(2);
        listItems.push(
          <li key={`li-${i}`} className="text-foreground/90">
            {renderInlineMarkdown(text)}
          </li>
        );
        return;
      }

      // Ordered list
      const orderedMatch = line.match(/^(\d+)\.\s(.+)/);
      if (orderedMatch) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listItems.push(
          <li key={`li-${i}`} className="text-foreground/90">
            {renderInlineMarkdown(orderedMatch[2])}
          </li>
        );
        return;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        flushList();
        elements.push(
          <blockquote key={i} className="border-l-4 border-primary/40 pl-4 py-1 my-4 italic text-muted-foreground bg-secondary/30 rounded-r-lg">
            {line.slice(2)}
          </blockquote>
        );
        return;
      }

      // Checkbox
      if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
        flushList();
        const checked = line.startsWith('- [x] ');
        const text = line.slice(6);
        elements.push(
          <div key={i} className="flex items-center gap-2 mb-1">
            <input type="checkbox" checked={checked} readOnly className="rounded" />
            <span className={checked ? 'line-through text-muted-foreground' : 'text-foreground/90'}>{text}</span>
          </div>
        );
        return;
      }

      // Empty lines
      if (line.trim() === '') {
        flushList();
        return;
      }

      // Regular paragraphs
      flushList();
      elements.push(
        <p key={i} className="mb-3 text-foreground/90 leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
    });

    flushList();
    flushTable();

    return elements;
  };

  // Render inline markdown (bold, italic, code, links)
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    // Process inline code first
    const parts = text.split(/(`[^`]+`)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary">
            {part.slice(1, -1)}
          </code>
        );
      }
      
      // Process bold
      let processed: React.ReactNode = part;
      if (part.includes('**')) {
        const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
        processed = boldParts.map((bp, j) => {
          if (bp.startsWith('**') && bp.endsWith('**')) {
            return <strong key={j} className="font-semibold text-foreground">{bp.slice(2, -2)}</strong>;
          }
          return bp;
        });
      }
      
      return <span key={i}>{processed}</span>;
    });
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground truncate">
            {title || 'Generated Notes'}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="w-4 h-4 text-success" />
                <span className="hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <article className="max-w-none">
          {renderMarkdown(content)}
        </article>
      </div>
    </div>
  );
};

export default NotesViewer;
