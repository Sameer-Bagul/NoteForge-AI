import { describe, it, expect } from 'vitest';
import { layoutTree } from '@/services/mindmap/layout';

describe('Mind Map Collision-Free Layout Algorithm', () => {
    it('should layout Rust in 100 Seconds concept map with zero overlapping nodes', () => {
        const rawNodes = [
            { id: 'root', type: 'central', label: 'Rust in 100 Seconds' },
            { id: 'intro', type: 'branch', label: 'Intro' },
            { id: 'history', type: 'branch', label: 'History' },
            { id: 'memory', type: 'branch', label: 'Memory Safety' },
            { id: 'cargo', type: 'branch', label: 'Cargo' },
            { id: 'outro', type: 'branch', label: 'Outro' },
            { id: 'intro_perf', type: 'leaf', label: 'High performance like C/C++' },
            { id: 'intro_gc', type: 'leaf', label: 'No runtime garbage collector' },
            { id: 'intro_use', type: 'leaf', label: 'Systems & WebAssembly' },
            { id: 'hist_origins', type: 'leaf', label: 'Started in 2007 by Graydon Hoare' },
            { id: 'hist_mozilla', type: 'leaf', label: 'Mozilla sponsorship in 2009' },
            { id: 'hist_loved', type: 'leaf', label: 'Most loved language since 2016' },
            { id: 'mem_no_gc', type: 'leaf', label: 'Avoids GC runtime overhead' },
            { id: 'mem_manual', type: 'leaf', label: 'Avoids manual malloc/free errors' },
            { id: 'mem_safe', type: 'leaf', label: 'Compile-time safety checks' },
            { id: 'cargo_pkg', type: 'leaf', label: 'Package manager and build system' },
            { id: 'cargo_deps', type: 'leaf', label: 'Manages project dependencies' },
            { id: 'outro_fast', type: 'leaf', label: 'Fast, safe, and modern' },
            { id: 'outro_rustaceans', type: 'leaf', label: 'Community of Rustaceans' },
        ];

        const rawEdges = [
            { source: 'root', target: 'intro' },
            { source: 'root', target: 'history' },
            { source: 'root', target: 'memory' },
            { source: 'root', target: 'cargo' },
            { source: 'root', target: 'outro' },
            { source: 'intro', target: 'intro_perf' },
            { source: 'intro', target: 'intro_gc' },
            { source: 'intro', target: 'intro_use' },
            { source: 'history', target: 'hist_origins' },
            { source: 'history', target: 'hist_mozilla' },
            { source: 'history', target: 'hist_loved' },
            { source: 'memory', target: 'mem_no_gc' },
            { source: 'memory', target: 'mem_manual' },
            { source: 'memory', target: 'mem_safe' },
            { source: 'cargo', target: 'cargo_pkg' },
            { source: 'cargo', target: 'cargo_deps' },
            { source: 'outro', target: 'outro_fast' },
            { source: 'outro', target: 'outro_rustaceans' },
        ];

        const { nodes, edges } = layoutTree(rawNodes, rawEdges, 'smoothstep');

        expect(nodes.length).toBe(19);
        expect(edges.length).toBe(18);

        // Group nodes by column (depth)
        const nodesByCol = new Map<number, typeof nodes>();
        nodes.forEach(n => {
            const col = Math.round(n.position.x / 300);
            if (!nodesByCol.has(col)) nodesByCol.set(col, []);
            nodesByCol.get(col)!.push(n);
        });

        // Verify root is at column 0
        expect(nodesByCol.get(0)?.length).toBe(1);
        expect(nodesByCol.get(0)?.[0].id).toBe('root');

        // Verify branches are at column 1
        expect(nodesByCol.get(1)?.length).toBe(5);

        // Verify leaves are at column 2
        const leaves = nodesByCol.get(2) || [];
        expect(leaves.length).toBe(13);

        // Sort leaves vertically and verify clearance
        leaves.sort((a, b) => a.position.y - b.position.y);
        for (let i = 0; i < leaves.length - 1; i++) {
            const curr = leaves[i];
            const next = leaves[i + 1];
            const yDist = next.position.y - curr.position.y;
            // Center distance must be strictly >= 50px (minimum clearance between node centers)
            expect(yDist).toBeGreaterThanOrEqual(50);
        }

        // Verify that parent branch is vertically centered relative to its children
        const introLeaves = leaves.filter(l => l.id.startsWith('intro_'));
        const introBranch = nodes.find(n => n.id === 'intro')!;
        const expectedIntroY = Math.round((introLeaves[0].position.y + introLeaves[introLeaves.length - 1].position.y) / 2);
        expect(introBranch.position.y).toBe(expectedIntroY);

        // Verify edge options
        expect(edges[0].type).toBe('smoothstep');
        expect(edges[0].pathOptions).toEqual({ borderRadius: 16 });
        expect(edges[0].style?.strokeWidth).toBe(2);
    });

    it('should handle DAG cross-edges and orphan nodes gracefully without cycle traps', () => {
        const rawNodes = [
            { id: 'root', type: 'central', label: 'Main Concept' },
            { id: 'branchA', type: 'branch', label: 'Branch A' },
            { id: 'branchB', type: 'branch', label: 'Branch B' },
            { id: 'leaf1', type: 'leaf', label: 'Leaf 1' },
            { id: 'leaf2', type: 'leaf', label: 'Leaf 2' },
            { id: 'orphan1', type: 'leaf', label: 'Orphan Leaf' },
        ];

        const rawEdges = [
            { source: 'root', target: 'branchA' },
            { source: 'root', target: 'branchB' },
            { source: 'branchA', target: 'leaf1' },
            { source: 'branchB', target: 'leaf2' },
            // Cross-edges and cycle
            { source: 'branchA', target: 'leaf2' }, // DAG edge: leaf2 has 2 parents
            { source: 'leaf1', target: 'branchA' }, // Back edge / cycle
        ];

        const { nodes, edges } = layoutTree(rawNodes, rawEdges, 'bezier');

        expect(nodes.length).toBe(6);
        // All nodes must have finite valid positions
        nodes.forEach(n => {
            expect(Number.isFinite(n.position.x)).toBe(true);
            expect(Number.isFinite(n.position.y)).toBe(true);
            expect(n.origin).toEqual([0, 0.5]);
        });

        // Edges should use bezier
        expect(edges[0].type).toBe('bezier');
    });

    it('should enforce distinct spacing between sibling leaves and separate branch clusters', () => {
        const rawNodes = [
            { id: 'root', type: 'central', label: 'Root' },
            { id: 'b1', type: 'branch', label: 'Branch 1' },
            { id: 'b2', type: 'branch', label: 'Branch 2' },
            { id: 'l1_1', type: 'leaf', label: 'Leaf 1.1' },
            { id: 'l1_2', type: 'leaf', label: 'Leaf 1.2' },
            { id: 'l2_1', type: 'leaf', label: 'Leaf 2.1' },
            { id: 'l2_2', type: 'leaf', label: 'Leaf 2.2' },
        ];

        const rawEdges = [
            { source: 'root', target: 'b1' },
            { source: 'root', target: 'b2' },
            { source: 'b1', target: 'l1_1' },
            { source: 'b1', target: 'l1_2' },
            { source: 'b2', target: 'l2_1' },
            { source: 'b2', target: 'l2_2' },
        ];

        const { nodes } = layoutTree(rawNodes, rawEdges);
        const l1_1 = nodes.find(n => n.id === 'l1_1')!;
        const l1_2 = nodes.find(n => n.id === 'l1_2')!;
        const l2_1 = nodes.find(n => n.id === 'l2_1')!;
        const l2_2 = nodes.find(n => n.id === 'l2_2')!;

        const siblingDist = l1_2.position.y - l1_1.position.y;
        const clusterDist = l2_1.position.y - l1_2.position.y;

        // Cluster gap between branch 1 and branch 2 must be greater than sibling gap within branch 1
        expect(clusterDist).toBeGreaterThan(siblingDist);
    });
});
