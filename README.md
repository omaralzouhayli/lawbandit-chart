# Lawbandit Chart

A web app that turns pasted (or selected) text into an **editable flowchart**, with optional **AI parsing** (when a server key is configured).

## Features
- Paste text → **Generate diagram** (always works locally)
- **Auto-layout**: Top→Bottom / Left→Right
- **Hotkeys**:  
  - Ctrl/Cmd+F fit view  
  - Ctrl/Cmd+L auto-layout  
  - N add node  
  - Delete remove selection  
  - Ctrl/Cmd+S export JSON  
  - Ctrl/Cmd+D duplicate node
- Add/delete nodes, connect, drag, select; **double-click edge labels** to edit
- **Export** JSON, **SVG**, **PNG**
- **Share link** packs `{nodes,edges,theme,layout}` into URL (`?d=...`)
- **Themes**: light / dark / high-contrast
- **Autosave** to localStorage
- **Use AI (if key available)** toggle with graceful fallback to local parser
- **PDF panel (scaffold)** — UI placeholder for future PDF-to-text selection

## Tech Stack
Next.js (App Router) · TypeScript · React · React Flow · Dagre · html-to-image

## Run Locally
```bash
git clone https://github.com/omaralzouhayli/lawbandit-chart.git
cd lawbandit-chart
npm install
npm run dev
