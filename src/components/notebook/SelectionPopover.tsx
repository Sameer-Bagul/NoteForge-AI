import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Lightbulb, FileText, HelpCircle, Send, X, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectionPopoverProps {
  containerRef: React.RefObject<HTMLElement>;
  onAskCopilot: (selectedText: string, prompt?: string) => void;
}

export const SelectionPopover: React.FC<SelectionPopoverProps> = ({
  containerRef,
  onAskCopilot,
}) => {
  const [selectedText, setSelectedText] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const checkSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      if (!isInputExpanded) {
        setIsVisible(false);
        setCoords(null);
        setSelectedText('');
      }
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 3) {
      if (!isInputExpanded) {
        setIsVisible(false);
        setCoords(null);
        setSelectedText('');
      }
      return;
    }

    const range = selection.getRangeAt(0);
    // Ensure selection is inside the container
    if (containerRef.current && !containerRef.current.contains(range.commonAncestorContainer)) {
      if (!isInputExpanded) {
        setIsVisible(false);
        setCoords(null);
        setSelectedText('');
      }
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    // Calculate position centered above the selection, or below if near top
    const popoverWidth = isInputExpanded ? 340 : 360;
    const popoverHeight = isInputExpanded ? 80 : 42;
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    // Boundary clamp horizontally
    left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, left));

    let top = rect.top - popoverHeight - 10;
    // If overflowing above window, flip to below selection
    if (top < 10) {
      top = rect.bottom + 10;
    }

    setSelectedText(text);
    setCoords({ top, left });
    setIsVisible(true);
  }, [containerRef, isInputExpanded]);

  useEffect(() => {
    const handleMouseUp = () => {
      // Short delay to allow browser to finalize selection
      setTimeout(checkSelection, 20);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVisible(false);
        setIsInputExpanded(false);
        setCoords(null);
        setSelectedText('');
        return;
      }
      setTimeout(checkSelection, 20);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false);
        setIsInputExpanded(false);
        setCoords(null);
        setSelectedText('');
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [checkSelection, containerRef]);

  useEffect(() => {
    if (isInputExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isInputExpanded]);

  const handleAction = (promptText?: string) => {
    if (!selectedText) return;
    onAskCopilot(selectedText, promptText);
    setIsVisible(false);
    setIsInputExpanded(false);
    setCustomPrompt('');
    window.getSelection()?.removeAllRanges();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    handleAction(customPrompt.trim());
  };

  if (!isVisible || !coords) return null;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 60,
      }}
      className={cn(
        "animate-in fade-in-0 zoom-in-95 duration-150 transition-all select-none",
        "bg-popover/95 backdrop-blur-md text-popover-foreground border border-border/60 shadow-xl rounded-xl",
        isInputExpanded ? "p-2 w-[340px]" : "p-1 flex items-center gap-0.5"
      )}
    >
      {!isInputExpanded ? (
        <>
          <button
            type="button"
            onClick={() => setIsInputExpanded(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-primary hover:bg-primary/10 transition-colors"
            title="Ask Copilot about this selection"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>

          <div className="w-[1px] h-3.5 bg-border/60 mx-0.5" />

          <button
            type="button"
            onClick={() => handleAction("Explain this concept in simpler terms with a clear real-world analogy.")}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
            title="Explain in simple terms"
          >
            <Lightbulb className="w-3 h-3 text-amber-500" />
            <span>Explain</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction("Summarize the key takeaway of this selected excerpt into 2-3 concise bullet points.")}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
            title="Summarize excerpt"
          >
            <FileText className="w-3 h-3 text-blue-500" />
            <span>Summary</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction("Generate a practice test question based on this concept with answer explanation.")}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
            title="Create practice question"
          >
            <HelpCircle className="w-3 h-3 text-purple-500" />
            <span>Quiz</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsVisible(false);
              window.getSelection()?.removeAllRanges();
            }}
            className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 ml-0.5"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </>
      ) : (
        <form onSubmit={handleCustomSubmit} className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span className="flex items-center gap-1 font-mono">
              <Sparkles className="w-3 h-3 text-primary" />
              Ask Copilot about selection
            </span>
            <button
              type="button"
              onClick={() => setIsInputExpanded(false)}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ask anything about this selection..."
              className="w-full bg-secondary/40 border border-border/50 rounded-lg pl-2.5 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/80 transition-colors"
            />
            <button
              type="submit"
              disabled={!customPrompt.trim()}
              className="absolute right-1.5 p-1 text-primary hover:text-primary/80 disabled:opacity-40 disabled:hover:text-primary transition-opacity"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

