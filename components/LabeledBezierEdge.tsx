'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    type EdgeProps,
    useReactFlow,
} from 'reactflow';

export default function LabeledBezierEdge(props: EdgeProps) {
    const {
        id,
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        markerEnd,
        style,
        label, // current label (string | ReactNode)
        selected,
    } = props;

    const [path, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const rf = useReactFlow();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<string>(String(label ?? ''));
    const inputRef = useRef<HTMLInputElement>(null);
    const placeholder = '[double-click to label]';

    // focus input when entering edit mode
    useEffect(() => {
        if (editing) {
            const t = setTimeout(() => inputRef.current?.focus(), 0);
            return () => clearTimeout(t);
        }
    }, [editing]);

    const openEdit = () => {
        setDraft(String(label ?? ''));
        setEditing(true);
    };

    const saveAndClose = () => {
        setEditing(false);
        rf.setEdges((eds) =>
            eds.map((e) => (e.id === id ? { ...e, label: draft } : e)),
        );
    };

    const cancelAndClose = () => {
        setEditing(false);
    };

    return (
        <>
            <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
            <EdgeLabelRenderer>
                <div
                    className="nodrag nopan" // <-- tells React Flow not to treat this as canvas
                    onMouseDown={(e) => e.stopPropagation()} // prevent selecting/dragging canvas
                    onDoubleClick={(e) => {
                        e.stopPropagation(); // <-- critical: don't bubble to RF
                        openEdit();
                    }}
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                        pointerEvents: 'all',
                        fontSize: 12,
                        color: 'var(--edge-label-text, #111827)',
                        background: 'var(--edge-label-bg, #ffffff)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: selected
                            ? '1px solid var(--node-border-selected, #111827)'
                            : '1px solid transparent',
                        whiteSpace: 'nowrap',
                        zIndex: 1, // keep above edges
                    }}
                >
                    {editing ? (
                        <input
                            ref={inputRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') saveAndClose();
                                if (e.key === 'Escape') cancelAndClose();
                            }}
                            onBlur={saveAndClose}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                                fontSize: 12,
                                padding: '2px 4px',
                                outline: 'none',
                                border: '1px solid var(--node-border, #E5E7EB)',
                                borderRadius: 4,
                                background: 'var(--node-bg, #ffffff)',
                                color: 'var(--node-text, #111827)',
                                minWidth: 120,
                            }}
                        />
                    ) : (
                        <span
                            style={{
                                opacity: label ? 1 : 0.55,
                                fontStyle: label ? 'normal' as const : 'italic',
                                userSelect: 'none',
                            }}
                            title="Double-click to edit label"
                        >
                            {String(label ?? '') || placeholder}
                        </span>
                    )}
                </div>
            </EdgeLabelRenderer>
        </>
    );
}
