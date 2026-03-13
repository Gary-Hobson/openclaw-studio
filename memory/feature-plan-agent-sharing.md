# Agent Sharing & Permission Management — Feature Plan

Date: 2026-03-13

## Goal
Allow the Studio owner to share a specific agent with other people via a web link. Visitors can manage that agent (chat, configure) but cannot see or access other agents.

## Current State Analysis

### What Exists
- **access-gate.js**: Cookie-based single-token auth (`STUDIO_ACCESS_TOKEN`). All-or-nothing access.
- **No user model**: No concept of users, roles, or per-agent permissions.
- **Single page app**: `page.tsx` loads ALL agents and renders them in a fleet sidebar.
- **API routes**: All `/api/runtime/*` and `/api/intents/*` routes are unscoped — if you're authenticated, you can do anything.

### What's Missing
1. User identity & session management
2. Per-agent access tokens / share links
3. API-level agent scoping (filtering responses, blocking cross-agent operations)
4. UI for shared/scoped views (no fleet sidebar, only the shared agent)
5. Share management UI for the owner

---

## Proposed Architecture

### 1. Share Token Model

Create a **share token** system:

```
ShareToken {
  id: string              // unique token id (used in URL)
  token: string           // the secret in the share link
  agentId: string         // which agent this grants access to
  permissions: string[]   // e.g. ["chat", "settings", "manage"]
  createdAt: string       // ISO timestamp
  createdBy: string       // "owner" or future user id
  expiresAt?: string      // optional expiry
  label?: string          // human-readable name like "Alice's access"
  revoked: boolean
}
```

**Storage**: SQLite table in the existing `runtime.db` or a new `studio.db`.

**Share link format**: `https://studio.example.com/shared/<token>?access_token=<secret>`

### 2. Authentication Layer Changes

#### Current flow:
```
Request → access-gate.js (STUDIO_ACCESS_TOKEN check) → Next.js
```

#### New flow:
```
Request → access-gate.js (check owner token OR share token) → Next.js middleware → scope injection
```

**Two auth paths**:
- **Owner**: `STUDIO_ACCESS_TOKEN` cookie → full access (all agents)
- **Shared user**: Share cookie (`studio_share_<tokenId>`) → scoped access (one agent)

#### Implementation:
1. Extend `access-gate.js`:
   - Accept share token from query param or cookie
   - Validate against SQLite store
   - Set a scoped cookie on success
   - Inject `x-studio-scope` header with `{ role: "shared", agentId: "xxx" }` or `{ role: "owner" }`

2. Add Next.js middleware (`src/middleware.ts`):
   - Read scope from cookie/header
   - For shared users: rewrite requests to scoped versions
   - Block navigation to non-shared agent routes

### 3. API Route Scoping

Every API route needs scope-awareness:

#### Read routes (`/api/runtime/*`):
| Route | Owner | Shared User |
|-------|-------|-------------|
| `/api/runtime/fleet` | All agents | Only shared agent |
| `/api/runtime/stream` | All events | Filter to shared agent events |
| `/api/runtime/agents/[agentId]/history` | Any agent | Only shared agent |
| `/api/runtime/config` | Full config | Redacted to shared agent |
| `/api/runtime/summary` | Full | Filtered |
| `/api/runtime/cron` | All | Filtered to agent |
| `/api/runtime/models` | Full | Full (needed for chat) |
| `/api/runtime/agent-state` | Any | Only shared agent |
| `/api/runtime/agent-file` | Any | Only shared agent |

#### Intent routes (`/api/intents/*`):
| Route | Owner | Shared User |
|-------|-------|-------------|
| `chat-send` | Any agent | Only shared agent |
| `chat-abort` | Any agent | Only shared agent |
| `sessions-reset` | Any agent | Only shared agent |
| `agent-create` | ✅ | ❌ Blocked |
| `agent-delete` | ✅ | ❌ Blocked |
| `agent-rename` | ✅ | Only shared agent |
| `agent-permissions-update` | ✅ | Only shared agent (if "manage" perm) |
| `cron-*` | ✅ | Only shared agent |
| `agent-file-set` | ✅ | Only shared agent |
| `exec-approval-resolve` | ✅ | Only shared agent |

