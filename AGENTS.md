# AGENTS.md

## Project

This is a manga-inspired chat app. The app should feel expressive, playful, and character-driven instead of looking like a generic messaging product.

Before making major design, product, or architecture decisions, read:

- `docs/VISION.md`
- `docs/ROADMAP.md`
- `docs/DESIGN_DECISIONS.md`
- `docs/CONCEPT_ART_NOTES.md` if it has content
- `docs/AI_FEATURE_NOTES.md` if working near AI-related features

## Current Priority

Focus first on the core app experience:

1. Manga-inspired UI
2. Multiple chatroom support
3. Login and authentication
4. Clean app structure that can later support AI features

Do not implement long-term AI masking, character emulation, image generation, or animation-generation features unless explicitly requested.

## Design Direction

The UI should avoid plain stacked rectangular chat capsules.

Prefer expressive, human-like, manga-inspired layouts:

- Irregular or hand-drawn-feeling chat bubbles
- Manga panel-inspired containers
- Playful spacing and asymmetry
- Expressive action words such as `shout`, `mutter`, `whisper`, `exclaim`, `shoot`, `announce`, or `scribble`
- Visual personality through motion, typography, bubble shapes, paneling, and layout

Keep the app usable. Creativity should support the chat experience, not make the interface confusing.

## World Language

- Store recurring stylized interface copy in `content/world-language/catalog.json` and consume it through `app/world-language.ts`; do not scatter one-off themed strings through components.
- Follow `docs/WORLD_LANGUAGE_PIPELINE.md` when adding or changing product-system copy.
- Keep sensitive, destructive, legal, error, and form language literal enough to understand immediately. Pair unusually expressive actions with a plain accessible label.
- Choose activity phrases by operation and UI state rather than rotating synonyms randomly.

## Color Palette

Use this palette as the default visual foundation for Kokoroe:

- Paper Base: `#F2E7D3`
- Paper Warm: `#E7D7BC`
- Ink Black: `#24221F`
- Soft Ink: `#4B4943`
- Panel Border: `#181916`
- Primary Blue: `#567181`
- Sky Wash: `#C7D4D2`
- School Green: `#5B6F5B`
- Quiet Blue: `#596F7B`
- Plot Coral: `#936156`
- Ramen Gold: `#80683F`
- Highlight Yellow: `#D8C58C`
- Success Mint: `#A6BBA1`
- Error Red: `#9B574E`
- Field Cream: `#F7F0E3`
- Divider Gray: `#B8AA97`
- Disabled Blue Gray: `#8B9693`

Favor warm manga paper, charcoal ink borders, and desaturated room-specific accents. Color should feel printed and slightly faded rather than digitally saturated; reserve the strongest contrast for text, boundaries, focus, and critical state communication. Avoid drifting into a generic dark SaaS palette or a one-note purple/blue theme.

## Coding Standards

- Keep code minimal and simple.
- Prefer readable implementation over clever abstraction.
- Avoid unnecessary dependencies.
- Use clear names for components, functions, files, routes, and database models.
- Keep components focused.
- Do not over-engineer future AI features before the base app works.
- Add comments only when they explain non-obvious decisions.
- Update documentation when behavior, design direction, or architecture changes.

## Testing and Verification

After meaningful changes:

1. Run the relevant tests, type checks, linters, or build commands from the terminal.
2. Start the app locally when possible.
3. Use the browser to inspect the UI.
4. Verify that layout, spacing, responsiveness, and visual hierarchy actually look correct.
5. Fix visible UI issues before considering the task complete.

Do not rely only on terminal tests for UI work.

For UI/layout fixes, use screenshot-based visual inspection with computer vision when possible. DOM measurements are helpful, but they are not enough on their own; visually inspect the rendered result for text overflow, awkward spacing, clipping, and manga-shell fit before calling the fix done.

## Avatar Intake

- Read `docs/AVATAR_PIPELINE.md` before adding or replacing avatar portraits.
- Keep runtime portraits in `public/avatars/<room-id>/<avatar-id>/portrait.png` and metadata in `content/avatars/catalog.json`.
- Never publish contact sheets, multi-character previews, or reference-only images as runtime avatars.
- Use `npm run avatar:add` for new or replacement portraits after visual review, then inspect both setup and chat views in the browser.

## Message Presentations

- Read `docs/MESSAGE_PRESENTATION_PIPELINE.md` before adding or changing chat bubble styles.
- Define bubble shell, typography role, ink, motion, classifier hints, responsive text width, and tested safe-area geometry together in `content/message-presentations/catalog.json`.
- Future tone selection should choose an allowed presentation id; it should not produce arbitrary CSS, asset paths, or typography values.
- In chat, attach the portrait beneath the bubble tail; mirror outgoing bubble shells toward the right-side sender. Reveal speaker identity from the portrait rather than persistently labeling each message.
- Inspect long text within each changed shell in the browser before considering a presentation finished.

## Project Memory

When the user gives a project-level preference, design rule, naming convention, architecture decision, recurring correction, or future feature idea, do not rely only on chat memory.

Instead:

- Add stable coding or workflow rules to the nearest `AGENTS.md`.
- Add design and product decisions to `docs/DESIGN_DECISIONS.md`.
- Add future feature ideas to `docs/ROADMAP.md`.
- Add visual inspiration or concept-art conclusions to `docs/CONCEPT_ART_NOTES.md`.
- Add AI-specific architecture or behavior notes to `docs/AI_FEATURE_NOTES.md`.

Before adding anything, keep it concise and avoid duplicating existing notes.

## Growing the Project

If a folder becomes complex enough to need its own rules, add a local `AGENTS.md` inside that folder.

Possible examples:

- `frontend/AGENTS.md`
- `backend/AGENTS.md`
- `ai/AGENTS.md`
- `components/AGENTS.md`

Local `AGENTS.md` files should be short and should not duplicate this root file.
