# OpenClaw Studio Architecture Analysis

Date: 2026-03-13

## Overview

OpenClaw Studio is a Next.js (v16) web frontend for the OpenClaw Gateway. It provides an operator UI for managing AI agents: creating, configuring, chatting, and monitoring them.

## Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19
- **Server**: Custom Node.js HTTP server (`server/index.js`) wrapping Next.js
- **Database**: SQLite (via `better-sqlite3`) for local projection store
- **Styling**: TailwindCSS v4
- **State**: React Context + useReducer (`AgentStoreProvider`)
- **Upstream**: WebSocket to OpenClaw Gateway (server-owned connection)
- **Build**: TypeScript, Vitest (unit tests), Playwright (e2e)

## Architecture Pattern

```
Browser ──HTTP/SSE──> Studio Next.js Server ──WebSocket──> OpenClaw Gateway
```

- Browser NEVER talks directly to the Gateway
- Studio server owns the WebSocket connection (singleton `ControlPlaneRuntime`)
- Browser uses `/api/runtime/*` (reads) and `/api/intents/*` (writes) HTTP routes
- SSE stream at `/api/runtime/stream` for real-time events

## Directory Structure

### `server/` — Custom Node.js server (CommonJS)
- `index.js` — HTTP server bootstrap, binds Next.js + access gate
- `access-gate.js` — Cookie-based access token auth (`STUDIO_ACCESS_TOKEN`)
- `network-policy.js` — Prevents binding to public IPs without access token
- `studio-settings.js` — Reads gateway settings from disk
- `install-context.js` — Detects CLI install state

### `src/app/` — Next.js App Router pages & API routes
- `page.tsx` — Main SPA page (massive ~1300 lines, all wiring logic)
- `layout.tsx` — Root layout (fonts, dark mode)
- `agents/[agentId]/settings/page.tsx` — Redirects to settings route
- `[...invalid]/page.tsx` — Catch-all for invalid routes
- `api/runtime/*` — Read routes (fleet, config, history, stream, etc.)
- `api/intents/*` — Write routes (chat-send, agent-create, agent-delete, etc.)
- `api/studio/` — Studio settings (GET/PUT)

### `src/features/agents/` — Agent domain logic
- `components/` — React UI components (AgentChatPanel, FleetSidebar, HeaderBar, etc.)
- `state/` — State management (store.tsx, event handlers, transcript)
- `operations/` — Business logic workflows (create, delete, rename, permissions, etc.)
- `approvals/` — Exec approval flow (pause, resolve, control loop)
- `creation/` — Agent creation types

### `src/lib/` — Shared libraries
- `controlplane/` — Core server runtime
  - `runtime.ts` — Singleton ControlPlaneRuntime (global process state)
  - `openclaw-adapter.ts` — WebSocket lifecycle to Gateway
  - `projection-store.ts` — SQLite event store + outbox
  - `intent-route.ts` — Helper for intent API routes
  - `runtime-route-bootstrap.ts` — Bootstrap helper for read routes
  - `contracts.ts` — TypeScript types for domain events
- `gateway/` — Gateway client abstractions (GatewayClient, config, models)
- `studio/` — Studio settings (settings.ts, settings-store.ts, coordinator.ts)
- `agents/` — Agent file/personality helpers
- `avatars/` — Multiavatar generation
- `cron/` — Cron job types and helpers
- `ssh/` — SSH-related helpers
- `text/` — Message text processing

## Authentication Model (Current)

1. **STUDIO_ACCESS_TOKEN** — Single shared token for the entire Studio
   - Set via environment variable
   - Verified via cookie (`studio_access`) or query param (`?access_token=`)
   - Server middleware in `access-gate.js` handles HTTP + WebSocket upgrade
   - Blocks `/api/*` routes if not authenticated
   - No user identity — just "authorized or not"

2. **Gateway Token** — Studio → Gateway auth
   - Stored in `~/.openclaw/openclaw-studio/settings.json`
   - Server-custodied, never sent to browser
   - Used for WebSocket handshake to Gateway

3. **No user model** — No users, sessions, roles, or per-agent access control

## Key Design Constraints
- Single Page App: `page.tsx` does everything (fleet, chat, settings)
- Single Gateway connection: process-global singleton
- No database for user data — only SQLite for event projection
- All agent state comes from Gateway via WebSocket events
- Settings stored as flat JSON files on disk

## Current Routing
- `/` — Main page (agent fleet + chat + settings)
- `/agents/[agentId]/settings` → redirects to `/?settings_agent=[agentId]`
- `/api/runtime/*` — Server reads from Gateway
- `/api/intents/*` — Server writes to Gateway
- `/api/studio` — Studio settings management
