// lib/theme.ts
export type ThemeName = 'light' | 'dark' | 'contrast';

export type Theme = {
    canvasBg: string;
    nodeBg: string;
    nodeBorder: string;
    nodeBorderSelected: string;
    nodeText: string;
    edgeStroke: string;
    edgeLabelText: string;
    edgeLabelBg: string;
    gridColor: string;
};

export const themes: Record<ThemeName, Theme> = {
    light: {
        canvasBg: '#ffffff',
        nodeBg: '#ffffff',
        nodeBorder: '#E5E7EB',          // gray-200
        nodeBorderSelected: '#111827',  // gray-900
        nodeText: '#111827',            // gray-900
        edgeStroke: '#9CA3AF',          // gray-400
        edgeLabelText: '#111827',
        edgeLabelBg: '#ffffff',
        gridColor: '#E5E7EB',           // gray-200
    },
    dark: {
        canvasBg: '#111827',            // gray-900
        nodeBg: '#1F2937',              // gray-800
        nodeBorder: '#374151',          // gray-700
        nodeBorderSelected: '#F9FAFB',  // gray-50
        nodeText: '#F9FAFB',            // gray-50
        edgeStroke: '#D1D5DB',          // gray-300
        edgeLabelText: '#F3F4F6',       // gray-100
        edgeLabelBg: '#111827',
        gridColor: '#374151',           // gray-700
    },
    contrast: {
        canvasBg: '#000000',
        nodeBg: '#000000',
        nodeBorder: '#FFFFFF',
        nodeBorderSelected: '#00FFFF',  // cyan
        nodeText: '#FFFFFF',
        edgeStroke: '#FFFFFF',
        edgeLabelText: '#000000',
        edgeLabelBg: '#FFFF00',         // yellow
        gridColor: '#666666',
    },
};
