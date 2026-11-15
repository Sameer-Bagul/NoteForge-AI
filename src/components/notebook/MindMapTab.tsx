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
import { GitBranch, Loader2, Brain, RefreshCw, Layers } from 'lucide-react';
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
        <div className="px-5 py-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-center shadow-lg shadow-indigo-500/25 border-2 border-white/20 min-w-[160px] max-w-[220px]">
            <Handle type="source" position={Position.Right} className="opacity-0" />
            <Handle type="target" position={Position.Left} className="opacity-0" />
            <span className="text-sm leading-snug">{data.label}</span>
        </div>
    );
}

function BranchNode({ data }: { data: { label: string; color?: string } }) {
    return (
        <div
            className="px-4 py-2 rounded-xl text-white font-semibold text-center shadow-md min-w-[130px] max-w-[180px] border border-white/20"
            style={{ background: data.color || '#6366f1' }}
        >
            <Handle type="source" position={Position.Right} className="opacity-0" />
            <Handle type="target" position={Position.Left} className="opacity-0" />
            <span className="text-xs leading-snug">{data.label}</span>
        </div>
    );
}

function LeafNode({ data }: { data: { label: string } }) {
    return (
        <div className="px-3.5 py-1.5 rounded-xl bg-card border border-border/70 text-foreground/90 text-center shadow-xs min-w-[120px] max-w-[180px]">
            <Handle type="source" position={Position.Right} className="opacity-0" />
            <Handle type="target" position={Position.Left} className="opacity-0" />
            <span className="text-[11px] font-mono leading-snug">{data.label}</span>
        </div>
    );
}

const nodeTypes: NodeTypes = {
    central: CentralNode,
    branch: BranchNode,
    leaf: LeafNode,
};

// ─── Tree Layout Helper ────────────────────────────────────────────────────────

const BRANCH_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#3b82f6'];

function layoutTree(rawNodes: any[], rawEdges: any[]): { nodes: Node[]; edges: Edge[] } {
    if (!rawNodes.length) return { nodes: [], edges: [] };

    const root = rawNodes.find(n => n.id === 'root') || rawNodes[0];
    const branches = rawNodes.filter(n => n.type === 'branch');
    const leaves = rawNodes.filter(n => n.type === 'leaf');

    const branchCount = branches.length;
    const branchSpacing = 110;
    const startY = -(branchCount * branchSpacing) / 2;

    const nodeMap = new Map<string, Node>();

    // Root
    nodeMap.set(root.id, {
        id: root.id,
        type: 'central',
        position: { x: 0, y: 0 },
        data: { label: root.label },
    });

    // Branches
    branches.forEach((b, i) => {
        nodeMap.set(b.id, {
            id: b.id,
            type: 'branch',
            position: { x: 320, y: startY + i * branchSpacing },
            data: { label: b.label, color: b.color || BRANCH_COLORS[i % BRANCH_COLORS.length] },
        });
    });

    // Leaves — positioned to the right of their parent branch
    const branchChildCount = new Map<string, number>();
    rawEdges.forEach(e => {
        if (leaves.find(l => l.id === e.target)) {
            branchChildCount.set(e.source, (branchChildCount.get(e.source) || 0) + 1);
        }
    });

    const branchChildIndex = new Map<string, number>();
    rawEdges.forEach(e => {
        const leaf = leaves.find(l => l.id === e.target);
        if (leaf) {
            const parentNode = nodeMap.get(e.source);
            const idx = branchChildIndex.get(e.source) || 0;
            const count = branchChildCount.get(e.source) || 1;
            const leafStartY = (parentNode?.position.y || 0) - ((count - 1) * 55) / 2;

            nodeMap.set(leaf.id, {
                id: leaf.id,
                type: 'leaf',
                position: { x: 640, y: leafStartY + idx * 55 },
                data: { label: leaf.label },
            });
            branchChildIndex.set(e.source, idx + 1);
        }
    });

    const edges: Edge[] = rawEdges.map(e => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        style: { stroke: '#6366f1', strokeWidth: 1.75, opacity: 0.65 },
        animated: false,
    }));

    return { nodes: Array.from(nodeMap.values()), edges };
}

// ─── Mind Map Tab Component ───────────────────────────────────────────────────

export function MindMapTab({
    notebookId,
    topics,
    fullContent,
    existingMindMaps,
    onUpdateNotes,
}: MindMapTabProps) {
    const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id || '');
    const activeTopic = topics.find(t => t.id === selectedTopicId) || topics[0];

    const currentMapData = existingMindMaps?.[activeTopic?.id || ''];

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activeTopic) return;
        const topicData = existingMindMaps?.[activeTopic.id];
        if (topicData && topicData.nodes && topicData.nodes.length > 0) {
            const hasPositions = topicData.nodes[0]?.position?.x !== undefined;
            const formatted = hasPositions ? topicData : layoutTree(topicData.nodes, topicData.edges || []);
            setNodes(formatted.nodes);
            setEdges(formatted.edges);
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [activeTopic?.id, existingMindMaps]);

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
            const { nodes: lNodes, edges: lEdges } = layoutTree(data.nodes || [], data.edges || []);
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
    }, [activeTopic, fullContent, existingMindMaps, notebookId, onUpdateNotes]);

    const hasGraph = nodes.length > 0;

    return (
        <div className="flex-1 h-full min-h-0 flex flex-col p-3 sm:p-3.5 gap-3">
            {/* ── Studio Header Toolbar ────────────────────────────────────────── */}
            <div className="px-4 py-2.5 rounded-xl border border-border/40 bg-card/40 backdrop-blur-xs flex flex-wrap items-center justify-between gap-3 shrink-0 select-none shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="font-semibold text-xs tracking-tight text-foreground">
                            Concept Architecture Map
                        </span>
                    </div>

                    {topics.length > 1 ? (
                        <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border/30 overflow-x-auto max-w-sm">
                            {topics.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedTopicId(t.id)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md text-xs font-mono transition-all whitespace-nowrap",
                                        selectedTopicId === t.id
                                            ? "bg-foreground text-background font-semibold shadow-xs"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                    )}
                                >
                                    {t.title}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <Badge variant="outline" className="text-[11px] font-mono border-primary/20 text-primary">
                            {activeTopic?.title} · {activeTopic?.subtopics?.length || 0} Subtopics
                        </Badge>
                    )}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant={hasGraph ? "outline" : "default"}
                        size="sm"
                        onClick={handleGenerate}
                        disabled={loading}
                        className="h-7 text-xs rounded-lg px-2.5 gap-1.5 font-medium transition-all"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Generating…</span>
                            </>
                        ) : hasGraph ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Regenerate Map</span>
                            </>
                        ) : (
                            <>
                                <Brain className="w-3.5 h-3.5" />
                                <span>Generate Map</span>
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
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
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
                            maskColor="rgba(0, 0, 0, 0.75)"
                            nodeColor={(node) =>
                                node.type === 'central'
                                    ? '#6366f1'
                                    : node.type === 'branch'
                                    ? ((node.data as any)?.color || '#8b5cf6')
                                    : '#3b4252'
                            }
                        />
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={24}
                            size={1}
                            color="rgba(255, 255, 255, 0.07)"
                        />
                    </ReactFlow>
                )}
            </div>
        </div>
    );
}
