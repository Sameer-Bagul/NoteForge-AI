import { useState, useCallback } from 'react';
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
import { GitBranch, Loader2, ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MindMapTabProps {
    topics: { id: string; title: string; subtopics: string[] }[];
    fullContent: string;
}

// ─── Custom Nodes ──────────────────────────────────────────────────────────────

function CentralNode({ data }: { data: { label: string } }) {
    return (
        <div className="px-5 py-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-center shadow-lg shadow-indigo-500/30 border-2 border-white/20 max-w-[200px]">
            <Handle type="source" position={Position.Right} className="opacity-0" />
            <Handle type="target" position={Position.Left} className="opacity-0" />
            <span className="text-sm leading-snug">{data.label}</span>
        </div>
    );
}

function BranchNode({ data }: { data: { label: string; color?: string } }) {
    return (
        <div
            className="px-4 py-2 rounded-xl text-white font-semibold text-center shadow-md max-w-[160px] border border-white/20"
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
        <div className="px-3 py-1.5 rounded-lg bg-card border border-border/70 text-foreground/80 text-center shadow-sm max-w-[140px]">
            <Handle type="source" position={Position.Right} className="opacity-0" />
            <Handle type="target" position={Position.Left} className="opacity-0" />
            <span className="text-[11px] leading-snug">{data.label}</span>
        </div>
    );
}

const nodeTypes: NodeTypes = {
    central: CentralNode,
    branch: BranchNode,
    leaf: LeafNode,
};

// ─── Tree Layout Helper ────────────────────────────────────────────────────────

function layoutTree(rawNodes: any[], rawEdges: any[]): { nodes: Node[]; edges: Edge[] } {
    if (!rawNodes.length) return { nodes: [], edges: [] };

    const root = rawNodes.find(n => n.id === 'root') || rawNodes[0];
    const branches = rawNodes.filter(n => n.type === 'branch');
    const leaves = rawNodes.filter(n => n.type === 'leaf');

    const branchCount = branches.length;
    const branchSpacing = 120;
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
            position: { x: 350, y: startY + i * branchSpacing },
            data: { label: b.label, color: b.color },
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
            const leafStartY = (parentNode?.position.y || 0) - ((count - 1) * 60) / 2;

            nodeMap.set(leaf.id, {
                id: leaf.id,
                type: 'leaf',
                position: { x: 680, y: leafStartY + idx * 60 },
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
        style: { stroke: '#6366f1', strokeWidth: 1.5, opacity: 0.6 },
        animated: false,
    }));

    return { nodes: Array.from(nodeMap.values()), edges };
}

// ─── Single Topic Mind Map ─────────────────────────────────────────────────────

function TopicMindMap({
    topic,
    fullContent,
    autoGenerate,
}: {
    topic: { id: string; title: string; subtopics: string[] };
    fullContent: string;
    autoGenerate?: boolean;
}) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.generateMindMap(
                topic.title,
                topic.subtopics,
                fullContent.slice(0, 3000),
            );
            const { nodes: lNodes, edges: lEdges } = layoutTree(data.nodes || [], data.edges || []);
            setNodes(lNodes);
            setEdges(lEdges);
            setGenerated(true);
        } catch (err) {
            setError('Failed to generate mind map. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [topic, fullContent]);

    return (
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card/40">
            {/* Topic header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/60">
                <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">{topic.title}</span>
                    <span className="text-xs text-muted-foreground">({topic.subtopics.length} subtopics)</span>
                </div>
                {!generated && (
                    <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="h-7 text-xs gap-1.5">
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                        {loading ? 'Generating…' : 'Generate Map'}
                    </Button>
                )}
            </div>

            {/* Canvas */}
            <div className="h-[380px] w-full">
                {!generated ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        {loading ? (
                            <><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-sm">Generating mind map…</p></>
                        ) : (
                            <><GitBranch className="w-10 h-10 opacity-30" /><p className="text-sm">Click Generate Map to visualize this topic</p></>
                        )}
                        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Controls className="!bg-card !border-border/60 !shadow-sm" />
                        <MiniMap
                            className="!bg-card !border-border/60"
                            nodeColor={(node) => node.type === 'central' ? '#6366f1' : node.type === 'branch' ? '#8b5cf6' : '#444'}
                        />
                        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.05)" />
                    </ReactFlow>
                )}
            </div>
        </div>
    );
}

// ─── Mind Map Tab ──────────────────────────────────────────────────────────────

export function MindMapTab({ topics, fullContent }: MindMapTabProps) {
    const [expanded, setExpanded] = useState<string | null>(topics[0]?.id ?? null);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Topic Mind Maps</h3>
                <span className="text-xs text-muted-foreground">Click "Generate Map" on any topic to visualize it</span>
            </div>

            {topics.map(topic => (
                <div key={topic.id}>
                    <button
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border/50 bg-card/60 hover:bg-card transition-colors text-left mb-2"
                        onClick={() => setExpanded(e => e === topic.id ? null : topic.id)}
                    >
                        <span className="font-medium text-sm">{topic.title}</span>
                        {expanded === topic.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {expanded === topic.id && (
                        <TopicMindMap topic={topic} fullContent={fullContent} />
                    )}
                </div>
            ))}
        </div>
    );
}