#### Implementation approach:
Create a shared helper:
```typescript
// src/lib/controlplane/scope.ts
export type RequestScope = 
  | { role: "owner" }
  | { role: "shared"; agentId: string; permissions: string[] };

export function getRequestScope(request: Request): RequestScope { ... }
export function assertAgentAccess(scope: RequestScope, agentId: string): void { ... }
```

### 4. New API Routes for Share Management

```
POST   /api/shares              — Create a share link (owner only)
GET    /api/shares              — List share links (owner only)
DELETE /api/shares/[tokenId]    — Revoke a share link (owner only)
GET    /api/shares/[tokenId]    — Get share link info
```

### 5. New Pages / Routes

```
/shared/[token]                 — Entry point for shared users
/shared/[token]/settings        — Agent settings for shared users
```

Or alternatively, use the existing SPA with scope-awareness:
- Same `/` page, but in "shared mode" the FleetSidebar is hidden
- Only the shared agent is loaded
- Settings button still works but scoped

**Recommended**: Reuse the existing SPA with scope-awareness (less code duplication).

### 6. UI Changes

#### Owner View — Share Management:
- Add "Share" button in agent settings panel (new tab or in "Advanced")
- Share management UI:
  - Create share link (with optional label, permissions, expiry)
  - List active share links
  - Copy link to clipboard
  - Revoke link

#### Shared User View:
- No fleet sidebar (or sidebar showing only the one agent)
- Agent chat panel works normally
- Agent settings panel works (if permitted)
- Header shows "Shared view" indicator
- No "Create Agent" button
- No connection settings (gateway is server-managed)

### 7. SSE Stream Filtering

The `/api/runtime/stream` SSE endpoint needs filtering for shared users:
- Only forward events for the shared agent's session
- Filter `gateway.event` payloads by agentId/sessionKey

---

## Implementation Order (Phases)

### Phase 1: Foundation (auth + scope infrastructure)
1. Add SQLite `share_tokens` table to projection store
2. Extend `access-gate.js` for share token auth
3. Create `scope.ts` helper for request scope resolution
4. Add Next.js middleware for scope injection

### Phase 2: API Scoping
5. Add scope checks to all `/api/intents/*` routes
6. Add scope filtering to all `/api/runtime/*` routes  
7. Add SSE stream filtering for shared users

### Phase 3: Share Management API
8. Create `/api/shares` CRUD routes
9. Add share token CRUD operations to projection store

### Phase 4: UI — Owner Side
10. Add "Sharing" tab to agent settings panel
11. Create share link management UI components
12. Wire up to share management API

### Phase 5: UI — Shared User Experience
13. Detect shared mode in `page.tsx`
14. Conditionally hide fleet sidebar, create button, connection settings
15. Show "shared view" indicator in header
16. Handle the `/shared/[token]` entry point

### Phase 6: Polish
17. Share link expiry enforcement
18. Rate limiting for shared endpoints
19. Audit logging for shared access
20. Tests (unit + e2e)

---

## Key Design Decisions

1. **Token-based, not user-based**: No user registration. Share links are bearer tokens. Simple, stateless-ish.
2. **Server-side scoping**: All filtering happens server-side in API routes. The browser client doesn't need to know about scoping logic.
3. **Reuse existing SPA**: Don't build a separate app for shared users. Just conditionally render.
4. **SQLite storage**: Consistent with existing projection store approach. No new dependencies.
5. **Cookie-based auth**: Consistent with existing `access-gate.js` pattern.

## Risks & Considerations

- **Gateway is shared**: All share users chat through the same Gateway connection. This is inherent to the architecture.
- **No rate limiting currently**: Shared links expose Gateway resources. Need rate limiting.
- **SSE filtering complexity**: The SSE stream currently broadcasts all events. Filtering per-connection adds complexity.
- **Settings isolation**: Some settings (like gateway config) are global. Shared users should only see agent-level settings.
