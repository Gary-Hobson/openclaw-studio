# 2026-03-13 Session: Token History, Share Panel, Paste Image, Admin Token

## Token History & Login Page
- Successful login tokens auto-saved to localStorage
- "Recent tokens" list on login page — masked display, one-click login
- Inline rename (✏️), delete (×) per saved token
- Share users can also rename their tokens

## Share Panel — Copy URL Button
- Each share link in "Active Share Links" now has a **Copy URL** button
- Copies full share URL: `{origin}/shared/{token}`
- Token preview shows 12+••••+12 chars (was 8+...)
- API now returns full token to owner (was redacted)
- Files changed: `AgentSharePanel.tsx`, `shares/route.ts`, `shares/client.ts`

## Chat Input — Paste Image Support
- Ctrl+V / Cmd+V to paste images into chat input
- Reuses existing file upload pipeline (`useFileUpload` → `/api/runtime/upload`)
- Shows preview thumbnail, supports delete, multi-image
- File changed: `AgentChatPanel.tsx` — added `handlePaste` + `onPaste` on textarea

## Admin Token Persistence
- Token saved to `~/.openclaw/openclaw-studio/settings.json` (`adminToken` field)
- Reused across restarts — no more regeneration every launch
- `--new-token` CLI flag to force new token + revoke all share tokens
- `revokeAllShareTokens()` added to `server/share-store.js`
- Files changed: `server/index.js`, `server/share-store.js`

## Test Status
- TypeScript: zero errors
- Vitest: 802/803 passed (1 pre-existing flaky timeout, passes individually)
