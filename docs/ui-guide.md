# Studio UI Guide

This doc describes the current Studio IA and behavior.

## Agent Surfaces

### Chat (default)
- Selecting an agent opens chat as the primary workspace.
- Chat header controls include:
  - New session
  - Personality shortcut
  - Settings shortcut
- New session resets the current agent session and clears visible transcript state in Studio.

### Settings Sidebar
- The settings cog opens one sidebar with four tabs:
  1. Personality
  2. Capabilities
  3. Automations
  4. Advanced

## Personality
- Personality is the first tab when opening settings.
- Rename agent lives in Personality.
- Personality file tabs are intentionally limited to:
  - Personality (`SOUL.md`)
  - Instructions (`AGENTS.md`)
  - About You (`USER.md`)
  - Identity (`IDENTITY.md`)
- Underlying persistence still saves the full gateway-backed agent file set.

## Capabilities
- Capabilities exposes direct controls (no role preset labels):
  - Run commands: Off / Ask / Auto
  - Web access: Off / On
  - File tools: Off / On
- Skills and Browser automation are visible as coming-soon toggles.

## Automations
- User-facing language is schedules/automations (not cron-first terminology).
- Schedule creation uses template -> task -> schedule -> review flow.
- Heartbeats are represented in this tab as coming soon.

## Advanced
- Advanced contains:
  - Display toggles (Show tool calls, Show thinking)
  - Open Full Control UI
  - Delete agent (danger zone)
- Session controls are not in Advanced.

## Agent Creation Defaults
- Create modal captures only name/avatar.
- After creation, Studio applies safe defaults:
  - Commands: Ask
  - Web access: Off
  - File tools: Off
- Post-create UX keeps chat as primary and auto-opens Capabilities sidebar for onboarding.
