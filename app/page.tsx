    'use client';

    import React, { useCallback, useEffect, useState, useRef } from 'react';
    import { parseTextToDiagram } from '@/lib/parse';
    import LabeledBezierEdge from '@/components/LabeledBezierEdge';
    import { themes, type ThemeName, type Theme } from '@/lib/theme';
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
    const edgeTypes = { labeled: LabeledBezierEdge };
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
            type: 'labeled', // <-- fully curved like your PNG render
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
        const [preserveEdges, setPreserveEdges] = useState(false);
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

        const STORAGE_KEY = 'lb:diagram:v1';

        // URL-safe base64 helpers (unicode-safe, no deprecated APIs)
        const encode64 = (obj: unknown): string => {
            if (typeof window === 'undefined') return '';
            const json = JSON.stringify(obj);
            const bytes = new TextEncoder().encode(json);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            // URL-safe: replace +/ and strip =
            return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        };

        const decode64 = <T,>(s: string): T | null => {
            try {
                // restore standard base64 from URL-safe form
                let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
                // pad with '=' to multiple of 4
                while (b64.length % 4) b64 += '=';
                const binary = atob(b64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const json = new TextDecoder().decode(bytes);
                return JSON.parse(json) as T;
            } catch {
                return null;
            }
        };

        useEffect(() => {
            try {
                // 1) URL param takes precedence
                const url = new URL(window.location.href);
                const dParam = url.searchParams.get('d');

                if (dParam) {
                    type Payload = {
                        nodes?: Node[];
                        edges?: Edge[];
                        themeName?: ThemeName;
                        layoutDir?: 'TB' | 'LR';
                    };
                    const parsed = decode64<Payload>(dParam);
                    if (parsed) {
                        if (parsed.themeName) setThemeName(parsed.themeName);
                        if (parsed.layoutDir) setLayoutDir(parsed.layoutDir);
                        if (Array.isArray(parsed.nodes)) setNodes(parsed.nodes);
                        if (Array.isArray(parsed.edges)) setEdges(parsed.edges);

                        // clean URL (remove ?d=) without reload
                        url.searchParams.delete('d');
                        window.history.replaceState({}, '', url.toString());

                        requestAnimationFrame(() => {
                            (parsed.nodes ?? []).forEach((n) => updateNodeInternals(n.id));
                            fitView({ padding: 0.2, duration: 300 });
                        });
                        return; // stop; we loaded from URL
                    }
                }

                // 2) Fallback to localStorage
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return;

                const data = JSON.parse(raw) as {
                    nodes?: Node[];
                    edges?: Edge[];
                    themeName?: ThemeName;
                    layoutDir?: 'TB' | 'LR';
                };

                if (data.themeName) setThemeName(data.themeName);
                if (data.layoutDir) setLayoutDir(data.layoutDir);
                if (Array.isArray(data.nodes)) setNodes(data.nodes);
                if (Array.isArray(data.edges)) setEdges(data.edges);

                requestAnimationFrame(() => {
                    (data.nodes ?? []).forEach((n) => updateNodeInternals(n.id));
                    fitView({ padding: 0.2, duration: 300 });
                });
            } catch {
                // ignore
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);


        useEffect(() => {
            // strip transient 'selected' flags before saving
            const cleanNodes = nodes.map((n) => ({ ...n, selected: false }));
            const cleanEdges = edges.map((e) => ({ ...e, selected: false }));

            const payload = {
                nodes: cleanNodes,
                edges: cleanEdges,
                themeName,
                layoutDir,
            };

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            } catch {
                // storage might be full or blocked; ignore silently
            }
        }, [nodes, edges, themeName, layoutDir]);

        // container for React Flow (used for export)
        const canvasRef = useRef<HTMLDivElement | null>(null);
        useEffect(() => {
            const el = shellRef.current;
            if (!el) return;
            (Object.keys(THEME_KEYS) as Array<keyof typeof THEME_KEYS>).forEach((cssVar) => {
                const key = THEME_KEYS[cssVar] as keyof Theme;
                el.style.setProperty(cssVar, String(theme[key]));
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
            const onKeyDown = (e: KeyboardEvent) => {
                // ignore when user is typing in an input/textarea/contentEditable
                const t = e.target as HTMLElement | null;
                const isTyping =
                    t &&
                    (t.tagName === 'INPUT' ||
                        t.tagName === 'TEXTAREA' ||
                        (t as HTMLElement).isContentEditable);

                if (isTyping) return;

                // Only the Delete key removes selected nodes/edges
                if (e.key === 'Delete') {
                    e.preventDefault();
                    setEdges((eds) => eds.filter((edge) => !edge.selected));
                    setNodes((nds) => nds.filter((node) => !node.selected));
                }
            };

            window.addEventListener('keydown', onKeyDown);
            return () => window.removeEventListener('keydown', onKeyDown);
        }, []);

        useEffect(() => {
            const onKey = (e: KeyboardEvent) => {
                const isMac = /\bmac\b/.test(navigator.userAgent.toLowerCase());
                const meta = isMac ? e.metaKey : e.ctrlKey;

                // Avoid when typing in fields
                const t = e.target as HTMLElement | null;
                const isTyping =
                    t &&
                    (t.tagName === 'INPUT' ||
                        t.tagName === 'TEXTAREA' ||
                        (t as HTMLElement).isContentEditable);

                if (meta && e.key.toLowerCase() === 'f' && !isTyping) {
                    e.preventDefault(); // stop browser "Find"
                    fitView({ padding: 0.2, duration: 400 });
                }
            };

            window.addEventListener('keydown', onKey);
            return () => window.removeEventListener('keydown', onKey);
        }, [fitView]);

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
                setEdges((eds) => addEdge({ ...conn, type: 'labeled' }, eds));
            },
            []
        );
        const onEdgeUpdate = useCallback((oldEdge: Edge, newConnection: Connection) => {
            setEdges((eds) =>
                eds.map((e) =>
                    e.id === oldEdge.id
                        ? {
                            ...e,
                            source: newConnection.source ?? e.source,
                            sourceHandle: newConnection.sourceHandle ?? e.sourceHandle,
                            target: newConnection.target ?? e.target,
                            targetHandle: newConnection.targetHandle ?? e.targetHandle,
                        }
                        : e,
                ),
            );
        }, []);

        // actions

        const handleReset = () => {
            // clear persisted state
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch { }

            // restore defaults
            setThemeName('light');
            setLayoutDir('TB');
            setNodes(initialNodes);
            setEdges(initialEdges);
            // ensure future IDs don’t collide with sample
            setCounter(3);

            // refresh handle geometry and fit view next frame
            requestAnimationFrame(() => {
                initialNodes.forEach((n) => updateNodeInternals(n.id));
                fitView({ padding: 0.2, duration: 300 });
            });
        };

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

        const handleNodeDoubleClick = (_: React.MouseEvent, node: Node) => {
            const newLabel = prompt('Rename node:', String(node.data?.label ?? ''));
            if (newLabel === null) return;
            setNodes((nds) =>
                nds.map((n) =>
                    n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n,
                ),
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

        const handleFitViewClick = () => {
            // center & zoom to fit everything nicely
            fitView({ padding: 0.2, duration: 400 });
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
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                alert(`Could not export SVG: ${msg}`);
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
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                alert(`Could not export PNG: ${msg}`);
            } finally {
                restoreSelection(sel);
            }
        };

        const handleDuplicateSelectedNode = useCallback(() => {
            const sel = nodes.filter((n) => n.selected);
            if (sel.length !== 1) {
                alert('Select exactly one node to duplicate.');
                return;
            }
            const orig = sel[0];
            const newId = `n${counter}`;
            setCounter((c) => c + 1);

            const newNode: Node = {
                ...orig,
                id: newId,
                position: { x: orig.position.x + 32, y: orig.position.y + 32 },
                data: { ...orig.data, label: `${String(orig.data?.label ?? '')} (copy)` },
                selected: false,
            };

            // add node
            setNodes((nds) => [...nds, newNode]);

            // optionally clone incident edges (replace the endpoint that was the original with the new node id)
            if (preserveEdges) {
                const incident = edges.filter((e) => e.source === orig.id || e.target === orig.id);
                const clones = incident.map((e) => {
                    const id =
                        (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
                            ? globalThis.crypto.randomUUID()
                            : `e${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

                    const cloned = { ...e, id, selected: false };
                    if (cloned.source === orig.id) cloned.source = newId;
                    if (cloned.target === orig.id) cloned.target = newId;
                    return cloned;
                });
                setEdges((eds) => [...eds, ...clones]);
            }

            // refresh handle geometry next frame
            requestAnimationFrame(() => updateNodeInternals(newId));
        }, [nodes, counter, updateNodeInternals, edges, preserveEdges]);


        useEffect(() => {
            const onKey = (e: KeyboardEvent) => {
                const isMac = /\bmac\b/.test(navigator.userAgent.toLowerCase());
                const meta = isMac ? e.metaKey : e.ctrlKey;

                // ignore when typing
                const t = e.target as HTMLElement | null;
                const isTyping =
                    t &&
                    (t.tagName === 'INPUT' ||
                        t.tagName === 'TEXTAREA' ||
                        (t as HTMLElement).isContentEditable);

                if (meta && e.key.toLowerCase() === 'd' && !isTyping) {
                    e.preventDefault(); // block bookmark dialog
                    handleDuplicateSelectedNode();
                }
            };

            window.addEventListener('keydown', onKey, true);
            return () => window.removeEventListener('keydown', onKey, true);
        }, [handleDuplicateSelectedNode]);

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

                        <button onClick={handleDuplicateSelectedNode} className="px-3 py-1 rounded-md border">
                            Duplicate
                        </button>

                        <button onClick={handleDuplicateSelectedNode} className="px-3 py-1 rounded-md border">
                            Duplicate
                        </button>

                        <label className="flex items-center gap-2 text-sm select-none">
                            <input
                                type="checkbox"
                                checked={preserveEdges}
                                onChange={(e) => setPreserveEdges(e.target.checked)}
                            />
                            Preserve edges
                        </label>

                        <button onClick={handleAutoLayout} className="px-3 py-1 rounded-md border">
                            Auto-Layout
                        </button>

                        <button onClick={handleFitViewClick} className="px-3 py-1 rounded-md border">
                            Fit View
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

                                    } catch (err: unknown) {
                                        const msg = err instanceof Error ? err.message : String(err);
                                        alert(`Could not load file: ${msg}`);
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

                        <button onClick={handleReset} className="px-3 py-1 rounded-md border">
                            Reset
                        </button>

                        <button
                            onClick={async () => {
                                // strip transient selection flags
                                const cleanNodes = nodes.map((n) => ({ ...n, selected: false }));
                                const cleanEdges = edges.map((e) => ({ ...e, selected: false }));
                                const payload = { nodes: cleanNodes, edges: cleanEdges, themeName, layoutDir };

                                const base = window.location.origin + window.location.pathname;
                                const url = `${base}?d=${encode64(payload)}`;

                                try {
                                    await navigator.clipboard.writeText(url);
                                    alert('Share link copied to clipboard!');
                                } catch {
                                    // fallback: show prompt to copy manually
                                    prompt('Copy this link:', url);
                                }
                            }}
                            className="px-3 py-1 rounded-md border"
                        >
                            Copy Share Link
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
                        edgeTypes={edgeTypes}
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
                            type: 'labeled',
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
                        deleteKeyCode={['Delete']}

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
