import { Node, Edge } from '@xyflow/react';

export const BRANCH_COLORS = [
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#f43f5e', // Rose
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#3b82f6', // Blue
];

export const SIBLING_GAP = 18;
export const BRANCH_GAP = 44;
export const X_GAP = 300;

export function estimateNodeHeight(label: string, type?: string): number {
    if (type === 'central') return 54;
    if (type === 'branch') return 42;
    const len = (label || '').length;
    if (len <= 24) return 42;
    if (len <= 48) return 58;
    return 76;
}

export function layoutTree(
    rawNodes: any[],
    rawEdges: any[],
    edgeType: 'smoothstep' | 'bezier' = 'smoothstep'
): { nodes: Node[]; edges: Edge[] } {
    if (!rawNodes || !rawNodes.length) return { nodes: [], edges: [] };

    // 1. Build node lookup
    const nodeById = new Map<string, any>();
    rawNodes.forEach(n => {
        nodeById.set(n.id, n);
    });

    // 2. Identify root node
    let root = rawNodes.find(n => n.id === 'root' || n.type === 'central');
    if (!root) {
        const targets = new Set(rawEdges.map(e => e.target));
        root = rawNodes.find(n => !targets.has(n.id)) || rawNodes[0];
    }

    // 3. Spanning tree extraction (prevents cycles and DAG collision in vertical layout)
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();

    rawNodes.forEach(n => {
        childrenMap.set(n.id, []);
    });

    rawEdges.forEach(e => {
        if (nodeById.has(e.source) && nodeById.has(e.target)) {
            // Only add to spanning tree if target doesn't already have a parent and isn't self/root
            if (!parentMap.has(e.target) && e.target !== e.source && e.target !== root.id) {
                childrenMap.get(e.source)!.push(e.target);
                parentMap.set(e.target, e.source);
            }
        }
    });

    // 4. Attach any orphan nodes to root
    rawNodes.forEach(n => {
        if (n.id !== root.id && !parentMap.has(n.id)) {
            childrenMap.get(root.id)?.push(n.id);
            parentMap.set(n.id, root.id);
        }
    });

    // 5. Assign branch colors and propagate to all descendants
    const rootChildren = childrenMap.get(root.id) || [];
    const nodeColorMap = new Map<string, string>();

    rootChildren.forEach((bId, idx) => {
        const branchColor =
            nodeById.get(bId)?.data?.color ||
            nodeById.get(bId)?.color ||
            BRANCH_COLORS[idx % BRANCH_COLORS.length];
        nodeColorMap.set(bId, branchColor);

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

    // 6. Subtree bounding height calculation
    const subtreeHeight = new Map<string, number>();
    const visited = new Set<string>();

    function getGap(depth: number): number {
        return depth <= 1 ? BRANCH_GAP : SIBLING_GAP;
    }

    function calcHeight(nid: string, depth: number): number {
        if (visited.has(nid)) return 42;
        visited.add(nid);

        const kids = (childrenMap.get(nid) || []).filter(c => c !== nid);
        const node = nodeById.get(nid);
        const selfH = estimateNodeHeight(
            node?.label || node?.data?.label || nid,
            node?.type
        );

        if (kids.length === 0) {
            subtreeHeight.set(nid, selfH);
            return selfH;
        }

        const gap = getGap(depth + 1);
        let totalKidsH = 0;
        kids.forEach((cid, idx) => {
            const ch = calcHeight(cid, depth + 1);
            totalKidsH += ch;
            if (idx > 0) totalKidsH += gap;
        });

        const h = Math.max(selfH, totalKidsH);
        subtreeHeight.set(nid, h);
        return h;
    }

    calcHeight(root.id, 0);
    visited.clear();

    // 7. Pre-order position assignment in non-overlapping vertical slices
    const positions = new Map<string, { x: number; y: number }>();

    function assignPositions(nid: string, depth: number, topY: number) {
        if (visited.has(nid)) return;
        visited.add(nid);

        const kids = (childrenMap.get(nid) || []).filter(c => c !== nid);
        const h = subtreeHeight.get(nid) || 42;
        const x = depth * X_GAP;

        if (kids.length === 0) {
            positions.set(nid, { x, y: Math.round(topY + h / 2) });
            return;
        }

        const gap = getGap(depth + 1);
        const kidsTotalH =
            kids.reduce((acc, cid) => acc + (subtreeHeight.get(cid) || 42), 0) +
            (kids.length - 1) * gap;

        // Center children vertically within parent's allocated slice
        let currY = topY + Math.max(0, (h - kidsTotalH) / 2);
        const childYList: number[] = [];

        for (const cid of kids) {
            const ch = subtreeHeight.get(cid) || 42;
            assignPositions(cid, depth + 1, currY);
            childYList.push(positions.get(cid)?.y ?? (currY + ch / 2));
            currY += ch + gap;
        }

        const y = childYList.length > 0
            ? Math.round((childYList[0] + childYList[childYList.length - 1]) / 2)
            : Math.round(topY + h / 2);

        positions.set(nid, { x, y });
    }

    const totalHeight = subtreeHeight.get(root.id) || 400;
    assignPositions(root.id, 0, -totalHeight / 2);

    // 8. Format output ReactFlow nodes
    const formattedNodes: Node[] = rawNodes.map(n => {
        const pos = positions.get(n.id) || { x: 0, y: 0 };
        const color = nodeColorMap.get(n.id) || n.color || n.data?.color;
        const label = n.label || n.data?.label || n.id;
        const type = n.id === root.id ? 'central' : rootChildren.includes(n.id) ? 'branch' : 'leaf';

        return {
            id: n.id,
            type,
            origin: [0, 0.5] as [number, number],
            position: pos,
            data: { label, color },
        };
    });

    // 9. Format output ReactFlow edges
    const formattedEdges: Edge[] = rawEdges.map(e => {
        const sourceColor = nodeColorMap.get(e.source);
        const targetColor = nodeColorMap.get(e.target);
        const edgeColor = targetColor || sourceColor || '#6366f1';

        return {
            id: `${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            type: edgeType,
            pathOptions: edgeType === 'smoothstep' ? { borderRadius: 16 } : undefined,
            style: {
                stroke: edgeColor,
                strokeWidth: 2,
                opacity: 0.82,
            },
            animated: false,
        };
    });

    return { nodes: formattedNodes, edges: formattedEdges };
}

