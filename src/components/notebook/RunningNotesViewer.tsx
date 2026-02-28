import { useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RunningNotesViewerProps {
    content: string;
    title?: string;
    className?: string;
    showToolbar?: boolean;
}

// ─── Code Block Component ──────────────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const lang = language || 'text';

    return (
        <div className="relative my-5 rounded-xl overflow-hidden border border-border/60 shadow-sm">
            {/* Code block header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e2e] border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    {lang !== 'text' && (
                        <span className="text-xs text-white/50 font-mono ml-2 uppercase tracking-wider">
                            {lang}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors"
                >
                    {copied ? (
                        <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied!</span></>
                    ) : (
                        <><Copy className="w-3.5 h-3.5" />Copy</>
                    )}
                </button>
            </div>
            <SyntaxHighlighter
                language={lang === 'text' ? 'plaintext' : lang}
                style={oneDark}
                customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: '0.8rem',
                    background: '#1a1b26',
                    padding: '1rem 1.25rem',
                    lineHeight: '1.6',
                }}
                showLineNumbers={code.split('\n').length > 4}
                wrapLines
            >
                {code.trim()}
            </SyntaxHighlighter>
        </div>
    );
}

// ─── Callout Component ─────────────────────────────────────────────────────────

function Callout({ text, raw }: { text: string; raw: string }) {
    // Detect callout type from emoji/keyword
    const tipMatch = raw.match(/\*\*(💡|Tip)[:\s*]/i);
    const warnMatch = raw.match(/\*\*(⚠️|Warning)[:\s*]/i);
    const importantMatch = raw.match(/\*\*(📌|Important)[:\s*]/i);

    if (tipMatch) {
        return (
            <div className="my-4 flex gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-lg shrink-0">💡</span>
                <p className="text-sm text-emerald-100/90 leading-relaxed">{text.replace(/\*\*(💡 Tip:|Tip:?)\*\*/i, '').trim()}</p>
            </div>
        );
    }
    if (warnMatch) {
        return (
            <div className="my-4 flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-lg shrink-0">⚠️</span>
                <p className="text-sm text-amber-100/90 leading-relaxed">{text.replace(/\*\*(⚠️ Warning:|Warning:?)\*\*/i, '').trim()}</p>
            </div>
        );
    }
    if (importantMatch) {
        return (
            <div className="my-4 flex gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <span className="text-lg shrink-0">📌</span>
                <p className="text-sm text-blue-100/90 leading-relaxed">{text.replace(/\*\*(📌 Important:|Important:?)\*\*/i, '').trim()}</p>
            </div>
        );
    }

    // Regular blockquote
    return (
        <blockquote className="my-4 border-l-4 border-primary/40 pl-4 py-1 italic text-muted-foreground bg-secondary/20 rounded-r-lg">
            <InlineText text={text} />
        </blockquote>
    );
}

// ─── Inline Text Renderer ──────────────────────────────────────────────────────

function InlineText({ text }: { text: string }) {
    // Process: inline code → bold → italic → plain
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g);

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('`') && part.endsWith('`')) {
                    return (
                        <code key={i} className="bg-primary/15 text-primary px-1.5 py-0.5 rounded text-[0.8em] font-mono">
                            {part.slice(1, -1)}
                        </code>
                    );
                }
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
                }
                if ((part.startsWith('_') && part.endsWith('_')) || (part.startsWith('*') && part.endsWith('*'))) {
                    return <em key={i} className="italic">{part.slice(1, -1)}</em>;
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
}

// ─── Main Markdown Renderer ────────────────────────────────────────────────────

