# Roadmap

## Short-Term Goals

Build the core app experience first.

Priority features:

- Manga-inspired visual design
- Multiple chatrooms
- User login and authentication
- Basic message sending and reading
- Responsive layout
- Clear navigation between rooms
- Strong visual consistency based on curated concept art

The short-term goal is to make the app feel visually distinct and usable before adding advanced AI features.

## Current Implementation Focus

When building the first version, focus on:

1. Authentication flow
2. Chatroom list
3. Individual chatroom view
4. Message input and display
5. Room-specific visual personality
6. Clean component structure
7. Browser-verified UI polish
8. Backend API contracts for rooms, avatars, messages, and later authentication

Do not overbuild backend or AI infrastructure before the core app works.

The backend phase has started with simple Next.js route handlers and swappable local persistence adapters. The frontend now uses the API for account creation, credential login, cookie-restored dev sessions, profile preferences, and message reads/writes. Server-side message creation validates the session, room, avatar, character limit, and presentation. Sessions now carry expiration timestamps and stale cookie restores are rejected/cleared. Next steps are table-specific repository methods following `docs/DATABASE.md` and expanding backend coverage beyond the current happy path.

Supabase Postgres support is scaffolded behind `KOKOROE_STORE=supabase`, with the initial migration applied, RLS enabled, and the server-only REST adapter verified against the hosted project. Vercel can now use the Supabase store. Before adding client-side realtime subscriptions, design narrow RLS read policies for the Kokoroe tables.

Message realtime is now the active sync direction: the browser may subscribe to `messages` inserts for the active room through Supabase Realtime, while message writes remain server-owned API calls.

## Medium-Term Goals

After the base chat app is working, improve the experience with:

- Room-specific themes
- Character/world-specific UI language
- An optional desktop chibi cursor companion with target-aware poses and avatar-linked packs
- Better chatroom organization
- User profiles
- Avatar or character identity options
- Message reactions
- Basic animation and transition polish
- More expressive chat bubble variants
- Saved room style presets

The cursor companion should begin as one bounded, catalog-driven desktop pilot. It must preserve native precision cursors for text selection and operating-system interactions, stay absent on touch/coarse-pointer devices, respect reduced motion, and provide an immediate classic-cursor fallback. Expand to selected-avatar packs only after the single-pack interaction and asset contract pass rendered desktop QA.

## Long-Term Goals

Long-term, the app may integrate AI-assisted manga-style communication.

Possible future AI features:

- AI message masking so user messages can be rewritten in the voice of an emulated character
- Context classification so the app understands the tone, purpose, and social context of a message
- Character/world-specific phrasing
- AI-assisted room theming
- AI-generated visual effects for important messages
- Image generation for manga-style motion panels
- Keyframe-like animated moments that convey manga-style motion without becoming overly smooth or generic
- AI-generated expressive message presentation based on message emotion or intent

These features should be planned for architecturally, but not implemented until explicitly requested.

## Next AI Sequence

After the current dirty-worktree reconciliation is accepted:

1. Build a message-classification model path that selects one allow-listed presentation id with confidence and a safe `plain` fallback. Keep original text, rewriting, and visual rendering as separate concerns, and define an evaluation set before enabling automatic selection.
   - Make prompt, few-shot examples, evaluation inputs, and runtime calls conversation-aware. Compare a bounded recent-message window with a separate discussion-segmentation/compaction pass; do not silently classify a target message without context.
   - Start with a replaceable global hosted model behind an explicit rollout flag.
   - Gate every cloud canary behind both a server-owned room allow-list and explicit, non-persisted composer consent with a bounded-context disclosure.
   - After collecting opt-in, reviewed corrections, compare a project-owned shared model against the frozen global baseline.
   - Treat per-user on-device adaptation as optional later work: prefer a tiny local adapter/calibrator over a full model, preserve a global cold-start fallback, and keep the server-side allow-list validation boundary.
2. Begin art generation only after classifier behavior is accepted. Route generated portraits, room art, and scene moments through explicit review and the existing asset-intake contracts before runtime exposure.
   - Curate professionally translated, rights-compatible manga before relying on OCR or machine translation. Keep source acquisition, panel/text extraction, reading-order review, translation alignment, and animatic experiments in the standalone MangaPanelLab project; import only reviewed versioned manifests into Kokoroe.

AI message masking and free-form generated styling remain outside this sequence.

## Non-Goals for Early Versions

Do not prioritize these in the first version unless directly asked:

- Full AI character emulation
- Production-scale moderation system
- Complex animation generation
- Image generation pipeline
- Overly complex theme editor
- Microservice architecture
- Premature database optimization
- Large dependency-heavy design system

## Guiding Principle

Build the simplest useful version first, but make sure the visual identity is strong from the beginning.
