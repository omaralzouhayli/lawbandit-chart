'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { parseTextToDiagram } from '@/lib/parse';
import { themes, type ThemeName } from '@/lib/theme';
import ReactFlow, {
    Background,
    Controls,
    addEdge,
    MiniMap,
    Connection,
    useUpdateNodeInternals,
    Edge,
    Node,
    OnConnect,
    OnEdgesChange,
    OnNodesChange,
    applyNodeChanges,
    applyEdgeChanges,
    MarkerType,
    useReactFlow, 
    getBezierPath,
    Position,
    updateEdge,
    ConnectionMode,
    ReactFlowProvider,
    ConnectionLineType,
 } from 'reactflow';

import 'reactflow/dist/style.css';

import { toSvg } from 'html-to-image';
import { downloadJSON, readJSONFile } from '@/lib/io';
import { layout } from '@/lib/layout';
import NodeCard from '@/components/NodeCard';


const nodeTypes = { card: NodeCard };
const THEME_KEYS = {
    '--canvas-bg': 'canvasBg',
    '--node-bg': 'nodeBg',
    '--node-border': 'nodeBorder',
    '--node-border-selected': 'nodeBorderSelected',
    '--node-text': 'nodeText',
    '--edge-stroke': 'edgeStroke',
    '--edge-label-text': 'edgeLabelText',
    '--edge-label-bg': 'edgeLabelBg',
    '--grid-color': 'gridColor',
} as const;


// --- initial diagram ---
const initialNodes: Node[] = [
    { id: 'n1', type: 'card', position: { x: 0, y: 0 }, data: { label: 'Start' }, connectable: true, draggable: true, selectable: true },
    { id: 'n2', type: 'card', position: { x: 220, y: 140 }, data: { label: 'Result' }, connectable: true, draggable: true, selectable: true },
];

