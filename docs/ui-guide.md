# Studio UI Guide

This doc covers Studio UI behavior and near-term UX direction.

## Current Behavior (Today)

### Agent creation workflow
- Click **New Agent** in the fleet sidebar.
- Enter an agent name and avatar, then create.
- The create modal does not include permission controls.
- After create succeeds, Studio currently opens **Settings** for the new agent.

### Cron jobs
- Open an agent and go to **Settings -> Cron jobs**.
- If no jobs exist, use the empty-state **Create** button.
- If jobs already exist, use the header **Create** button.
- The modal is agent-scoped and walks through template selection, task text, schedule, and review.
- Submitting creates the job via gateway `cron.add` and refreshes that same agent's cron list.

### Exec approvals in chat
- When a run requires exec approval, chat shows an **Exec approval required** card with command preview, host/cwd, and expiration.
- Resolve directly in chat with:
  - **Allow once**
  - **Always allow**
  - **Deny**
- The fleet row displays **Needs approval** while approvals are pending for that agent.

## Direction (Planned)

Studio is moving to a capability-first IA for non-technical users.

### Per-agent surfaces
1. `Chat` (default)
2. `Personality`
3. `Capabilities`
4. `Schedule`
5. `Advanced`

### Naming and scope changes
- `Brain` is being renamed to `Personality`.
- `Settings` is being split into `Capabilities`, `Schedule`, and `Advanced`.
- `Delete agent` moves to `Advanced` danger zone only.
- `New session` moves to a chat-adjacent header action.
- Personality editor should use friendly labels over raw filenames:
  - `Instructions` for `AGENTS.md`
  - `About You` for `USER.md`
  - `Personality` context for `SOUL.md` + `IDENTITY.md`

### Capability-first model (planned)
- Commands: `Off` / `Ask before running` / `Run automatically`
- Web research: `Off` / `On`
- Browser automation: `Off` / `On`
- Files: `Off` / `Read-only` / `Read & write`
- Automations: managed in `Schedule`
- Integrations: skill enable/disable and API key setup

### Defaults direction
- New agents should move toward a collaborative/safe default envelope rather than autonomous-by-default behavior.
