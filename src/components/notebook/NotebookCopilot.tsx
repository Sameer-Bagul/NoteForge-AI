import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, X, Send, Bot, User, Play, Copy, Check, AtSign,
  BookOpen, Folder, Loader2, ArrowRight, CornerDownLeft, RotateCcw, StopCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { VideoNotes } from '@/types';
import { CopilotScope, MentionItem, CopilotMessage } from '@/services/rag/ragTypes';
import { assemblePromptContext, streamCopilotReply, parseTimestampToSeconds } from '@/services/rag/ragAgent';
import { indexNotebook, searchVault } from '@/services/rag/vectorStore';
import { api } from '@/services/api';

interface NotebookCopilotProps {
  isOpen: boolean;
  onClose: () => void;
  notes: VideoNotes;
  activeTopicId?: string;
  onSeek?: (seconds: number) => void;
  initialSelectedText?: string;
  initialPrompt?: string;
  onClearInitialSelection?: () => void;
}

export const NotebookCopilot: React.FC<NotebookCopilotProps> = ({
  isOpen,
  onClose,
  notes,
  activeTopicId,
  onSeek,
  initialSelectedText,
  initialPrompt,
  onClearInitialSelection,
}) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [scope, setScope] = useState<CopilotScope>('notebook');
  const [isStreaming, setIsStreaming] = useState(false);
  const [quotedText, setQuotedText] = useState<string | undefined>(initialSelectedText);
  const [activeMentions, setActiveMentions] = useState<MentionItem[]>([]);
  
  // @ mention autocomplete state
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionCursorIndex, setMentionCursorIndex] = useState(0);
  const [allNotebooks, setAllNotebooks] = useState<Array<{ id: string; title: string }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<boolean>(false);

  // Load available library notebooks for @ mentions
  useEffect(() => {
    let isMounted = true;
    api.getJobs().then((jobs) => {
      if (!isMounted) return;
      const list = (jobs || []).map((j: any) => ({
        id: j.notebookId || j.id,
        title: j.title || j.options?.title || 'Untitled Notebook',
      }));
      setAllNotebooks(list.filter((n) => n.id !== notes.notebookId));
    }).catch(() => {});

    // Automatically index current notebook in background for RAG
    if (notes) {
      indexNotebook(notes).catch((e) => console.warn('Background indexing note:', e));
    }

    return () => { isMounted = false; };
  }, [notes.notebookId, notes]);

  // Handle incoming initial selected text & prompt from floating popover
  useEffect(() => {
    if (initialSelectedText) {
      setQuotedText(initialSelectedText);
      if (initialPrompt) {
        handleSend(initialPrompt, initialSelectedText);
      }
      onClearInitialSelection?.();
    }
  }, [initialSelectedText, initialPrompt]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Detect typing '@' in input to show autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1 && !textBeforeCursor.slice(lastAtIdx).includes(' ')) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      setMentionFilter(query);
      setShowMentionMenu(true);
      setMentionCursorIndex(0);
    } else {
      setShowMentionMenu(false);
    }
  };

  // Compile mention candidates
  const availableMentions = React.useMemo<MentionItem[]>(() => {
    const q = mentionFilter.toLowerCase();
    const chapterItems: MentionItem[] = notes.index.map((t, idx) => ({
      id: t.id,
      type: 'chapter',
      title: `Chapter ${idx + 1}: ${t.title}`,
      subtitle: t.timeDisplay || '00:00',
      chapterIndex: idx + 1,
      startTime: t.startTime,
    })).filter(m => !q || m.title.toLowerCase().includes(q));

    const notebookItems: MentionItem[] = allNotebooks.map(n => ({
      id: n.id,
      type: 'notebook',
      title: n.title,
      subtitle: 'Notebook from Library',
    })).filter(m => !q || m.title.toLowerCase().includes(q));

    return [...chapterItems, ...notebookItems];
  }, [notes.index, allNotebooks, mentionFilter]);

  const insertMention = (item: MentionItem) => {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart;
    const textBeforeCursor = input.slice(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = input.slice(cursor);

    const newInput = textBeforeCursor.slice(0, lastAtIdx) + textAfterCursor;
    setInput(newInput);
    setShowMentionMenu(false);

    // Add to active mentions list if not already present
    if (!activeMentions.some(m => m.id === item.id)) {
      setActiveMentions(prev => [...prev, item]);
    }
    inputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && availableMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionCursorIndex(prev => (prev + 1) % availableMentions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionCursorIndex(prev => (prev - 1 + availableMentions.length) % availableMentions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(availableMentions[mentionCursorIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async (customText?: string, quoteOverride?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || isStreaming) return;

    const currentQuote = quoteOverride !== undefined ? quoteOverride : quotedText;
    const currentMentions = [...activeMentions];

    const userMessage: CopilotMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
      quotedText: currentQuote,
      mentions: currentMentions.length > 0 ? currentMentions : undefined,
    };

    const assistantMessageId = `msg-assistant-${Date.now()}`;
    const assistantMessage: CopilotMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setQuotedText(undefined);
    setActiveMentions([]);
    setIsStreaming(true);
    abortControllerRef.current = false;

    try {
      let extraContext = '';
      if (scope === 'vault') {
        try {
          const matches = await searchVault(textToSend, {
            currentNotebookId: notes.notebookId || notes.videoId,
            scope: 'vault',
            topK: 5,
          });
          if (matches.length > 0) {
            extraContext = matches.map(m =>
              `[Source: ${m.chunk.chapterTitle || 'Chapter'} | Timestamp: ${m.chunk.timeDisplay || '00:00'} | Match: ${(m.score * 100).toFixed(0)}%]\n${m.chunk.text}`
            ).join('\n\n---\n\n');
          }
        } catch (err) {
          console.warn('Vault search failed, falling back:', err);
        }
      }

      const contextInfo = await assemblePromptContext({
        scope,
        currentNotes: notes,
        activeTopicId,
        quotedText: currentQuote,
        mentions: currentMentions,
        extraContext,
      });

      let accumulated = '';
      await streamCopilotReply(
        textToSend,
        messages,
        contextInfo,
        (token) => {
          if (abortControllerRef.current) return;
          accumulated += token;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulated }
                : msg
            )
          );
        }
      );

      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    } catch (err: any) {
      console.error('Copilot streaming error:', err);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                isStreaming: false,
                content: msg.content || 'Unable to generate response from AI providers.',
                error: err?.message || 'AI request failed.',
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStopStreaming = () => {
    abortControllerRef.current = true;
    setIsStreaming(false);
    setMessages(prev =>
      prev.map(msg => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  };

  const handleCopyMessage = async (content: string) => {
    await navigator.clipboard.writeText(content);
    toast({ title: 'Copied response to clipboard' });
  };

  if (!isOpen) return null;

  return (
    <div className="w-[380px] xl:w-[420px] h-full flex flex-col border-l border-border/40 bg-card/60 backdrop-blur-md z-30 select-none shrink-0 transition-all">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="p-3 border-b border-border/40 flex items-center justify-between gap-2 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground tracking-tight">Study Copilot</h3>
            <p className="text-[10px] font-mono text-muted-foreground">RAG Assistant with Video Sync</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
            title="Close Copilot"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Scope Switcher ─────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-border/30 bg-muted/10 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
          Context Scope
        </span>
        <div className="flex items-center p-0.5 rounded-lg bg-secondary/50 border border-border/40 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setScope('chapter')}
            className={cn(
              "px-2 py-0.5 rounded-md transition-all",
              scope === 'chapter' ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
            title="Search only the current chapter"
          >
            Chapter
          </button>
          <button
            type="button"
            onClick={() => setScope('notebook')}
            className={cn(
              "px-2 py-0.5 rounded-md transition-all",
              scope === 'notebook' ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
            title="Search this entire notebook"
          >
            Notebook
          </button>
          <button
            type="button"
            onClick={() => setScope('vault')}
            className={cn(
              "px-2 py-0.5 rounded-md transition-all",
              scope === 'vault' ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
            title="Search across all notebooks in SQLite vault"
          >
            Vault
          </button>
        </div>
      </div>

      {/* ── Messages Chat View ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 select-text">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-4 text-muted-foreground">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Ask anything about this lecture</p>
              <p className="text-[11px] text-muted-foreground max-w-[240px] leading-relaxed">
                Highlight text in notes to ask inline, type <span className="font-mono text-primary">@</span> to mention chapters, or ask for explanations and formulas.
              </p>
            </div>

            <div className="w-full space-y-1.5 pt-2">
              {[
                "Explain the main takeaway of this chapter",
                "Where in the video is the key formula explained?",
                "Give me 2 practice quiz questions on this topic",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(suggestion)}
                  className="w-full text-left p-2 rounded-lg bg-secondary/30 hover:bg-secondary/60 border border-border/30 text-[11px] text-foreground/90 transition-colors flex items-center justify-between group"
                >
                  <span className="line-clamp-1">{suggestion}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col space-y-1.5",
                msg.role === 'user' ? "items-end" : "items-start"
              )}
            >
              {/* Message author badge */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground px-1">
                {msg.role === 'user' ? (
                  <>
                    <span>You</span>
                    <User className="w-2.5 h-2.5" />
                  </>
                ) : (
                  <>
                    <Bot className="w-2.5 h-2.5 text-primary" />
                    <span>Copilot</span>
                  </>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={cn(
                  "p-3 rounded-2xl max-w-[90%] text-xs leading-relaxed space-y-2",
                  msg.role === 'user'
                    ? "bg-primary text-primary-foreground rounded-br-xs"
                    : "bg-secondary/40 border border-border/40 text-foreground rounded-bl-xs"
                )}
              >
                {/* Quoted Text Excerpt if User highlighted notes */}
                {msg.quotedText && (
                  <div className="p-2 rounded-lg bg-black/20 border-l-2 border-primary/60 text-[11px] italic line-clamp-3 opacity-90">
                    "{msg.quotedText}"
                  </div>
                )}

                {/* Mentions Badges */}
                {msg.mentions && msg.mentions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {msg.mentions.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono"
                      >
                        <AtSign className="w-2.5 h-2.5 opacity-70" />
                        {m.title}
                      </span>
                    ))}
                  </div>
                )}

                {/* Message Body Content */}
                <div className="whitespace-pre-wrap font-sans">
                  {renderMessageContent(msg.content, onSeek)}
                </div>

                {/* Error Banner */}
                {msg.error && (
                  <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px]">
                    {msg.error}
                  </div>
                )}

                {/* Assistant Footer: Copy & Action */}
                {msg.role === 'assistant' && !msg.isStreaming && msg.content && (
                  <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[10px] text-muted-foreground">
                    <span>NoteForge RAG</span>
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.content)}
                      className="flex items-center gap-1 p-1 hover:text-foreground transition-colors"
                      title="Copy response"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                )}

                {/* Pulsing indicator during stream */}
                {msg.isStreaming && (
                  <div className="flex items-center gap-1.5 text-primary text-[11px] pt-1 font-mono">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Thinking & citing video...</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Active Mentions & Quoted Text Previews ───────────────────────────── */}
      {(quotedText || activeMentions.length > 0) && (
        <div className="p-2 border-t border-border/30 bg-muted/15 space-y-1.5 text-xs">
          {quotedText && (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <span className="text-[11px] line-clamp-1 italic">
                Quoting: "{quotedText}"
              </span>
              <button
                type="button"
                onClick={() => setQuotedText(undefined)}
                className="p-0.5 hover:bg-primary/20 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {activeMentions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {activeMentions.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border/40 text-[10px] font-mono text-foreground"
                >
                  <AtSign className="w-2.5 h-2.5 text-primary" />
                  <span className="line-clamp-1 max-w-[140px]">{m.title}</span>
                  <button
                    type="button"
                    onClick={() => setActiveMentions(prev => prev.filter(item => item.id !== m.id))}
                    className="hover:text-destructive ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mention Autocomplete Dropdown ──────────────────────────────────── */}
      {showMentionMenu && availableMentions.length > 0 && (
        <div className="mx-3 mb-1 p-1 bg-popover/95 backdrop-blur-md border border-border/50 rounded-xl shadow-xl max-h-48 overflow-y-auto z-40 space-y-0.5">
          <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            Mention Chapter or Notebook
          </div>
          {availableMentions.slice(0, 8).map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => insertMention(item)}
              className={cn(
                "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors",
                idx === mentionCursorIndex ? "bg-primary text-primary-foreground" : "hover:bg-muted/60 text-foreground"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.type === 'chapter' ? (
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="line-clamp-1">{item.title}</span>
              </div>
              {item.subtitle && (
                <span className="text-[10px] opacity-75 font-mono shrink-0 ml-2">
                  {item.subtitle}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Input Box ──────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-border/40 bg-card/80 space-y-2">
        <div className="relative flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              scope === 'chapter'
                ? "Ask about this chapter (or type @ to mention)..."
                : "Ask anything about this notebook (or type @)..."
            }
            className="flex-1 bg-secondary/30 border border-border/40 rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-primary/80 transition-colors"
          />

          {isStreaming ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleStopStreaming}
              className="h-9 px-3 rounded-xl gap-1 text-xs"
              title="Stop generating"
            >
              <StopCircle className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!input.trim() && !quotedText}
              onClick={() => handleSend()}
              className="h-9 px-3 rounded-xl gap-1 text-xs"
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMentionMenu(true);
                setMentionFilter('');
                inputRef.current?.focus();
              }}
              className="flex items-center gap-1 hover:text-foreground transition-colors font-mono"
            >
              <AtSign className="w-3 h-3 text-primary" />
              <span>Mention</span>
            </button>
          </div>
          <span className="font-mono">Press Enter to send</span>
        </div>
      </div>
    </div>
  );
};

// ─── Message Content Renderer with Clickable Timestamps ───────────────────────

function renderMessageContent(text: string, onSeek?: (seconds: number) => void) {
  if (!text) return null;

  // Match bracketed timestamps like [14:22] or [01:14:22]
  const parts = text.split(/(\[\d{1,2}:\d{2}(?::\d{2})?\])/g);

  return (
    <>
      {parts.map((part, i) => {
        if (/^\[\d{1,2}:\d{2}(?::\d{2})?\]$/.test(part)) {
          const secs = parseTimestampToSeconds(part);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSeek?.(secs)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-mono font-medium border border-primary/30 transition-all cursor-pointer align-baseline"
              title={`Jump video to ${part.slice(1, -1)}`}
            >
              <Play className="w-2.5 h-2.5 fill-current opacity-80" />
              <span>{part.slice(1, -1)}</span>
            </button>
          );
        }
        return part;
      })}
    </>
  );
}

