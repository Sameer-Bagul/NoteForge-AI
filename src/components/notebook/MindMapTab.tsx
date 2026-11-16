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
        <div className="relative px-5 py-2.5 rounded-xl bg-card border border-border/80 text-foreground font-semibold text-center shadow-xs min-w-[160px] max-w-[240px] select-none">
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2 !h-2 !bg-muted-foreground !border-0"
            />
            <span className="text-xs sm:text-sm font-semibold tracking-tight leading-snug">
                {data.label}
            </span>
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-muted-foreground !border-0"
            />
        </div>
    );
}

function BranchNode({ data }: { data: { label: string; color?: string } }) {
    const bgColor = data.color || '#6366f1';
    return (
        <div
            className="relative px-3.5 py-1.5 rounded-lg text-white font-medium text-center min-w-[120px] max-w-[180px] border border-white/20 select-none shadow-xs"
            style={{
                backgroundColor: bgColor,
            }}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2 !h-2 !bg-white/80 !border-0"
            />
            <span className="text-xs font-medium leading-snug">
                {data.label}
            </span>
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-white/80 !border-0"
            />
        </div>
    );
}

function LeafNode({ data }: { data: { label: string; color?: string } }) {
    const dotColor = data.color || '#6366f1';
    return (
        <div className="group relative px-3 py-2 rounded-lg bg-card/90 border border-border/60 hover:border-border text-foreground transition-colors shadow-xs min-w-[160px] max-w-[250px] flex items-center gap-2">
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2 !h-2 !bg-border group-hover:!bg-muted-foreground !border-0 transition-colors"
            />
            <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: dotColor }}
            />
            <span className="text-xs font-normal leading-snug text-foreground/90 select-none">
                {data.label}
            </span>
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-border group-hover:!bg-muted-foreground !border-0 transition-colors"
            />
        </div>
    );
}

const nodeTypes: NodeTypes = {
    central: CentralNode,
    branch: BranchNode,
    leaf: LeafNode,
};

// ─── Tree Layout Helper (Collision-Free Hierarchical Algorithm) ────────────────

const BRANCH_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#14b8a6'];

