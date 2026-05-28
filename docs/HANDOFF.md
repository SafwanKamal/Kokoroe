# Kokoroe Handoff

Use this note when continuing Kokoroe in a new chat.

## Continue Prompt

Continue work in `/Users/safwankamal/Desktop/Code/Kokoroe`. Read `AGENTS.md` and the docs before making design decisions. We are building Kokoroe, a manga-inspired chat app. Continue from the current implemented state, especially the latest login page, dream-world selection, avatar-after-world flow, and saved design decisions.

## Current Flow

`Login -> Dream World Selection -> World-Specific Avatar Selection -> Chat`

## Current Backend State

- The frontend milestone is saved in git as `fc68c65` (`Checkpoint manga chat frontend`).
- Backend work has started with Next.js API routes:
  - `GET /api/rooms`
  - `GET /api/messages?roomId=<room-id>`
  - `POST /api/messages`
  - `POST /api/auth/login`
  - `GET /api/auth/session?sessionId=<session-id>`
- These routes currently use the existing seed/catalog data and a local `.data/kokoroe-dev-store.json` file. Treat this as the API contract and development bridge before adding durable database persistence and real authentication.
- Auth routes create development sessions only. They do not verify or store passwords yet.
- The frontend login and chat composer now use the API layer. Login creates a dev session, room messages are loaded through `GET /api/messages`, and sent lines go through `POST /api/messages`.

## Current Design State

- Login is a single vertical manga panel.
- Rotating scene art sits at the top and fades into the paper login area. Current runtime login art lives in `public/login-scene-current/`; older cycle/cropped login art folders were removed from runtime assets.
- The login wordmark uses `public/brand/kokoroe-logo-wordmark.svg`.
- User-facing copy should prefer dream-world/isekaied language over generic chat-space wording.
- Avatar/persona selection is world-scoped and happens after dream-world selection.
- Avatar portraits are catalog-driven through `content/avatars/catalog.json`; use `docs/AVATAR_PIPELINE.md` and `npm run avatar:add` when adding generated portraits.
- World panels use lightweight `public/rooms/<room-id>/preview.jpg` art and featured/chat headers use `scene.jpg`; the red clue-board setting is presented as `Crimson Plotroom`.
- Message bubble shape is driven by tone/persona, not by world; edit the structured presentation catalog at `content/message-presentations/catalog.json` and follow `docs/MESSAGE_PRESENTATION_PIPELINE.md`.
- New messages allow up to 120 characters. Dialogue bubbles expand horizontally with their SVG shell before wrapping vertically; compact expressive shells keep lower per-template suitability limits.
- Chat portraits anchor beneath bubble tails, reveal speaker identity on click, and outgoing messages mirror toward a right-side sender portrait; tone labels are not displayed in the transcript.
- Timestamps render as centered transcript dividers and suppress repeated nearby message times.

## Verification Baseline

- `npm run typecheck`
- `npm run build`
- Browser inspection at `http://localhost:3000/`