const initialEdges: Edge[] = [
    {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'bezier', // <-- fully curved like your PNG render
        style: { stroke: '#9CA3AF', strokeWidth: 2 }, // match PNG color/width
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#9CA3AF' },
        label: 'leads to',
        labelStyle: { fill: '#111827', fontSize: 12 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#ffffff' }, // no border, just white bg
    },
];

function Diagram() {
    const [themeName, setThemeName] = useState<ThemeName>('light');
    const theme = themes[themeName];
    const updateNodeInternals = useUpdateNodeInternals();
    const { fitView } = useReactFlow();
    const shellRef = useRef<HTMLElement | null>(null);
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [counter, setCounter] = useState(3);
    const [layoutDir, setLayoutDir] = useState<'TB' | 'LR'>('TB');
    const [isGenOpen, setIsGenOpen] = useState(false);

    // container for React Flow (used for export)
    const canvasRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = shellRef.current;
        if (!el) return;
        const t = theme as any;
        (Object.keys(THEME_KEYS) as Array<keyof typeof THEME_KEYS>).forEach((cssVar) => {
            const k = THEME_KEYS[cssVar];
            el.style.setProperty(cssVar, String(t[k]));
        });
    }, [theme]);

    useEffect(() => {
        setEdges((eds) =>
            eds.map((e) => {
                const style = Object.assign({}, e.style ?? {}, {
                    stroke: theme.edgeStroke,
                    strokeWidth: 2,
                });

                const markerEnd = Object.assign({}, e.markerEnd ?? {}, {
                    type: MarkerType.ArrowClosed,
                    color: theme.edgeStroke,
                });

                const labelStyle = Object.assign({}, e.labelStyle ?? {}, {
                    fill: theme.edgeLabelText,
                    fontSize: 12,
                });

                const labelBgStyle = Object.assign({}, e.labelBgStyle ?? {}, {
                    fill: theme.edgeLabelBg,
                });

                return Object.assign({}, e, {
                    style,
                    markerEnd,
                    labelStyle,
                    labelBgPadding: [4, 2] as [number, number],
                    labelBgBorderRadius: 4,
                    labelBgStyle,
                });
            })
        );
    }, [theme, setEdges]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                setEdges((eds) => eds.filter((e) => !e.selected));
                setNodes((nds) => nds.filter((n) => !n.selected));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    function reattachEdgesByDirection(
        edges: Edge[],
        nodes: Node[],
        dir: 'TB' | 'LR'
    ): Edge[] {
        const byId = new Map(nodes.map((n) => [n.id, n]));
        return edges.map((e) => {
            const s = byId.get(e.source);
            const t = byId.get(e.target);
            if (!s || !t) return e;

            if (dir === 'TB') {
                const goingDown = t.position.y >= s.position.y;
                return {
                    ...e,
                    // explicitly clear any old source handle
                    sourceHandle: undefined,
                    targetHandle: goingDown ? 'top_t' : 'bottom_t',
                };
            } else {
                const goingRight = t.position.x >= s.position.x;
                return {
                    ...e,
                    sourceHandle: undefined,
                    targetHandle: goingRight ? 'left_t' : 'right_t',
                };
            }
        });
    }




    // built-in change handlers
    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );
    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );
    const onConnect: OnConnect = useCallback(
        (conn: Connection) => {
            setEdges((eds) => addEdge({ ...conn, type: 'bezier' }, eds));
        },
        []
    );
    const onEdgeUpdate = useCallback(
        (oldEdge: Edge, newConnection: Connection) => {
            setEdges((eds) => updateEdge(oldEdge, newConnection, eds));
        },
        []
    );

    // actions
    const handleAddNode = () => {
        const id = `n${counter}`;
        setCounter((c) => c + 1);

        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'card',
                position: { x: 120, y: 60 },
                data: { label: `Node ${id}` },
                connectable: true,
                draggable: true,
                selectable: true,
            },
        ]);

        // Refresh handle geometry for the new node next frame
        requestAnimationFrame(() => {
            updateNodeInternals(id);
        });
    };

    const handleNodeDoubleClick = (_: any, node: Node) => {
        const newLabel = prompt('Rename node:', String(node.data?.label ?? ''));
        if (newLabel === null) return;
        setNodes((nds) =>
            nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n))
        );
    };

    const handleDeleteSelected = () => {
        setNodes((nds) => nds.filter((n) => !n.selected));
        setEdges((eds) => eds.filter((e) => !e.selected));
    };

    const handleAutoLayout = () => {
        // 1) run Dagre
        const { nodes: laidOut } = layout(nodes, edges, layoutDir);

        // 2) set node positions
        setNodes(laidOut);

        // 3) next frame: refresh handle geometry so RF has correct bounds
        requestAnimationFrame(() => {
            // tell RF to recompute handle bounds for every node
            for (const n of laidOut) {
                updateNodeInternals(n.id);
            }

            // now safely reattach edges to the correct target sides
            setEdges((prev) => reattachEdgesByDirection(prev, laidOut, layoutDir));
            fitView();
            // optional fit
            // (if you were calling rf.fitView() before, we’ll swap it later)
        });
    };



    const handleGenerate = () => setIsGenOpen(true);

    const handleCloseGenerate = () => setIsGenOpen(false);

    const handleGenerateRun = () => {
        const ta = document.getElementById('gen-input') as HTMLTextAreaElement | null;
        const text = ta?.value?.trim() ?? '';
        const { nodes: genNodes, edges: genEdges } = parseTextToDiagram(text);

        if (!genNodes.length || !genEdges.length) {
            alert('Please provide structure like "A -> B" (one per line) or a list of at least two lines.');
            return;
        }

        // Auto-layout the result (top-to-bottom by default)
        const laid = layout(genNodes, genEdges, layoutDir);
        setNodes(laid.nodes);
        setEdges(reattachEdgesByDirection(laid.edges, laid.nodes, layoutDir));
        setIsGenOpen(false);
        // refresh handle bounds next frame so edges won't disappear
        requestAnimationFrame(() => {
            laid.nodes.forEach((n) => updateNodeInternals(n.id));
        });


        // Optional: advance counter so future "Add Node" IDs don't collide
        const maxId = genNodes.reduce((m, n) => Math.max(m, parseInt(n.id.replace('n', '')) || 0), 0);
        setCounter(maxId + 1);
    };


    // --- selection helpers: clear during export to avoid thick borders, then restore ---
    const clearSelectionTemporarily = () => {
        const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
        const selectedEdgeIds = edges.filter((e) => e.selected).map((e) => e.id);
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
        return { selectedNodeIds, selectedEdgeIds };
    };

    const restoreSelection = (sel: { selectedNodeIds: string[]; selectedEdgeIds: string[] }) => {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: sel.selectedNodeIds.includes(n.id) })));
        setEdges((eds) => eds.map((e) => ({ ...e, selected: sel.selectedEdgeIds.includes(e.id) })));
    };

    // --- Export: SVG (always includes edges) ---
    const handleExportSVG = async () => {
        const target = canvasRef.current?.querySelector('.react-flow') as HTMLElement | null;
        if (!target) return;

        const sel = clearSelectionTemporarily();
        await new Promise((r) => requestAnimationFrame(() => r(null)));

        try {
            const svgDataUrl = await toSvg(target, {
                cacheBust: true,
                backgroundColor: theme.canvasBg,
                pixelRatio: 2,
                filter: (node) => {
                    const cls = (node as HTMLElement).classList;
                    if (!cls) return true;
                    return (
                        !cls.contains('react-flow__minimap') &&
                        !cls.contains('react-flow__controls') &&
                        !cls.contains('react-flow__attribution')
                    );
                },
            });

            const a = document.createElement('a');
            a.href = svgDataUrl;
            a.download = 'diagram.svg';
            a.click();
        } catch (err: any) {
            alert(`Could not export SVG: ${err?.message ?? err}`);
        } finally {
            restoreSelection(sel);
        }
    };

    // --- Export: PNG by first generating the exact SVG, then rasterizing it ---
    const handleExportPNG = async () => {
        const target = canvasRef.current?.querySelector('.react-flow') as HTMLElement | null;
        if (!target) return;

        // clear selection so borders don’t look thicker in the export
        const sel = clearSelectionTemporarily();
        await new Promise((r) => requestAnimationFrame(() => r(null)));

        try {
            // 1) generate the SAME SVG we download (this is already pixel-perfect)
            const svgDataUrl = await toSvg(target, {
                cacheBust: true,
                backgroundColor: theme.canvasBg,
                pixelRatio: 2,
                filter: (node) => {
                    const cls = (node as HTMLElement).classList;
                    if (!cls) return true;
                    return (
                        !cls.contains('react-flow__minimap') &&
                        !cls.contains('react-flow__controls') &&
                        !cls.contains('react-flow__attribution')
                    );
                },
            });

            // 2) rasterize that SVG data URL into a PNG via an offscreen <canvas>
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const w = img.naturalWidth || 1600;
                const h = img.naturalHeight || 900;
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                ctx.fillStyle = theme.canvasBg;
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'diagram.png';
                    a.click();
                    URL.revokeObjectURL(url);
                }, 'image/png');
            };
            img.onerror = () => alert('Could not render PNG from SVG.');
            img.src = svgDataUrl;
        } catch (err: any) {
            alert(`Could not export PNG: ${err?.message ?? err}`);
        } finally {
            restoreSelection(sel);
        }
    };

    // --- Export: PNG via canvas using EXACT handles + React Flow's bezier path ---
    const handleExportPNGCanvas = async () => {
        const NODE_W = 180;
        const NODE_H = 56;
        const PADDING = 40;
        const FONT = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        const EDGE_COLOR = '#9CA3AF';
        const NODE_BORDER = '#E5E7EB';
        const TEXT_COLOR = '#111827';
        const BG = '#ffffff';

        if (!nodes.length) return;

        // Compute bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach((n) => {
            const x = n.position.x;
            const y = n.position.y;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + NODE_W);
            maxY = Math.max(maxY, y + NODE_H);
        });

        const width = Math.ceil((maxX - minX) + PADDING * 2);
        const height = Math.ceil((maxY - minY) + PADDING * 2);

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Node geometry in export space
        const geo: Record<string, { x: number; y: number; cx: number; cy: number; label: string }> = {};
        nodes.forEach((n) => {
            const x = (n.position.x - minX) + PADDING;
            const y = (n.position.y - minY) + PADDING;
            const cx = x + NODE_W / 2;
            const cy = y + NODE_H / 2;
            const label = String(n.data?.label ?? '');
            geo[n.id] = { x, y, cx, cy, label };
        });

        // Map a handle id ("top", "right_t", etc.) to a Position
        const handleIdToPosition = (hid?: string | null): Position | undefined => {
            if (!hid) return undefined; // handles undefined OR null
            const key = hid.replace(/_t$/, '').toLowerCase();
            if (key === 'top') return Position.Top;
            if (key === 'right') return Position.Right;
            if (key === 'bottom') return Position.Bottom;
            if (key === 'left') return Position.Left;
            return undefined;
        };


        // Fallback if a handle isn't present (e.g., initialEdges)
        const fallbackPos = (sx: number, sy: number, tx: number, ty: number): { sp: Position; tp: Position } => {
            const dx = tx - sx;
            const dy = ty - sy;
            if (Math.abs(dx) >= Math.abs(dy)) {
                // horizontal
                return {
                    sp: dx >= 0 ? Position.Right : Position.Left,
                    tp: dx >= 0 ? Position.Left : Position.Right,
                };
            } else {
                // vertical
                return {
                    sp: dy >= 0 ? Position.Bottom : Position.Top,
                    tp: dy >= 0 ? Position.Top : Position.Bottom,
                };
            }
        };

        // Edges under nodes
        ctx.lineWidth = 2;
        ctx.strokeStyle = EDGE_COLOR;
        ctx.fillStyle = EDGE_COLOR;

        edges.forEach((e) => {
            const s = geo[e.source];
            const t = geo[e.target];
            if (!s || !t) return;

            // Use EXACT sides if available from handles; else fallback heuristic
            let sp = handleIdToPosition(e.sourceHandle);
            let tp = handleIdToPosition(e.targetHandle);
            if (!sp || !tp) {
                const fb = fallbackPos(s.cx, s.cy, t.cx, t.cy);
                sp = sp ?? fb.sp;
                tp = tp ?? fb.tp;
            }

            // Concrete anchor points on node border based on side
            const sourceX = sp === Position.Left ? s.x : sp === Position.Right ? s.x + NODE_W : s.cx;
            const sourceY = sp === Position.Top ? s.y : sp === Position.Bottom ? s.y + NODE_H : s.cy;
            const targetX = tp === Position.Left ? t.x : tp === Position.Right ? t.x + NODE_W : t.cx;
            const targetY = tp === Position.Top ? t.y : tp === Position.Bottom ? t.y + NODE_H : t.cy;

            // Exact bezier path (same math as on-screen)
            const [pathD, labelX, labelY] = getBezierPath({
                sourceX,
                sourceY,
                sourcePosition: sp,
                targetX,
                targetY,
                targetPosition: tp,
            });

            // Stroke the path
            const p = new Path2D(pathD);
            ctx.stroke(p);

            // Arrowhead oriented along the path: use last control point from the "C" command
            let c2x = targetX, c2y = targetY; // fallback
            const m = pathD.match(/C\s*([-\d.]+),\s*([-\d.]+)\s*([-\d.]+),\s*([-\d.]+)\s*([-\d.]+),\s*([-\d.]+)/i);
            if (m) {
                // const c1x = parseFloat(m[1]); const c1y = parseFloat(m[2]);
                c2x = parseFloat(m[3]); c2y = parseFloat(m[4]);
                // const txp = parseFloat(m[5]); const typ = parseFloat(m[6]);
            }
            const angle = Math.atan2(targetY - c2y, targetX - c2x);
            const ah = 8;
            ctx.beginPath();
            ctx.moveTo(targetX, targetY);
            ctx.lineTo(targetX - ah * Math.cos(angle - Math.PI / 6), targetY - ah * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(targetX - ah * Math.cos(angle + Math.PI / 6), targetY - ah * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();

            // Label at React Flow's provided label point
            if (e.label) {
                ctx.font = FONT;
                const text = String(e.label);
                const tw = ctx.measureText(text).width;
                const padX = 6;
                // white bg, NO border
                ctx.fillStyle = BG;
                roundRect(ctx, labelX - tw / 2 - padX, labelY - 16, tw + padX * 2, 18, 4, true, false);
                // text
                ctx.fillStyle = TEXT_COLOR;
                ctx.fillText(text, labelX - tw / 2, labelY - 3);
                // restore stroke/fill for next edge
                ctx.fillStyle = EDGE_COLOR;
                ctx.strokeStyle = EDGE_COLOR;
            }
        });

        // Nodes on top
        nodes.forEach((n) => {
            const g = geo[n.id];
            if (!g) return;
            ctx.fillStyle = BG;
            ctx.strokeStyle = NODE_BORDER;
            ctx.lineWidth = 1.5;
            roundRect(ctx, g.x, g.y, NODE_W, NODE_H, 8, true, true);

            ctx.font = FONT;
            ctx.fillStyle = TEXT_COLOR;
            const text = g.label || '';
            const tw = ctx.measureText(text).width;
            ctx.fillText(text, g.cx - tw / 2, g.cy + 4);
        });

        // Download
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'diagram.png';
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');

        function roundRect(
            cx: CanvasRenderingContext2D,
            x: number,
            y: number,
            w: number,
            h: number,
            r: number,
            fill: boolean,
            stroke: boolean
        ) {
            const radius = Math.min(r, w / 2, h / 2);
            cx.beginPath();
            cx.moveTo(x + radius, y);
            cx.lineTo(x + w - radius, y);
            cx.quadraticCurveTo(x + w, y, x + w, y + radius);
            cx.lineTo(x + w, y + h - radius);
            cx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            cx.lineTo(x + radius, y + h);
            cx.quadraticCurveTo(x, y + h, x, y + h - radius);
            cx.lineTo(x, y + radius);
            cx.quadraticCurveTo(x, y, x + radius, y);
            cx.closePath();
            if (fill) cx.fill();
            if (stroke) cx.stroke();
        }
    };



    return (
        <main ref={shellRef} className="h-screen w-screen p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                {/* Left cluster */}
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={handleGenerate} className="px-3 py-1 rounded-md bg-black text-white">
                        Generate
                    </button>

                    <button onClick={handleAddNode} className="px-3 py-1 rounded-md border">
                        + Add Node
                    </button>

                    <button onClick={handleDeleteSelected} className="px-3 py-1 rounded-md border">
                        Delete Selected
                    </button>

                    <button onClick={handleAutoLayout} className="px-3 py-1 rounded-md border">
                        Auto-Layout
                    </button>

                    <select
                        value={layoutDir}
                        onChange={(e) => setLayoutDir(e.target.value as 'TB' | 'LR')}
                        className="px-2 py-1 rounded-md border"
                        title="Layout direction"
                    >
                        <option value="TB">Top → Bottom</option>
                        <option value="LR">Left → Right</option>
                    </select>

                    <button onClick={() => downloadJSON({ nodes, edges })} className="px-3 py-1 rounded-md border">
                        Export JSON
                    </button>

                    <label className="px-3 py-1 rounded-md border cursor-pointer">
                        Import JSON
                        <input
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                    const data = await readJSONFile(file);
                                    setNodes(data.nodes);
                                    setEdges(data.edges);

                                    // refresh handle bounds next frame so edges won't disappear
                                    requestAnimationFrame(() => {
                                        data.nodes.forEach((n) => updateNodeInternals(n.id));
                                    });

                                } catch (err: any) {
                                    alert(`Could not load file: ${err?.message ?? err}`);
                                } finally {
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                    </label>

                    <button onClick={handleExportSVG} className="px-3 py-1 rounded-md border">
                        Export SVG
                    </button>
                    <button onClick={handleExportPNG} className="px-3 py-1 rounded-md border">
                        Export PNG
                    </button>
                </div>

                {/* Right cluster: Theme */}
                <div className="flex items-center gap-2">
                    <span className="text-sm">Theme:</span>
                    <select
                        value={themeName}
                        onChange={(e) => setThemeName(e.target.value as ThemeName)}
                        className="rounded-md border px-2 py-1"
                    >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="contrast">High contrast</option>
                    </select>
                </div>
            </div>

            {/* Generate Sidebar (UI only) */}
            <div
                className={`fixed top-0 right-0 h-full w-[360px] max-w-[90vw] border-l bg-[var(--canvas-bg)] transition-transform duration-200 ${isGenOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                style={{ borderColor: 'var(--node-border)', zIndex: 50 }}
            >
                <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--node-border)' }}>
                    <h2 className="text-sm" style={{ color: 'var(--node-text)' }}>Text → Diagram</h2>
                    <button onClick={handleCloseGenerate} className="px-2 py-1 rounded border text-sm">
                        Close
                    </button>
                </div>

                <div className="p-4 flex flex-col gap-2">
                    <label className="text-xs" style={{ color: 'var(--node-text)' }}>
                        Paste text or notes
                    </label>
                    <textarea
                        id="gen-input"
                        className="w-full h-48 rounded-md border p-2 text-sm outline-none"
                        placeholder="Example: Steps for civil procedure…"
                        style={{
                            background: 'var(--node-bg)',
                            color: 'var(--node-text)',
                            borderColor: 'var(--node-border)',
                        }}
                    />
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded-md bg-black text-white"
                            onClick={handleGenerateRun}
                        >
                            Generate Diagram
                        </button>
                        <button
                            className="px-3 py-1 rounded-md border"
                            onClick={() => {
                                const ta = document.getElementById('gen-input') as HTMLTextAreaElement | null;
                                if (ta) ta.value = '';
                            }}
                        >
                            Clear
                        </button>
                    </div>
                    <p className="text-xs opacity-75" style={{ color: 'var(--node-text)' }}>
                        Tip: Use short lines like “A → B”, “B → C” or numbered steps. We’ll add smarter parsing next.
                    </p>
                </div>
            </div>

            <div
                ref={canvasRef}
                className="h-[85vh] w-full border rounded-xl overflow-hidden bg-[var(--canvas-bg)]"
                style={{ borderColor: 'var(--node-border)' }}
            >
                <ReactFlow
                    nodesConnectable
                    nodesDraggable
                    elementsSelectable
                    edgesFocusable
                    edgesUpdatable
                    connectionMode={ConnectionMode.Loose}     // <-- use enum, not "loose" string
                    connectOnClick
                    connectionRadius={30}
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onEdgeUpdate={onEdgeUpdate}
                    fitView
                    proOptions={{ hideAttribution: true }}
                    defaultEdgeOptions={{
                        type: 'bezier',
                        style: { stroke: theme.edgeStroke, strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: theme.edgeStroke },
                    }}
                    connectionLineType={ConnectionLineType.Bezier}
                    // ---------- ADD THIS ----------
                    isValidConnection={(conn: Connection) => {
                        if (!conn.target) return false;
                        if (!conn.targetHandle) return true;          // allow surface drop
                        return /_t$/.test(conn.targetHandle);         // or explicit target handle
                    }}

                >

                    <MiniMap />
                    <Background color={theme.gridColor} />
                    <Controls />
                </ReactFlow>
            </div>
        </main>
    );
}
export default function Page() {
    return (
        <ReactFlowProvider>
            <Diagram />
        </ReactFlowProvider>
    );
}