function layoutTree(rawNodes: any[], rawEdges: any[]): { nodes: Node[]; edges: Edge[] } {
    if (!rawNodes || !rawNodes.length) return { nodes: [], edges: [] };

    // 1. Build adjacency graph & lookup maps
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();
    const nodeById = new Map<string, any>();

    rawNodes.forEach(n => {
        childrenMap.set(n.id, []);
        nodeById.set(n.id, n);
    });

    rawEdges.forEach(e => {
        if (childrenMap.has(e.source)) {
            childrenMap.get(e.source)!.push(e.target);
        }
        parentMap.set(e.target, e.source);
    });

    // 2. Identify root node
    let root = rawNodes.find(n => n.id === 'root' || n.type === 'central');
    if (!root) {
        root = rawNodes.find(n => !parentMap.has(n.id)) || rawNodes[0];
    }

    // 3. Connect any orphan nodes to root to prevent disconnected / floating nodes
    rawNodes.forEach(n => {
        if (n.id !== root.id && !parentMap.has(n.id)) {
            childrenMap.get(root.id)?.push(n.id);
            parentMap.set(n.id, root.id);
        }
    });

    // 4. Assign colors to branches and propagate down to all descendant leaf nodes
    const rootChildren = childrenMap.get(root.id) || [];
    const nodeColorMap = new Map<string, string>();

    rootChildren.forEach((bId, idx) => {
        const branchColor =
            nodeById.get(bId)?.data?.color ||
            nodeById.get(bId)?.color ||
            BRANCH_COLORS[idx % BRANCH_COLORS.length];
        nodeColorMap.set(bId, branchColor);

        // Breadth-first propagation to all descendants of this branch
        const queue = [bId];
        while (queue.length > 0) {
            const curr = queue.shift()!;
            const kids = childrenMap.get(curr) || [];
            kids.forEach(kidId => {
                nodeColorMap.set(kidId, branchColor);
                queue.push(kidId);
            });
        }
    });

    // 5. Post-order subtree bounding height calculation (guarantees zero collisions)
    const ROW_PITCH = 64; // leaf card height + vertical spacing gap
    const subtreeHeight = new Map<string, number>();
    const visited = new Set<string>();

    function calcSubtreeHeight(id: string): number {
        if (visited.has(id)) return ROW_PITCH;
        visited.add(id);

        const children = (childrenMap.get(id) || []).filter(c => c !== id);
        if (children.length === 0) {
            subtreeHeight.set(id, ROW_PITCH);
            return ROW_PITCH;
        }

        let total = 0;
        for (const childId of children) {
            total += calcSubtreeHeight(childId);
        }
        const height = Math.max(ROW_PITCH, total);
        subtreeHeight.set(id, height);
        return height;
    }

    const totalHeight = calcSubtreeHeight(root.id);
    visited.clear();

    // 6. Pre-order position assignment in non-overlapping vertical slices
    const positions = new Map<string, { x: number; y: number }>();
    const X_GAP = 280;

    function assignPositions(id: string, depth: number, topY: number) {
        if (visited.has(id)) return;
        visited.add(id);

        const children = (childrenMap.get(id) || []).filter(c => c !== id);
        const h = subtreeHeight.get(id) || ROW_PITCH;
        const x = depth * X_GAP;

        if (children.length === 0) {
            positions.set(id, { x, y: Math.round(topY + h / 2) });
            return;
        }

        let currY = topY;
        const childYPositions: number[] = [];
        for (const childId of children) {
            const childH = subtreeHeight.get(childId) || ROW_PITCH;
            assignPositions(childId, depth + 1, currY);
            childYPositions.push(positions.get(childId)?.y ?? (currY + childH / 2));
            currY += childH;
        }

        // Center parent vertically at the midpoint of its children
        const y = Math.round((childYPositions[0] + childYPositions[childYPositions.length - 1]) / 2);
        positions.set(id, { x, y });
    }

    // Center root around y = 0
    assignPositions(root.id, 0, -totalHeight / 2);

    // 7. Format output ReactFlow nodes
    const formattedNodes: Node[] = rawNodes.map(n => {
        const pos = positions.get(n.id) || { x: 0, y: 0 };
        const color = nodeColorMap.get(n.id) || n.color || n.data?.color;
        const label = n.label || n.data?.label || n.id;
        const type = n.id === root.id ? 'central' : rootChildren.includes(n.id) ? 'branch' : 'leaf';

        return {
            id: n.id,
            type,
            position: pos,
            data: { label, color },
        };
    });

    // 8. Format edges with matching branch colors and smoothstep curvature
    const formattedEdges: Edge[] = rawEdges.map(e => {
        const sourceColor = nodeColorMap.get(e.source);
        const targetColor = nodeColorMap.get(e.target);
        const edgeColor = targetColor || sourceColor || '#6366f1';

        return {
            id: `${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            type: 'smoothstep',
            style: {
                stroke: edgeColor,
                strokeWidth: 1.75,
                opacity: 0.7,
            },
            animated: false,
        };
    });

    return { nodes: formattedNodes, edges: formattedEdges };
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
            const formatted = layoutTree(topicData.nodes, topicData.edges || []);
            setNodes(formatted.nodes);
            setEdges(formatted.edges);
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [activeTopic, existingMindMaps, setNodes, setEdges]);

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
    }, [activeTopic, fullContent, existingMindMaps, notebookId, onUpdateNotes, setNodes, setEdges]);

    const hasGraph = nodes.length > 0;

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
                        key={`${activeTopic?.id}-${nodes.length}`}
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
                            nodeColor={(node) => {
                                if (node.type === 'central') return '#6366f1';
                                return (node.data as any)?.color || '#3b4252';
                            }}
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
