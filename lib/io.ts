// lib/io.ts
import type { Node, Edge } from 'reactflow';

export type DiagramJSON = { nodes: Node[]; edges: Edge[] };

export function downloadJSON(data: DiagramJSON, filename = 'diagram.json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function readJSONFile(file: File): Promise<DiagramJSON> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error);
        fr.onload = () => {
            try {
                const parsed = JSON.parse(String(fr.result));
                if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
                    throw new Error('Invalid file format: expected { nodes: [], edges: [] }');
                }
                resolve(parsed);
            } catch (e) {
                reject(e);
            }
        };
        fr.readAsText(file);
    });
}
