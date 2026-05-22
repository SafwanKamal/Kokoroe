# Kokoroe Handoff

Use this note when continuing Kokoroe in a new chat.

## Continue Prompt

Continue work in `/Users/safwankamal/Desktop/Code/Kokoroe`. Read `AGENTS.md` and the docs before making design decisions. We are building Kokoroe, a manga-inspired chat app. Continue from the current implemented state, especially the latest login page, dream-world selection, avatar-after-world flow, and saved design decisions.

## Current Flow

`Login -> Dream World Selection -> World-Specific Avatar Selection -> Chat`

## Current Design State

- Login is a single vertical manga panel.
- Rotating scene art sits at the top and fades into the paper login area.
- The login wordmark uses `public/brand/kokoroe-logo-wordmark.svg`.
- User-facing copy should prefer dream-world/isekaied language over generic chat-space wording.
- Avatar/persona selection is world-scoped and happens after dream-world selection.
- Message bubble shape is driven by tone/persona, not by world.

## Verification Baseline

- `npm run typecheck`
- `npm run build`
- Browser inspection at `http://localhost:3000/`
