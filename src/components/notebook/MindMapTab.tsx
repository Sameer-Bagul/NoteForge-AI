import { useState, useCallback, useEffect } from 'react';
import {
    ReactFlow,
    Node,
    Edge,
    Controls,
    MiniMap,
    Background,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    NodeTypes,
    Handle,
    Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/context/ThemeContext';
import { layoutTree } from '@/services/mindmap/layout';
import { GitBranch, Loader2, Brain, RefreshCw, Spline, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MindMapTabProps {
    notebookId?: string;
    topics: { id: string; title: string; subtopics: string[] }[];
    fullContent: string;
    existingMindMaps?: Record<string, any>; // Record<topicId, {nodes, edges}>
    onUpdateNotes?: (updates: { mindMaps: Record<string, any> }) => void;
}

// ─── Custom Nodes ──────────────────────────────────────────────────────────────

function CentralNode({ data }: { data: { label: string } }) {
    return (
        <div className="relative group px-5 py-3 rounded-2xl bg-card border-2 border-primary/35 text-foreground font-semibold text-center shadow-lg shadow-primary/5 min-w-[180px] max-w-[260px] select-none backdrop-blur-xs transition-all duration-150 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10">
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background shadow-xs"
            />
            <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground font-medium">
                    Core topic
                </span>
            </div>
            <span className="text-xs sm:text-sm font-semibold tracking-tight leading-snug block text-foreground">
                {data.label}
            </span>
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background shadow-xs"
            />
        </div>
    );
}

function BranchNode({ data }: { data: { label: string; color?: string } }) {
    const color = data.color || '#6366f1';
    return (
        <div
            className="relative group px-4 py-2.5 rounded-xl bg-card border text-foreground font-medium text-center min-w-[130px] max-w-[200px] select-none shadow-xs transition-all duration-150 hover:shadow-md hover:scale-[1.02] flex items-center justify-center gap-2"
            style={{
                borderColor: `${color}66`,
                boxShadow: `0 2px 10px -2px ${color}25`,
            }}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2.5 !h-2.5 !border-2 !border-background transition-colors"
                style={{ backgroundColor: color }}
            />
            <div
                className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
            />
            <span className="text-xs font-semibold tracking-tight leading-snug truncate">
                {data.label}
            </span>
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2.5 !h-2.5 !border-2 !border-background transition-colors"
                style={{ backgroundColor: color }}
            />
        </div>
    );
}

function LeafNode({ data }: { data: { label: string; color?: string } }) {
    const dotColor = data.color || '#6366f1';
    return (
        <div
            className="group relative px-3.5 py-2.5 rounded-xl bg-card/95 border border-border/70 hover:border-foreground/25 text-foreground transition-all duration-150 shadow-xs hover:shadow-sm min-w-[170px] max-w-[270px] flex items-center gap-2.5"
            style={{
                borderLeftColor: dotColor,
                borderLeftWidth: '3.5px',
            }}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2 !h-2 !bg-muted-foreground/50 group-hover:!bg-foreground !border-2 !border-background transition-colors"
            />
            <span className="text-xs font-normal leading-snug text-foreground/90 select-none">
                {data.label}
            </span>
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-muted-foreground/50 group-hover:!bg-foreground !border-2 !border-background transition-colors"
            />
        </div>
    );
}

const nodeTypes: NodeTypes = {
    central: CentralNode,
    branch: BranchNode,
    leaf: LeafNode,
};

// ─── Mind Map Tab Component ───────────────────────────────────────────────────

export function MindMapTab({
    notebookId,
    topics,
    fullContent,
    existingMindMaps,
    onUpdateNotes,
}: MindMapTabProps) {
    const { theme } = useTheme();
    const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id || '');
    const activeTopic = topics.find(t => t.id === selectedTopicId) || topics[0];
    const [edgeCurve, setEdgeCurve] = useState<'smoothstep' | 'bezier'>('smoothstep');

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activeTopic) return;
        const topicData = existingMindMaps?.[activeTopic.id];
        if (topicData && topicData.nodes && topicData.nodes.length > 0) {
            const formatted = layoutTree(topicData.nodes, topicData.edges || [], edgeCurve);
            setNodes(formatted.nodes);
            setEdges(formatted.edges);
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [activeTopic, existingMindMaps, edgeCurve, setNodes, setEdges]);

    const handleGenerate = useCallback(async () => {
        if (!activeTopic) return;
        setLoading(true);
        setError(null);

        try {
            const data = await api.generateMindMap(
                activeTopic.title,
                activeTopic.subtopics,
                fullContent.slice(0, 3000),
            );
            const { nodes: lNodes, edges: lEdges } = layoutTree(data.nodes || [], data.edges || [], edgeCurve);
            setNodes(lNodes);
            setEdges(lEdges);

            const mapData = {
                topicId: activeTopic.id,
                nodes: lNodes,
                edges: lEdges,
            };

            const updatedMaps = {
                ...(existingMindMaps || {}),
                [activeTopic.id]: mapData,
            };

            if (notebookId) {
                try {
                    await api.updateNotebook(notebookId, { mindMaps: updatedMaps });
                } catch (persistErr) {
                    console.error('Failed to persist mind map in SQLite:', persistErr);
                }
            }

            onUpdateNotes?.({ mindMaps: updatedMaps });
        } catch (err: any) {
            console.error('Failed to generate mind map:', err);
            setError(err?.message || 'Failed to generate concept map.');
        } finally {
            setLoading(false);
        }
    }, [activeTopic, fullContent, existingMindMaps, notebookId, onUpdateNotes, edgeCurve, setNodes, setEdges]);

    const hasGraph = nodes.length > 0;
    const dotColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    const minimapMaskColor = theme === 'dark' ? 'rgba(15, 23, 42, 0.75)' : 'rgba(241, 245, 249, 0.8)';

    return (
        <div className="flex-1 h-full min-h-0 flex flex-col p-3 sm:p-3.5 gap-3">
            {/* ── Studio Header Toolbar ────────────────────────────────────────── */}
            <div className="px-4 py-2.5 rounded-xl border border-border/40 bg-card/40 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-xs text-foreground">
                            Concept map
                        </span>
                    </div>

                    {topics.length > 1 ? (
                        <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border/30 overflow-x-auto max-w-sm">
                            {topics.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedTopicId(t.id)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md text-xs font-mono transition-colors whitespace-nowrap",
                                        selectedTopicId === t.id
                                            ? "bg-foreground text-background font-medium shadow-xs"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                    )}
                                >
                                    {t.title}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <Badge variant="outline" className="text-[11px] font-mono border-border/60 text-muted-foreground font-normal">
                            {activeTopic?.title} · {activeTopic?.subtopics?.length || 0} subtopics
                        </Badge>
                    )}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {hasGraph && (
                        <div className="flex items-center rounded-lg border border-border/40 bg-secondary/40 p-0.5">
                            <button
                                onClick={() => setEdgeCurve('smoothstep')}
                                className={cn(
                                    "px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors",
                                    edgeCurve === 'smoothstep'
                                        ? "bg-foreground text-background shadow-xs font-medium"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                                title="Orthogonal stepped connectors"
                            >
                                <Route className="w-3 h-3" />
                                <span className="hidden sm:inline">Stepped</span>
                            </button>
                            <button
                                onClick={() => setEdgeCurve('bezier')}
                                className={cn(
                                    "px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors",
                                    edgeCurve === 'bezier'
                                        ? "bg-foreground text-background shadow-xs font-medium"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                                title="Smooth curved connectors"
                            >
                                <Spline className="w-3 h-3" />
                                <span className="hidden sm:inline">Curved</span>
                            </button>
                        </div>
                    )}

                    <Button
                        variant={hasGraph ? "outline" : "default"}
                        size="sm"
                        onClick={handleGenerate}
                        disabled={loading}
                        className="h-7 text-xs rounded-lg px-2.5 gap-1.5 font-medium transition-colors"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Generating…</span>
                            </>
                        ) : hasGraph ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Regenerate map</span>
                            </>
                        ) : (
                            <>
                                <Brain className="w-3.5 h-3.5" />
                                <span>Generate map</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* ── Full Height ReactFlow Studio Canvas ─────────────────────────── */}
            <div className="flex-1 h-full min-h-0 rounded-xl border border-border/40 bg-card/25 overflow-hidden relative shadow-xs">
                {!hasGraph ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                        {loading ? (
                            <>
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                </div>
                                <div className="space-y-1 max-w-sm">
                                    <h4 className="text-sm font-semibold text-foreground">
                                        Synthesizing Architecture Map...
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Decomposing topic concepts, dependencies, and execution hierarchy.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-12 h-12 rounded-2xl bg-secondary/60 border border-border/40 flex items-center justify-center text-muted-foreground/60">
                                    <GitBranch className="w-6 h-6" />
                                </div>
                                <div className="space-y-1 max-w-sm">
                                    <h4 className="text-sm font-semibold text-foreground">
                                        Visualize {activeTopic?.title || 'Topic'}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Generate an interactive node graph illustrating key concepts, subtopics, and structural relationships.
                                    </p>
                                </div>
                                <Button
                                    onClick={handleGenerate}
                                    className="rounded-xl h-8 px-4 text-xs font-semibold gap-1.5 mt-2 shadow-xs"
                                >
                                    <Brain className="w-3.5 h-3.5" />
                                    <span>Generate Concept Map</span>
                                </Button>
                            </>
                        )}
                        {error && (
                            <p className="text-xs text-destructive font-mono pt-2">{error}</p>
                        )}
                    </div>
                ) : (
                    <ReactFlow
                        key={`${activeTopic?.id}-${nodes.length}-${edgeCurve}`}
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        nodeOrigin={[0, 0.5]}
                        fitView
                        fitViewOptions={{ padding: 0.25 }}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Controls
                            className="!bg-card/90 !border-border/50 !rounded-xl !overflow-hidden !shadow-md"
                            showInteractive={false}
                        />
                        <MiniMap
                            className="!bg-card/90 !border-border/50 !rounded-xl !overflow-hidden !shadow-md"
                            maskColor={minimapMaskColor}
                            nodeColor={(node) => {
                                if (node.type === 'central') return '#6366f1';
                                return (node.data as any)?.color || '#3b4252';
                            }}
                        />
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={22}
                            size={1.2}
                            color={dotColor}
                        />
                    </ReactFlow>
                )}
            </div>
        </div>
    );
}
