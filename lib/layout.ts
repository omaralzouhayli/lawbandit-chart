// lib/layout.ts
import dagre from 'dagre';
import type { Node, Edge, XYPosition } from 'reactflow';

type Direction = 'TB' | 'LR'; // top-bottom or left-right

const nodeWidth = 180;
const nodeHeight = 56;

export function layout(nodes: Node[], edges: Edge[], direction: Direction = 'TB') {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: direction });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
    edges.forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);

    const newNodes = nodes.map((n) => {
        const pos = g.node(n.id) as { x: number; y: number };
        const position: XYPosition = { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 };
        return { ...n, position };
    });

    return { nodes: newNodes, edges };
}
