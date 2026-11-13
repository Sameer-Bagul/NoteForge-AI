import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Copy, Check, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

interface MermaidDiagramProps {
  chart: string;
  id?: string;
}

// Global initialization flag
let initialized = false;

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, id }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const { theme } = useTheme();

  const uniqueId = useRef(id || `mermaid-${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        securityLevel: 'strict',
        fontFamily: 'Inter, system-ui, sans-serif',
      });
      initialized = true;
    } catch (e) {
      console.error('Mermaid init error:', e);
    }
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      if (!chart.trim()) return;
      setError(null);

      try {
        const renderId = `render-${uniqueId.current}-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, chart.trim());
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Mermaid rendering failed, fallback:', err);
          setError(err?.message || 'Failed to render diagram syntax');
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart, theme]);

  const handleCopySvg = async () => {
    if (!svgContent) return;
    try {
      await navigator.clipboard.writeText(svgContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy SVG', e);
    }
  };

  if (error) {
    return (
      <div className="my-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs font-mono">
        <div className="flex items-center justify-between text-destructive mb-2 font-sans font-semibold">
          <span>⚠️ Diagram Syntax Warning</span>
        </div>
        <p className="text-muted-foreground mb-3">{error}</p>
        <pre className="p-3 rounded-lg bg-background/50 text-foreground overflow-x-auto text-[11px]">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div className="relative my-6 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden group">
      {/* Diagram header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/40">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            Interactive Architecture Diagram
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom Out"
            aria-label="Zoom out diagram"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Reset Zoom"
            aria-label="Reset zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom In"
            aria-label="Zoom in diagram"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3 bg-border mx-1" />
          <button
            onClick={handleCopySvg}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Copy SVG"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-500" />
                <span className="text-green-500 text-[11px]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">SVG</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Diagram SVG body */}
      <div className="p-6 overflow-x-auto flex justify-center bg-card/30">
        <div
          ref={containerRef}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center top', transition: 'transform 0.15s ease' }}
          className="w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  );
};
