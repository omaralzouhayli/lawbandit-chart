'use client';
import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

type Data = { label?: string };

export default function NodeCard({
    data,
    selected,
    isConnectable = true,
}: NodeProps<Data>) {
    // Invisible but clickable handle hit-area (leave at exact side positions)
    const handleHit: React.CSSProperties = {
        width: 18,
        height: 18,
        opacity: 0,                 // handles are invisible
        background: 'transparent',
        border: 'none',
    };

    // One decorative dot per side (purely visual; show on hover)
    const anchorBase: React.CSSProperties = {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: '9999px',
        border: '2px solid var(--node-border, #E5E7EB)',
        background: 'var(--node-bg, #ffffff)',
        transform: 'translate(-50%, -50%)',
        opacity: 0,                 // hidden by default; revealed on hover
        transition: 'opacity 120ms ease',
        pointerEvents: 'none',
    };

    return (
        <div
            className="rf-node-card relative min-w-[180px] h-[56px] flex items-center justify-center rounded-lg border"
            style={{
                padding: 6,
                background: 'var(--node-bg, #ffffff)',
                color: 'var(--node-text, #111827)',
                borderColor: selected
                    ? 'var(--node-border-selected, #111827)'
                    : 'var(--node-border, #E5E7EB)',
            }}
        >
            <span className="text-sm">{String(data?.label ?? '')}</span>

            {/* Decorative dots (ONE per side) */}
            <span className="anchor-dot" style={{ ...anchorBase, left: '50%', top: 0 }} />
            <span className="anchor-dot" style={{ ...anchorBase, left: '100%', top: '50%' }} />
            <span className="anchor-dot" style={{ ...anchorBase, left: '50%', top: '100%' }} />
            <span className="anchor-dot" style={{ ...anchorBase, left: 0, top: '50%' }} />

            {/* ===== Invisible handles (source + target per side) ===== */}
            {/* TOP: source below target (target above via zIndex) */}
            <Handle
                id="top"
                type="source"
                position={Position.Top}
                isConnectable={isConnectable}
                isConnectableEnd={false}                 // can't end on a source
                style={{ ...handleHit, zIndex: 1 }}
            />
            <Handle
                id="top_t"
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                isConnectableStart={false}               // can't start from a target
                style={{ ...handleHit, zIndex: 2 }}
            />

            {/* RIGHT */}
            <Handle
                id="right"
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                isConnectableEnd={false}
                style={{ ...handleHit, zIndex: 1 }}
            />
            <Handle
                id="right_t"
                type="target"
                position={Position.Right}
                isConnectable={isConnectable}
                isConnectableStart={false}
                style={{ ...handleHit, zIndex: 2 }}
            />

            {/* BOTTOM */}
            <Handle
                id="bottom"
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                isConnectableEnd={false}
                style={{ ...handleHit, zIndex: 1 }}
            />
            <Handle
                id="bottom_t"
                type="target"
                position={Position.Bottom}
                isConnectable={isConnectable}
                isConnectableStart={false}
                style={{ ...handleHit, zIndex: 2 }}
            />

            {/* LEFT */}
            <Handle
                id="left"
                type="source"
                position={Position.Left}
                isConnectable={isConnectable}
                isConnectableEnd={false}
                style={{ ...handleHit, zIndex: 1 }}
            />
            <Handle
                id="left_t"
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                isConnectableStart={false}
                style={{ ...handleHit, zIndex: 2 }}
            />

            {/* Show decorative dots on hover */}
            <style jsx>{`
        .rf-node-card:hover .anchor-dot {
          opacity: 1;
        }
      `}</style>
        </div>
    );
}
