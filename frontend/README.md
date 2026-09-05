# AgentOps Frontend

Phase-1 control center built with Vite, React, TypeScript, Tailwind CSS, Motion and React Flow.

## Setup

```bash
npm install
npm run dev
```

Default frontend: `http://localhost:3000`

Set `VITE_API_BASE_URL=http://localhost:3001` when the backend runs on a different origin.

## Validation

```bash
npm run typecheck
npm run build
```

## Routes

- `/` Dashboard
- `/command` AI Command Center
- `/automation` AI Automation workflow preview
- `/agent` AI Agent preview
- `/sessions` and `/sessions/:id`
- `/runs` and `/runs/:id`
- `/issues` and `/issues/:id`
- `/reports` and `/reports/:id`
- `/settings`

The AI Agent personal connectors remain preview-only in Phase 1. Real Google/WhatsApp OAuth and connector execution are intentionally not implemented yet.
