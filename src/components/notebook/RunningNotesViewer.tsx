import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    Copy, Check, Download, Play, ArrowDown,
    ChevronLeft, ChevronRight, Clock, FileText,
    Lightbulb, AlertTriangle, Info, Terminal,
    Sparkles, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MermaidDiagram } from './MermaidDiagram';

interface RunningNotesViewerProps {
    content: string;
    title?: string;
    className?: string;
    showToolbar?: boolean;
    onSeek?: (seconds: number) => void;
    isStreaming?: boolean;
    streamingStatus?: string;
    chapterNumber?: number;
    totalChapters?: number;
    timeDisplay?: string;
    startTime?: number;
    onNextChapter?: () => void;
    onPrevChapter?: () => void;
    prevChapterTitle?: string;
    nextChapterTitle?: string;
    isFocusMode?: boolean;
    onToggleFocusMode?: () => void;
    isEnhanced?: boolean;
    enhancedWith?: string;
    onEnhance?: () => void;
    onRevert?: () => void;
}

// ─── Code Block Component (Un-slopped & Minimalist) ───────────────────────────

function CodeBlock({ code, language }: { code: string; language: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const lang = (language || 'text').toLowerCase();

    return (
        <div className="relative my-4 rounded-xl overflow-hidden border border-border/40 bg-[#0e1017] shadow-xs">
            {/* Minimalist Code Block Header */}
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-black/40 border-b border-white/5 select-none">
                <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-muted-foreground/60" />
                    <span className="text-[11px] font-mono text-muted-foreground/80 lowercase">
                        {lang !== 'text' ? lang : 'code'}
                    </span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors hover:bg-white/5"
                    title="Copy code"
                >
                    {copied ? (
                        <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>
            <SyntaxHighlighter
                language={lang === 'text' ? 'plaintext' : lang}
                style={oneDark}
                customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: '0.825rem',
                    background: 'transparent',
                    padding: '1rem 1.25rem',
                    lineHeight: '1.65',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
                codeTagProps={{
                    style: {
                        background: 'transparent',
                        fontFamily: 'inherit',
                    },
                }}
                lineNumberStyle={{
                    minWidth: '2.5em',
                    paddingRight: '1em',
                    color: 'rgba(255, 255, 255, 0.25)',
                    userSelect: 'none',
                    textAlign: 'right',
                }}
                showLineNumbers={code.trim().split('\n').length > 3}
            >
                {code.trim()}
            </SyntaxHighlighter>
        </div>
    );
}

// ─── Callout Component (Zero Emojis, Pure Semantic SVGs) ───────────────────────

function Callout({ text, raw, onSeek }: { text: string; raw: string; onSeek?: (seconds: number) => void }) {
    // Detect callout type without relying on raw emojis
    const tipMatch = raw.match(/\*\*(💡|Tip)[:\s*]/i);
    const warnMatch = raw.match(/\*\*(⚠️|Warning)[:\s*]/i);
    const importantMatch = raw.match(/\*\*(📌|Important|Note)[:\s*]/i);

    if (tipMatch) {
        return (
            <div className="my-4 flex items-start gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs text-foreground/90 leading-relaxed min-w-0">
                    <span className="font-mono font-semibold uppercase text-[10px] tracking-wider text-emerald-400 block">Tip</span>
                    <p><InlineText text={text.replace(/\*\*(💡 Tip:|Tip:?)\*\*/i, '').trim()} onSeek={onSeek} /></p>
                </div>
            </div>
        );
    }
    if (warnMatch) {
        return (
            <div className="my-4 flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs text-foreground/90 leading-relaxed min-w-0">
                    <span className="font-mono font-semibold uppercase text-[10px] tracking-wider text-amber-400 block">Warning</span>
                    <p><InlineText text={text.replace(/\*\*(⚠️ Warning:|Warning:?)\*\*/i, '').trim()} onSeek={onSeek} /></p>
                </div>
            </div>
        );
    }
    if (importantMatch) {
        return (
            <div className="my-4 flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs text-foreground/90 leading-relaxed min-w-0">
                    <span className="font-mono font-semibold uppercase text-[10px] tracking-wider text-blue-400 block">Note</span>
                    <p><InlineText text={text.replace(/\*\*(📌 Important:|Important:|📌 Note:|Note:?)\*\*/i, '').trim()} onSeek={onSeek} /></p>
                </div>
            </div>
        );
    }

    // Regular clean blockquote
    return (
        <blockquote className="my-4 border-l-2 border-primary/40 pl-4 py-1 text-xs sm:text-sm text-muted-foreground bg-secondary/15 rounded-r-lg">
            <InlineText text={text} onSeek={onSeek} />
        </blockquote>
    );
}

// ─── Inline Text Renderer ──────────────────────────────────────────────────────

function parseTimestampToSeconds(ts: string): number {
    const clean = ts.replace(/[[\]]/g, '').replace(/<[^>]*>/g, '').trim();
    const parts = clean.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

function InlineText({ text, onSeek }: { text: string; onSeek?: (seconds: number) => void }) {
    // 1. Strip raw HTML span tags wrapping timestamps
    let normalized = text
        .replace(/<span[^>]*style="[^"]*monospace[^"]*"[^>]*>(\d{1,2}:\d{2}(?::\d{2})?)<\/span>/gi, '$1')
        .replace(/<span[^>]*>(\d{1,2}:\d{2}(?::\d{2})?)<\/span>/gi, '$1')
        .replace(/&nbsp;/g, ' ');

    // 2. Normalize all bracketed timestamps: [[01:28]], [ [01:28] ], [ 01:28 ], [01:28] -> [01:28]
    normalized = normalized.replace(/\[+[\s[]*(\d{1,2}:\d{2}(?::\d{2})?)[\s\]]*\]+/g, '[$1]');

    const parts = normalized.split(/(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*|\[\d{1,2}:\d{2}(?::\d{2})?\])/g);

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('`') && part.endsWith('`')) {
                    return (
                        <code key={i} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[0.8em] font-mono">
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
                if (part.startsWith('[') && part.endsWith(']') && /^\[\d{1,2}:\d{2}(?::\d{2})?\]$/.test(part)) {
                    const secs = parseTimestampToSeconds(part);
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onSeek?.(secs)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-mono font-medium border border-primary/25 hover:border-primary/50 transition-all cursor-pointer align-baseline"
                            title={`Jump video to ${part.slice(1, -1)}`}
                        >
                            <Play className="w-2.5 h-2.5 fill-current opacity-80" />
                            <span>{part.slice(1, -1)}</span>
                        </button>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
}

// ─── Main Markdown Renderer ────────────────────────────────────────────────────

function renderNotebook(
    md: string,
    topicTitle?: string,
    onSeek?: (seconds: number) => void,
    isStreaming?: boolean
): React.ReactNode[] {
    // 1. Sanitize raw HTML timestamp spans: [<span...>0:06</span>] or <span...>0:06</span> -> [0:06]
    let cleanMd = md
        .replace(/<span[^>]*style="[^"]*monospace[^"]*"[^>]*>(\d{1,2}:\d{2}(?::\d{2})?)<\/span>/gi, '$1')
        .replace(/<span[^>]*>(\d{1,2}:\d{2}(?::\d{2})?)<\/span>/gi, '$1')
        // Normalize any bracket variations: [[01:28]], [ [01:28] ], [ 01:28 ] -> [01:28]
        .replace(/\[+[\s[]*(\d{1,2}:\d{2}(?::\d{2})?)[\s\]]*\]+/g, '[$1]');

    // 2. Convert single-line code blocks like ```bash cargo new my_project``` -> \n```bash\ncargo new my_project\n```\n
    cleanMd = cleanMd.replace(/```([a-zA-Z0-9_-]+)\s+([^\n`]+)```/g, '\n```$1\n$2\n```\n');

    // 3. Ensure code fence ``` is always isolated on its own line if preceded by inline text or timestamps
    // e.g. "[0:06].```bash" -> "[0:06].\n\n```bash"
    cleanMd = cleanMd.replace(/([^\n])\s*```([a-zA-Z0-9_-]*)/g, '$1\n\n```$2');

    const lines = cleanMd.split('\n');
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
                        <InlineText text={item.text} onSeek={onSeek} />
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
                                    <InlineText text={cell} onSeek={onSeek} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableRows.slice(2).map((row, ri) => (
                            <tr key={ri} className={ri % 2 === 0 ? 'bg-card' : 'bg-secondary/20'}>
                                {row.map((cell, ci) => (
                                    <td key={ci} className="px-4 py-2.5 text-foreground/80 border-b border-border/30">
                                        <InlineText text={cell} onSeek={onSeek} />
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
            if (line.trim() === '```') {
                elements.push(
                    <MermaidDiagram key={key()} chart={mermaidLines.join('\n')} title={topicTitle} />
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

        // Headings (Clean Editorial Hierarchy, No Competing Vertical Bars)
        if (line.startsWith('# ')) {
            flushList(); flushTable();
            elements.push(
                <h1 key={key()} className="text-2xl sm:text-3xl font-extrabold mt-8 mb-4 text-foreground tracking-tight border-b border-border/40 pb-3">
                    <InlineText text={line.slice(2)} onSeek={onSeek} />
                </h1>
            );
            continue;
        }
        if (line.startsWith('## ')) {
            flushList(); flushTable();
            elements.push(
                <h2 key={key()} className="text-lg sm:text-xl font-bold mt-8 mb-3 text-foreground tracking-tight flex items-center flex-wrap gap-2">
                    <InlineText text={line.slice(3)} onSeek={onSeek} />
                </h2>
            );
            continue;
        }
        if (line.startsWith('### ')) {
            flushList(); flushTable();
            elements.push(
                <h3 key={key()} className="text-base font-semibold mt-6 mb-2 text-foreground/95 tracking-tight">
                    <InlineText text={line.slice(4)} onSeek={onSeek} />
                </h3>
            );
            continue;
        }
        if (line.startsWith('#### ')) {
            flushList(); flushTable();
            elements.push(
                <h4 key={key()} className="text-xs font-mono font-semibold mt-5 mb-1.5 text-muted-foreground uppercase tracking-wider">
                    <InlineText text={line.slice(5)} onSeek={onSeek} />
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
            elements.push(<Callout key={key()} text={line.slice(2)} raw={line} onSeek={onSeek} />);
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
            <p key={key()} className="my-2.5 text-foreground/85 leading-relaxed text-[0.95rem]">
                <InlineText text={line} onSeek={onSeek} />
            </p>
        );
    }

    flushList();
    flushTable();

    // Flush any unclosed code block during active streaming
    if (inCode && codeLines.length > 0) {
        elements.push(
            <CodeBlock key={key()} code={codeLines.join('\n')} language={codeLang} />
        );
    }

    // Flush any unclosed Mermaid diagram during active streaming
    if (inMermaid && mermaidLines.length > 0) {
        elements.push(
            <div key={key()} className="my-4 p-4 rounded-xl border border-primary/20 bg-muted/20 font-mono text-xs">
                <div className="flex items-center gap-2 text-primary text-xs mb-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span>Streaming Architecture Diagram...</span>
                </div>
                <pre className="text-muted-foreground whitespace-pre-wrap">{mermaidLines.join('\n')}</pre>
            </div>
        );
    }

    // Add glowing streaming cursor indicator if actively generating
    if (isStreaming) {
        elements.push(
            <span
                key="live-streaming-cursor"
                className="inline-block w-2.5 h-5 bg-primary ml-1.5 animate-pulse align-middle rounded-xs shadow-[0_0_8px_rgba(var(--primary),0.8)]"
                title="AI is generating..."
            />
        );
    }

    return elements;
}

// ─── Export Component ──────────────────────────────────────────────────────────

export function RunningNotesViewer({
    content,
    title,
    className,
    showToolbar = true,
    onSeek,
    isStreaming = false,
    chapterNumber,
    totalChapters,
    timeDisplay,
    startTime,
    onNextChapter,
    onPrevChapter,
    prevChapterTitle,
    nextChapterTitle,
    isFocusMode,
    onToggleFocusMode,
    isEnhanced,
    enhancedWith,
    onEnhance,
    onRevert,
    streamingStatus,
}: RunningNotesViewerProps) {
    const [copied, setCopied] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [userScrolledUp, setUserScrolledUp] = useState(false);

    const wordCount = useMemo(() => content.split(/\s+/).filter(Boolean).length, [content]);
    const readingTime = useMemo(() => Math.max(1, Math.ceil(wordCount / 200)), [wordCount]);

    useEffect(() => {
        if (isStreaming && !userScrolledUp && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [content, isStreaming, userScrolledUp]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
        setUserScrolledUp(!isNearBottom);
    };

    const scrollToBottom = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            setUserScrolledUp(false);
        }
    };

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        toast({ title: 'Copied to clipboard' });
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
        toast({ title: 'Downloaded notes as Markdown' });
    }, [content, title]);

    return (
        <div className={cn('flex flex-col h-full relative', className)}>
            {/* ── Outer Notebook Paper Container ─────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-xs shadow-xs">
                {/* ── Notebook Page Top Header Bar ──────────────────────────────── */}
                <div className="px-5 py-2.5 border-b border-border/40 bg-muted/15 flex items-center justify-between gap-3 shrink-0 select-none">
                    <div className="flex items-center flex-wrap gap-2.5 min-w-0">
                        {chapterNumber !== undefined && (
                            <span className="px-2 py-0.5 rounded-md bg-secondary/80 border border-border/50 text-foreground font-mono font-medium text-xs">
                                Chapter {String(chapterNumber).padStart(2, '0')}
                                {totalChapters ? ` of ${String(totalChapters).padStart(2, '0')}` : ''}
                            </span>
                        )}

                        {timeDisplay && (
                            <button
                                type="button"
                                onClick={() => startTime !== undefined && onSeek?.(startTime)}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground font-mono text-xs transition-colors border border-border/40"
                                title={`Jump to video timestamp ${timeDisplay}`}
                            >
                                <Play className="w-2.5 h-2.5 fill-current opacity-80" />
                                <span>{timeDisplay}</span>
                            </button>
                        )}

                        {isStreaming ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-secondary/80 text-foreground border border-border/50 text-xs font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span>{streamingStatus || 'Streaming…'}</span>
                            </span>
                        ) : isEnhanced && (
                            <Badge variant="outline" className="text-[10px] font-mono border-border/60 text-muted-foreground font-normal py-0.5">
                                <span>Enhanced{enhancedWith ? ` · ${enhancedWith}` : ''}</span>
                            </Badge>
                        )}
                    </div>

                    {/* Right chapter reading stats & actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-muted-foreground/70 hidden sm:inline">
                            ~{readingTime}m · {wordCount.toLocaleString()} words
                        </span>

                        {/* Revert Action if Enhanced */}
                        {onRevert && isEnhanced && !isStreaming && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onRevert}
                                className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground font-normal"
                                title="Revert to original pre-enhanced version"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span className="text-[11px]">Revert</span>
                            </Button>
                        )}

                        {/* Enhance Chapter Button */}
                        {onEnhance && !isStreaming && (
                            <Button
                                variant={isEnhanced ? "outline" : "default"}
                                size="sm"
                                onClick={onEnhance}
                                className="h-7 text-xs px-2.5 font-medium rounded-lg"
                                title="Elevate technical depth with a cloud LLM"
                            >
                                <span>{isEnhanced ? 'Re-enhance' : 'Enhance'}</span>
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopy}
                            className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground font-normal"
                            title="Copy this chapter notes"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3 h-3 text-foreground" />
                                    <span className="text-[11px]">Copied</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3 h-3" />
                                    <span className="text-[11px]">Copy</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* ── Scrollable Notebook Paper Canvas ───────────────────────────── */}
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto scroll-smooth relative px-6 py-6 sm:px-10 sm:py-8"
                >
                    {/* Notebook Margined Page Body (Optimized Typographical Reading Measure) */}
                    <div className="max-w-3xl mx-auto space-y-6">
                        {/* Title Header */}
                        {title && (
                            <div className="pb-4 border-b border-border/30">
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight">
                                    {title}
                                </h1>
                            </div>
                        )}

                        {/* Article Content */}
                        <article className="space-y-4">
                            {renderNotebook(content, title, onSeek, isStreaming)}
                        </article>

                        {/* ── Chapter Pagination Footer ─────────────────────────── */}
                        {(onPrevChapter || onNextChapter) && (
                            <div className="mt-12 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                {onPrevChapter ? (
                                    <button
                                        type="button"
                                        onClick={onPrevChapter}
                                        className="w-full sm:w-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 transition-colors text-left group"
                                    >
                                        <ChevronLeft className="w-4 h-4 text-primary group-hover:-translate-x-0.5 transition-transform" />
                                        <div>
                                            <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Previous Chapter</div>
                                            <div className="text-xs font-semibold text-foreground line-clamp-1 max-w-[220px]">
                                                {prevChapterTitle || 'Previous'}
                                            </div>
                                        </div>
                                    </button>
                                ) : <div />}

                                {chapterNumber !== undefined && totalChapters !== undefined && (
                                    <span className="text-xs font-mono text-muted-foreground">
                                        Chapter {chapterNumber} of {totalChapters}
                                    </span>
                                )}

                                {onNextChapter ? (
                                    <button
                                        type="button"
                                        onClick={onNextChapter}
                                        className="w-full sm:w-auto flex items-center justify-end gap-2 px-4 py-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 transition-colors text-right group ml-auto"
                                    >
                                        <div>
                                            <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Next Chapter</div>
                                            <div className="text-xs font-semibold text-foreground line-clamp-1 max-w-[220px]">
                                                {nextChapterTitle || 'Next'}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                ) : <div />}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Follow Live Stream floating pill button */}
            {isStreaming && userScrolledUp && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-5 right-8 px-3.5 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium shadow-md hover:bg-foreground/90 transition-colors flex items-center gap-1.5 z-30"
                >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>Follow live stream</span>
                </button>
            )}
        </div>
    );
}

export default RunningNotesViewer;