function renderNotebook(md: string): React.ReactNode[] {
    const lines = md.split('\n');
    const elements: React.ReactNode[] = [];
    let inCode = false;
    let codeLines: string[] = [];
    let codeLang = '';
    let inMermaid = false;
    let mermaidLines: string[] = [];
    let listItems: { ordered: boolean; text: string }[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let keyIndex = 0;

    const key = () => keyIndex++;

    const flushList = () => {
        if (!listItems.length) return;
        const isOrdered = listItems[0].ordered;
        const El = isOrdered ? 'ol' : 'ul';
        elements.push(
            <El key={key()} className={cn(isOrdered ? 'list-decimal' : 'list-disc', 'pl-6 my-3 space-y-1.5')}>
                {listItems.map((item, i) => (
                    <li key={i} className="text-foreground/90 leading-relaxed text-[0.95rem]">
                        <InlineText text={item.text} />
                    </li>
                ))}
            </El>
        );
        listItems = [];
    };

    const flushTable = () => {
        if (!tableRows.length) return;
        elements.push(
            <div key={key()} className="overflow-x-auto my-5">
                <table className="min-w-full border border-border/50 rounded-xl overflow-hidden text-sm">
                    <thead className="bg-secondary/70">
                        <tr>
                            {tableRows[0]?.map((cell, i) => (
                                <th key={i} className="px-4 py-2.5 text-left font-semibold text-foreground border-b border-border/50">
                                    <InlineText text={cell} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableRows.slice(2).map((row, ri) => (
                            <tr key={ri} className={ri % 2 === 0 ? 'bg-card' : 'bg-secondary/20'}>
                                {row.map((cell, ci) => (
                                    <td key={ci} className="px-4 py-2.5 text-foreground/80 border-b border-border/30">
                                        <InlineText text={cell} />
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
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Mermaid block
        if (line.startsWith('```mermaid')) {
            flushList(); flushTable();
            inMermaid = true; mermaidLines = [];
            continue;
        }
        if (inMermaid) {
            if (line === '```') {
                // Render as styled pre block (full mermaid rendering would need a library)
                elements.push(
                    <div key={key()} className="my-5 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/25 font-mono text-xs text-indigo-200/80 whitespace-pre">
                        <div className="flex items-center gap-2 mb-2 text-indigo-400 text-[10px] uppercase tracking-widest font-sans font-semibold">
                            <span>◈ Diagram</span>
                        </div>
                        {mermaidLines.join('\n')}
                    </div>
                );
                inMermaid = false;
            } else {
                mermaidLines.push(line);
            }
            continue;
        }

        // Code blocks
        if (line.startsWith('```')) {
            if (inCode) {
                flushList(); flushTable();
                elements.push(<CodeBlock key={key()} code={codeLines.join('\n')} language={codeLang} />);
                codeLines = []; inCode = false;
            } else {
                flushList(); flushTable();
                codeLang = line.slice(3).trim();
                inCode = true;
            }
            continue;
        }
        if (inCode) { codeLines.push(line); continue; }

        // Tables
        if (line.trim().startsWith('|') && line.includes('|')) {
            flushList();
            inTable = true;
            tableRows.push(line.split('|').slice(1, -1).map(c => c.trim()));
            continue;
        } else if (inTable) { flushTable(); }

        // Headings
        if (line.startsWith('# ')) {
            flushList(); flushTable();
            elements.push(
                <h1 key={key()} className="text-2xl font-bold mt-10 mb-4 text-foreground tracking-tight border-b-2 border-primary/30 pb-3">
                    <InlineText text={line.slice(2)} />
                </h1>
            );
            continue;
        }
        if (line.startsWith('## ')) {
            flushList(); flushTable();
            elements.push(
                <h2 key={key()} className="text-xl font-semibold mt-8 mb-3 text-foreground flex items-center gap-2">
                    <span className="w-1 h-6 bg-primary rounded-full shrink-0 inline-block" />
                    <InlineText text={line.slice(3)} />
                </h2>
            );
            continue;
        }
        if (line.startsWith('### ')) {
            flushList(); flushTable();
            elements.push(
                <h3 key={key()} className="text-base font-semibold mt-6 mb-2 text-foreground/90">
                    <InlineText text={line.slice(4)} />
                </h3>
            );
            continue;
        }
        if (line.startsWith('#### ')) {
            flushList(); flushTable();
            elements.push(
                <h4 key={key()} className="text-sm font-semibold mt-4 mb-1 text-muted-foreground uppercase tracking-wide">
                    <InlineText text={line.slice(5)} />
                </h4>
            );
            continue;
        }

        // HR
        if (line.trim() === '---') {
            flushList(); flushTable();
            elements.push(<hr key={key()} className="my-6 border-border/40" />);
            continue;
        }

        // Blockquotes / Callouts
        if (line.startsWith('> ')) {
            flushList(); flushTable();
            elements.push(<Callout key={key()} text={line.slice(2)} raw={line} />);
            continue;
        }

        // Unordered list
        if (/^[-*] /.test(line)) {
            flushTable();
            const orderedNow = false;
            if (listItems.length && listItems[0].ordered !== orderedNow) flushList();
            listItems.push({ ordered: false, text: line.slice(2) });
            continue;
        }

        // Ordered list
        const orderedMatch = line.match(/^(\d+)\. (.+)/);
        if (orderedMatch) {
            flushTable();
            if (listItems.length && !listItems[0].ordered) flushList();
            listItems.push({ ordered: true, text: orderedMatch[2] });
            continue;
        }

        // Empty line
        if (!line.trim()) {
            flushList(); flushTable();
            continue;
        }

        // Paragraph
        flushList(); flushTable();
        elements.push(
            <p key={key()} className="my-2.5 text-foreground/85 leading-[1.85] text-[0.97rem]">
                <InlineText text={line} />
            </p>
        );
    }

    flushList();
    flushTable();
    return elements;
}

// ─── Export Component ──────────────────────────────────────────────────────────

export function RunningNotesViewer({ content, title, className, showToolbar = true }: RunningNotesViewerProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        toast({ title: 'Copied!', description: 'Notes copied to clipboard.' });
        setTimeout(() => setCopied(false), 2000);
    }, [content]);

    const handleDownload = useCallback(() => {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title?.replace(/[^a-z0-9]/gi, '_') || 'notes'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: 'Downloaded!', description: 'Notes saved as Markdown.' });
    }, [content, title]);

    return (
        <div className={cn('flex flex-col h-full', className)}>
            {showToolbar && (
                <div className="flex items-center justify-end gap-1 mb-3 shrink-0">
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 gap-1.5 text-xs">
                        {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDownload} className="h-8 gap-1.5 text-xs">
                        <Download className="w-3.5 h-3.5" />Download
                    </Button>
                </div>
            )}

            {/* Notebook body */}
            <div className={cn(
                'flex-1 overflow-auto rounded-xl border border-border/60 bg-card shadow-sm',
                'relative',
            )}>
                {/* Left margin line — notebook aesthetic */}
                <div className="absolute left-[52px] top-0 bottom-0 w-px bg-red-500/15 pointer-events-none" />

                <article className="relative px-8 py-8 max-w-none prose-sm">
                    {/* Margin gutter */}
                    <div className="pl-10">
                        {renderNotebook(content)}
                    </div>
                </article>
            </div>
        </div>
    );
}

export default RunningNotesViewer;
