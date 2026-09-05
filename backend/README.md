# AgentOps Backend

This directory contains the production-ready Node.js + TypeScript backend for **AgentOps** (Phase 1 complete, prompts B1–B12).

## Features & Architecture

- **Fastify HTTP Server**: High-performance API foundation with request tracking and structured logging.
- **Drizzle ORM & PostgreSQL**: Type-safe database persistence layer for Projects, Tasks, Runs, Test Cases, and Results.
- **AI QA Planning & Generation**: Powered by Google Gemini 2.5 Flash with structured Zod outputs and prompt-injection guards.
- **Headless Browser Automation**: Built with Playwright, featuring strict isolated contexts, session concurrency limits, and action timeouts.
- **Website Exploration & Flow Detection**: Recursive boundary-aware web crawler for identifying user journeys and interactive controls.
- **Security Hardening (B12)**:
  - **Security Headers**: Managed via `@fastify/helmet` with Content Security Policy permitting live SSE streams.
  - **Rate Limiting**: Integrated `@fastify/rate-limit` with environment-configurable windows and limits.
  - **SSRF & URL Security**: DNS-level validation blocking private IPs (`10.x`, `172.16-31.x`, `192.168.x`), loopback (`127.0.0.1`), metadata endpoints (`169.254.169.254`), and dangerous schemes (`file://`, `javascript://`).
  - **Secret Redaction**: Automated redaction of passwords, tokens, API keys, and connection strings across logs, error envelopes, SSE events, and stored evidence.
  - **Evidence Storage Service**: Safe storage with path-traversal validation (`path.resolve`), filename sanitization, and size caps.
  - **SSE Hardening**: Real-time event streaming per run with active subscriber limits and periodic heartbeat pings.

## Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL database instance

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Copy `.env.example` to `.env` and configure credentials:
   ```bash
   cp .env.example .env
   ```

## Development Scripts

- `npm run dev`: Run the backend in watch mode using `tsx`.
- `npm run typecheck`: Perform strict TypeScript type checking (`tsc --noEmit`).
- `npm run build`: Compile TypeScript into the `dist/` directory (`tsc`).
- `npm start`: Launch the compiled production server (`node dist/index.js`).
- `npm test`: Run the full Vitest unit & integration test suite.
- `npm run db:generate`: Generate Drizzle schema migrations.
- `npm run db:migrate`: Apply database migrations.
