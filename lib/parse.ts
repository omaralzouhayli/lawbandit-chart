// lib/parse.ts
import type { Node, Edge } from 'reactflow';

function normalizeLabel(s: string) {
    return s.replace(/\s+/g, ' ').trim();
}

export function parseTextToDiagram(input: string): { nodes: Node[]; edges: Edge[] } {
    const text = (input || '').trim();
    if (!text) return { nodes: [], edges: [] };

    // Split into non-empty lines
    const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // Support two simple patterns:
    // 1) Relation lines: "A -> B" or "A → B" (multiple lines OK)
    // 2) Plain list/steps: each line is a node; connect sequentially (A -> B -> C)
    const arrows = /\s*(?:->|→)\s*/;

    type IdMap = Record<string, string>;
    const idByLabel: IdMap = {};
    let nextNodeId = 1;
    let nextEdgeId = 1;

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const ensureNode = (label: string) => {
        const lab = normalizeLabel(label);
        if (!lab) return null;
        if (!idByLabel[lab]) {
            const id = `n${nextNodeId++}`;
            idByLabel[lab] = id;
            nodes.push({
                id,
                type: 'card',
                position: { x: 0, y: 0 }, // layout later
                data: { label: lab },
            });
        }
        return idByLabel[lab];
    };

    // Detect if any line has an arrow
    const hasArrows = rawLines.some((l) => arrows.test(l));

    if (hasArrows) {
        for (const line of rawLines) {
            const parts = line.split(arrows).map(normalizeLabel).filter(Boolean);
            // Allow "A -> B -> C" on a single line
            for (let i = 0; i + 1 < parts.length; i++) {
                const a = ensureNode(parts[i]);
                const b = ensureNode(parts[i + 1]);
                if (a && b) {
                    edges.push({
                        id: `e${nextEdgeId++}`,
                        source: a,
                        target: b,
                        type: 'bezier',
                    });
                }
            }
        }
    } else {
        // Sequential chain if ≥ 2 lines
        if (rawLines.length < 2) return { nodes: [], edges: [] };
        const labels = rawLines.map(normalizeLabel).filter(Boolean);
        for (const lab of labels) ensureNode(lab);
        for (let i = 0; i + 1 < labels.length; i++) {
            const a = idByLabel[labels[i]];
            const b = idByLabel[labels[i + 1]];
            if (a && b) {
                edges.push({
                    id: `e${nextEdgeId++}`,
                    source: a,
                    target: b,
                    type: 'bezier',
                });
            }
        }
    }

    return { nodes, edges };
}
