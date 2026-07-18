# Project Ledger

## Resume Here

| Field | Last observed state |
|---|---|
| Project goal | Manga-inspired chat app with expressive message presentations, world/room scenes, login/authentication, avatars, and swappable local/Supabase persistence. |
| Current phase | Core UI/auth/presentation work is reconciled and committed on a review branch; message classification is the next ready implementation slice, with art generation sequenced after classifier acceptance. |
| Branch / commit | `codex/reconcile-kokoroe-dirty-worktree` / validated product HEAD `bf90e7ec638b6d2b0580a99fdd6c865d9488b891` (`45367e0..bf90e7e`; final ledger-only commit follows) |
| Active primary sub-problem | SP-006 — Bounded message classification |
| Last validated milestone | At 2026-07-18T15:15:09-05:00, the former mixed worktree was reconciled into four commits: `2f85519` presentation safeguards, `665baea` runtime chat/login/setup, `21cb409` docs/assets and AI roadmap, and `bf90e7e` dependency lock refresh. CONFLICT-001 was resolved by allowing only recent sad rain and one-shot Scribble to auto-run; other shell-specific effects are interaction-driven. `npm run check` passed (2 files / 24 tests, TypeScript, Next.js 16.2.10 production build), `git diff --check` passed, and `next-env.d.ts` normalized through the production build. |
| Current blocker or risk | SP-006 is ready but has no model/provider/evaluation implementation yet. SP-007 art generation is intentionally blocked until classifier behavior and its bounded contract are accepted. Local `node_modules` still reports extraneous `@emnapi/wasi-threads@1.2.2`; this does not affect the committed lockfile or checks. |
| Exact next action | Start NEXT-005 on a new `codex/next-005-message-classifier` branch: define the typed classifier contract and evaluation set before selecting or integrating a model. |
| Most relevant prior chat | Unavailable from current surface (SP-001 reconciliation with related SP-002–SP-007 planning). |
| Ledger updated | 2026-07-18T15:15:09-05:00 |

## Status Legend

| Status | Meaning | Color |
|---|---|---|
| ✅ COMPLETE | Acceptance criteria verified | Green |
| 🔵 ACTIVE | Work currently in progress | Blue |
| 🟡 READY NEXT | Prerequisites satisfied | Yellow |
| 🟠 BLOCKED | Cannot proceed until a condition changes | Orange |
| ⚪ DEFERRED | Intentionally postponed | Gray |
| ❌ SUPERSEDED | Replaced or abandoned | Red |

## Project Goal and Scope

Kokoroe is a manga-inspired chat app built with Next.js. The app should feel expressive, playful, character-driven, and visually distinct from a generic chat or SaaS dashboard. Authoritative project guidance is in `AGENTS.md`, `docs/VISION.md`, `docs/ROADMAP.md`, `docs/DESIGN_DECISIONS.md`, `docs/CONCEPT_ART_NOTES.md`, `docs/AVATAR_PIPELINE.md`, and `docs/MESSAGE_PRESENTATION_PIPELINE.md`.

In scope now: authentication/login, multiple rooms/worlds, basic message sending and reading, runtime avatar identity, room scene art, expressive catalog-driven message presentations, responsive manga UI polish, and backend API contracts with swappable persistence.

Explicit early non-goals: full AI character emulation, AI message masking, arbitrary AI-generated UI styling, large dependency-heavy design systems, and production-scale AI/image-generation pipelines unless explicitly requested.

## Working Architecture

### System Architecture

Current state from repository evidence:

- Next.js app under `app/` with UI in `app/page.tsx` and global styling in `app/globals.css`.
- Route handlers under `app/api/` cover messages, auth login/register/logout/session, health, profile, members, and rooms.
- Store facade in `app/kokoroe-store.ts`; adapters in `app/stores/` include JSON, SQLite, Supabase, seed data, and shared types.
- Runtime catalogs live in `content/message-presentations/catalog.json` and `content/avatars/catalog.json`.
- Decorative message shell assets live in `public/message-templates/`.
- Approved runtime avatars live in `public/avatars/<room-id>/<avatar-id>/portrait.png`; the six current portraits are byte-identical to their accepted full-square reference candidates.
- Runtime room art lives in `public/rooms/<room-id>/preview.jpg` and `scene.jpg`.
- Login scene art for current runtime exists in `public/login-scene-current/`.
- Runtime login wordmark exists at `public/brand/kokoroe-logo-wordmark.svg`.
- Latest login composition reference is `docs/ReferenceImages/Concept/login-panel-blend-concept.png`, showing top manga art dissolving into an integrated paper login form.
- Reference/source art lives under `docs/ReferenceImages/`, including logo/wordmark assets under `docs/ReferenceImages/Logo/` and generated avatar candidates under `docs/ReferenceImages/Character Profile/` plus `docs/ReferenceImages/Avatars/`.

Target-only or future state:

- Future AI presentation selection may emit only allow-listed `presentationId` values from the message presentation catalog.
- Future avatar generation must feed the approval/import pipeline before runtime exposure.
- Planned next state: SP-006 adds a bounded classifier contract and evaluation set; SP-007 adds approval-gated art generation only after SP-006 acceptance.

### Development Sequence

```mermaid
flowchart TD
    SP001["SP-001 Core App/Auth"]
    SP002["SP-002 Message Presentations"]
    SP003["SP-003 Visual Assets/Avatars"]
    SP004["SP-004 Login/Setup Flow"]
    SP005["SP-005 Supabase/Realtime"]
    SP006["SP-006 Message Classification"]
    SP007["SP-007 Art Generation"]
    SP001 --> SP002
    SP001 --> SP003
    SP001 --> SP004
    SP001 --> SP005
    SP003 --> SP004
    SP002 --> SP006
    SP003 --> SP007
    SP006 --> SP007
    classDef complete fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef active fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    classDef ready fill:#fef3c7,stroke:#ca8a04,color:#713f12
    classDef blocked fill:#ffedd5,stroke:#ea580c,color:#7c2d12
    classDef deferred fill:#f3f4f6,stroke:#6b7280,color:#374151
    class SP001 active
    class SP002 complete
    class SP003 active
    class SP004 complete
    class SP005 active
    class SP006 ready
    class SP007 deferred
```

### Active Work Map

| Sub-problem | Status | Branch / worktree | HEAD | Sessions | Blocker / next action |
|---|---|---|---|---|---|
| SP-001 | 🔵 ACTIVE | `codex/reconcile-kokoroe-dirty-worktree` / `/Users/safwankamal/Desktop/Code/Kokoroe` | `bf90e7e` | Current session unavailable | Dirty-worktree reconciliation is committed; authenticated membership/chat QA remains a later core closeout item. |
| SP-002 | ✅ COMPLETE | same | `bf90e7e` | [SP-002 — Auth, Supabase, UI and Bubbles](codex://threads/019f7088-4e63-7323-a377-6e1b41b3c6a3); current session unavailable | Catalog, safe areas, motion policy, tests, and CONFLICT-001 are resolved; feeds SP-006. |
| SP-003 | 🔵 ACTIVE | same | `bf90e7e` | Unavailable from current surface | Current portraits, wordmark, and concept-art paths are accepted and committed; future generated art must reuse intake. |
| SP-004 | ✅ COMPLETE | same | `bf90e7e` | Unavailable from current surface | Accepted desktop/mobile login/setup is committed; rerun only when its assets or responsive structure change. |
| SP-005 | 🔵 ACTIVE | same | `bf90e7e` | Unavailable from current surface | Verify RLS/read policy scope before client realtime expansion. |
| SP-006 | 🟡 READY NEXT | recommended `codex/next-005-message-classifier` | Not started | None | NEXT-005: typed bounded classifier contract, evaluation set, confidence threshold, and `plain` fallback. |
| SP-007 | ⚪ DEFERRED | recommended `codex/next-006-art-generation` | Not started | None | Blocked until SP-006 behavior is accepted; then build one approval-gated art slice. |

## Sub-problem Index

| ID | Title | Sequence | Status | Upstream | Downstream | Next action |
|---|---|---:|---|---|---|---|
| SP-001 | Core app, rooms, auth, stores | 1 | 🔵 ACTIVE | None observed | SP-002, SP-003, SP-004, SP-005, SP-006 | Reconciliation is committed; later closeout should browser-verify authenticated membership and chat flows. |
| SP-002 | Message presentation system | 2 | ✅ COMPLETE | SP-001 | Chat UX and SP-006 | Preserve the bounded catalog contract while SP-006 begins. |
| SP-003 | Visual assets and avatars | 3 | 🔵 ACTIVE | SP-001 | SP-004 and chat identity | Runtime wordmark and portraits are accepted; rerun their dedicated pipelines only when assets or framing change. |
| SP-004 | Login/setup/auth visual flow | 4 | ✅ COMPLETE | SP-001, SP-003 | Preserve the accepted committed flow; rerun visual QA only after relevant changes. |
| SP-005 | Supabase persistence and realtime | 5 | 🔵 ACTIVE | SP-001 | Production data sync | Verify RLS/read policies and realtime behavior. |
| SP-006 | Bounded message classification | 6 | 🟡 READY NEXT | SP-001, SP-002 | Automatic presentation selection | Define contract and evaluation data before model integration. |
| SP-007 | Approval-gated art generation | 7 | ⚪ DEFERRED | SP-003, SP-006 | Generated portraits, rooms, and scene moments | Wait for SP-006 acceptance, then implement one reviewed asset slice. |

## Sub-problems

### SP-001 — Core app, rooms, auth, stores

#### Goal and boundaries

Provide the working base app: room/world navigation, login/authentication, profile preferences, messages, and swappable persistence. Avoid overbuilding AI features before the core experience is stable.

#### Dependencies and downstream impact

All visual and presentation work depends on stable room, account, message, and profile contracts.

#### Current state and acceptance criteria

- State: 🔵 ACTIVE
- Evidence: `README.md`, `package.json`, `app/api/*`, `app/stores/*`, and `docs/ROADMAP.md` describe a Next.js app with JSON/SQLite/Supabase stores, route handlers, and credential-backed sessions.
- Acceptance criteria: `npm run check` passes; login/session restore, room membership, room switching, message read/write, and profile memory work in browser.

#### Accumulated accomplishments

- Route handler and store architecture exists.
- Supabase support is scaffolded per roadmap notes.
- Runtime room, avatar, and message-presentation assets exist.
- `npm run check` passed on 2026-07-18T10:21:43-05:00 against the dirty worktree.
- Chatroom members option exists in the current dirty worktree: `Members` header toggle opens a Room Cast panel, shows account members with selected world avatars and line counts, searches existing accounts, and adds accounts through `/api/members`.
- NEXT-004 reconciled the current dirty tree into four ownership clusters: chat UI/motion (`app/page.tsx`, `app/globals.css`, sad shell); presentation contract/debug support (runtime helper, catalog, test, package scripts); documentation/concept-art path cleanup; and package-lock refresh. The concept-art changes intentionally relocate the old typo-path image to `docs/ReferenceImages/Concept/chat_evolution_art.png` and preserve the previously occupied concept as untracked `kokoroe-manga-chat-concept.png`.
- Current reconciliation validation: `npm run check` passed (2 files / 21 tests, TypeScript, Next.js 16.2.10 build), `git diff --check` passed, and logged-out desktop plus 390x844 mobile login rendered without console errors or horizontal overflow. The mobile panel is taller than one viewport and scrolls to expose all controls. No credentials were submitted and no app data was mutated.

#### Branches and worktrees

| Branch | Worktree | Base commit | Last observed HEAD | State |
|---|---|---|---|---|
| `main` | `/Users/safwankamal/Desktop/Code/Kokoroe` | Unknown | `45367e0` | Dirty; uncommitted changes observed. |
| `codex/reconcile-kokoroe-dirty-worktree` | same | `45367e0` | `bf90e7e` | Four product/tooling commits created; ledger-only handoff commit pending. |

#### Chat sessions

| Session | Link | Started / updated | Git state | Scope | Outcome |
|---|---|---|---|---|---|
| Unavailable from current surface |  | 2026-07-18T09:47:50-05:00 | `main` / `45367e0`, dirty | Ledger initialization and asset-work handoff | Ledger initialized from repository evidence. |
| Unavailable from current surface |  | 2026-07-18T10:19:35-05:00 | `main` / `45367e0`, dirty | Chatroom members option verification | Confirmed current dirty worktree contains members API/UI/store integration. `npm run check` passed. Started `npm run dev`; `GET /api/health` returned ok and `GET /api/rooms` returned member counts for all 4 rooms. Browser screenshot inspection not completed because browser-control tool was unavailable. |
| Unavailable from current surface |  | Start unavailable; updated 2026-07-18T11:27:30-05:00 | `main` / `45367e0`, dirty; no commit | SP-001 / NEXT-004 dirty-worktree reconciliation | Inspected all tracked/untracked changes, identified ownership/risk clusters, passed `npm run check` and `git diff --check`, and visually inspected logged-out desktop/mobile login. `npm ls --depth=0` reported one extraneous local transitive package; authenticated setup/chat remains unverified. No user changes were reverted, staged, or committed. |
| Unavailable from current surface |  | Start unavailable; updated 2026-07-18T15:15:09-05:00 | `codex/reconcile-kokoroe-dirty-worktree` / `45367e0..bf90e7e`, committed; ledger commit pending | SP-001 reconciliation; related SP-002–SP-007 | Created four reviewable commits, resolved CONFLICT-001, normalized generated state through a production build, passed 24 tests/typecheck/build/diff checks, and recorded classification-before-art sequencing. No push, merge, rebase, or external model call occurred. |

Primary: SP-003. Related: SP-001, SP-002, SP-004, SP-005. No commit made. No tests run during ledger initialization.

#### Decisions

- Keep persistence behind store adapters and route handlers.
- Keep current AI features deferred unless explicitly requested.
- Chatroom members are account memberships. The Room Cast panel may show the account's selected avatar for the room, but adding a member must not create a sendable avatar or allow sending as that account.

#### Blockers and open questions

- Members panel still needs screenshot-based browser inspection for layout, clipping, and mobile behavior.
- The prior ownership ambiguity is resolved on `codex/reconcile-kokoroe-dirty-worktree`; review or merge the five-commit branch before starting classifier implementation from it.
- Local `node_modules` is not perfectly aligned with the refreshed lockfile: `npm ls --depth=0` reports extraneous `@emnapi/wasi-threads@1.2.2`. This did not block tests/typecheck/build; use a clean install only when the user authorizes dependency-environment reconciliation.
- `next-env.d.ts` was normalized through `npm run check`; do not hand-edit future generated drift.

#### Future directions

- Browser verification of authenticated setup, membership, chat, and presentation motion is still required before the major UI changes can be considered accepted.
- Recommended SP-001 closeout order: normalize generated/dependency state, exercise the authenticated acceptance flow with disposable local test data, rerun the full check, then ask the user to approve intentional commit boundaries.

### SP-002 — Message presentation system

#### Goal and boundaries

Keep expressive manga chat bubbles catalog-driven, readable, and browser-rendered with real text.

#### Dependencies and downstream impact

Depends on message contracts from SP-001. Future AI classification can only select catalog ids.

#### Current state and acceptance criteria

- State: ✅ COMPLETE
- Evidence: `docs/MESSAGE_PRESENTATION_PIPELINE.md`, `content/message-presentations/catalog.json`, `app/message-presentations.ts`, `app/globals.css`, and `public/message-templates/*.svg`.
- Acceptance criteria: presentation catalog tests pass; changed shells fit long text in browser desktop and narrow layouts; portraits align beneath tails.

#### Accumulated accomplishments

- Catalog owns shell, typography role, ink, motion, max character limits, classifier hints, and safe-area metrics.
- Runtime SVG shell assets exist.
- Sad shell tail dots were removed from `public/message-templates/message-template-sad.svg`; `app/page.tsx` now appends `messageTemplateAssetVersion` to message-template image URLs to force browser refresh of updated shell art.
- Bubble rows now use consistent incoming/outgoing anchors; tone-specific SVG overlays share their shell viewBox and mirror with outgoing art.
- Exact single-word debug messages can force presentation ids for visual testing.
- Grandiose uses gold glitter, Exclaim uses speed-line flashes, Shout uses a strong exponential pop-in, Whisper uses blue motes and a contour trace, and Mutter uses green ticks with sequential green-and-gold dots.
- The newest three messages keep repeatable effects active after reload; historical effects stay mounted but paused/hidden until hover or keyboard focus.
- Scribble is a one-shot procedural construction: a visible nib traces and fills the clipped shell, hands off to `message-template-scribble.svg`, then reveals the copy. Reduced motion shows the finished SVG immediately.
- Current-chat verification: `npm run check` passed (2 test files, 21 tests, TypeScript, Next.js production build), `git diff --check` passed, localhost returned HTTP 200, and desktop plus 390px-width geometry were visually inspected in the in-app browser.
- Sad bubble was later refactored again into a clean cloud-only SVG shell plus runtime `.sad-rain-rig` elements. The latest implementation uses 12 separate animated raindrop elements with varied position, length, opacity, duration, and delay rather than tiled CSS stripe backgrounds.
- NEXT-002 moved the 12 drops behind and around the stationary cloud, strengthened their blue-gray ink, varied perimeter/below-shell placement and rhythm, and replaced broad faint splash bars with two restrained ground splashes. Desktop and 390x844 screenshots show readable rain without text interference or document-level overflow. The temporary JSON-store QA account and `sad` message were removed by restoring the exact pre-QA file.

#### Branches and worktrees

| Branch | Worktree | Base commit | Last observed HEAD | State |
|---|---|---|---|---|
| `main` | `/Users/safwankamal/Desktop/Code/Kokoroe` | Unknown | `45367e0` | Dirty; message presentation files modified. |
| `codex/reconcile-kokoroe-dirty-worktree` | same | `45367e0` | `bf90e7e` | Presentation contract and runtime changes committed in `2f85519` and `665baea`. |

#### Chat sessions

| Session | Link | Started / updated | Git state | Scope | Outcome |
|---|---|---|---|---|---|
| Unavailable from current surface |  | 2026-07-18T09:47:50-05:00 | `main` / `45367e0`, dirty | Ledger initialization | Existing modified presentation files recorded. |
| Unavailable from current surface |  | 2026-07-18T10:18:51-05:00 | `main` / `45367e0`, dirty; `app/page.tsx` and `public/message-templates/message-template-sad.svg` modified | Suggested title `SP-002 — Sad Bubble Dot Cleanup`; removed sad shell tail dots and cache-busted runtime template URLs | Implemented but uncommitted. Verified served SVG has no `<circle>` elements; rendered mirrored SVG/portrait preview visually; `npm run typecheck` passed. |
| `019f7088-4e63-7323-a377-6e1b41b3c6a3` | [SP-002 — Auth, Supabase, UI and Bubbles](codex://threads/019f7088-4e63-7323-a377-6e1b41b3c6a3) | Start unavailable; updated 2026-07-18T11:06:02-05:00 | `main` / `45367e0`, dirty and uncommitted | UI polish, auth/Supabase/backend setup, bubble alignment, tone-specific motion, reload/hover lifecycle, procedural Scribble construction, ledger reconciliation, and chat-title correction | Implemented and browser-verified expressive presentation motion. The current combined worktree passes 21 tests, TypeScript, production build, and diff checks. Corrected skill-compliant composite title suggested as `SP-002 — Auth, Supabase, UI and Bubbles`; no confirmed rename action or commit was recorded. |
| Unavailable from current surface |  | 2026-07-18T10:22:17-05:00 | `main` / `45367e0`, dirty; `app/page.tsx`, `app/globals.css`, `public/message-templates/message-template-sad.svg`, and docs modified | Sad bubble rain animation refactor | Implemented but uncommitted. Replaced repeating-background rain with 12 individual `.sad-rain-rig` drops around the cloud shell. `npm run typecheck`, `npm run build`, and `git diff --check` passed. Browser DOM confirmed 12 live `kokoroe-sad-raindrop` animations; screenshot capture timed out, so visual acceptance remains open. |
| Unavailable from current surface |  | Start unavailable; updated 2026-07-18T11:59:11-05:00 | `main` / `45367e0`, dirty; no commit | SP-002 / NEXT-002 sad-rain visual acceptance | Screenshot-inspected the live authenticated chat at desktop and 390x844, tuned only `app/page.tsx` rain data and `app/globals.css` rain styling, preserved the stationary shell/text, and accepted the result. Mobile document width stayed 390px; 12 drops remained live. `npm run check` passed (21 tests, TypeScript, build), `git diff --check` passed, and disposable JSON QA data was restored exactly. No unrelated chat/backend changes were edited, staged, or committed. |
| Unavailable from current surface |  | Start unavailable; updated 2026-07-18T15:15:09-05:00 | `codex/reconcile-kokoroe-dirty-worktree` / `2f85519`, `665baea`; committed | CONFLICT-001 resolution and presentation boundary | Limited automatic effects to recent sad rain and one-shot Scribble; other shell-specific rigs now remain paused until hover/focus. Added a tested policy helper; 24 tests, typecheck, build, and diff checks passed. |

#### Decisions

- Do not bake text into bubble assets.
- Future classifier must emit allow-listed catalog ids only.
- Keep settled text stages stable for repeatable ambient effects; Scribble is the deliberate one-shot construction exception and must finish its SVG handoff before copy appears.
- Latest user direction rejects generic or ambient bubble motion. Further motion work should be shell-specific, visually justified, and screenshot-verified before being considered accepted.
- Sad motion belongs behind and around the cloud shell: keep its copy and frame stable, keep the strongest drops out of the text safe area, and use only restrained splash marks below the shell.

#### Blockers and open questions

- No current presentation blocker. SP-006 must consume only the allow-listed catalog contract and fall back to `plain` at low confidence.

#### Future directions

- Continue tightening shell safe areas and responsive sizing based on screenshot inspection.

### SP-003 — Visual assets and avatars

#### Goal and boundaries

Maintain reference and runtime visual assets for room scenes, login scene cycling, avatars, logos, and manga UI references. Runtime avatars must be approved single-character square portraits, not rough generations or contact sheets.

#### Dependencies and downstream impact

Feeds setup/login visuals and chat identity. Depends on SP-001 runtime catalogs and avatar import script.

#### Current state and acceptance criteria

- State: ✅ COMPLETE
- Evidence: `docs/AVATAR_PIPELINE.md`, `content/avatars/catalog.json`, `public/avatars/*/*/portrait.png`, `docs/ReferenceImages/Avatars/`, `docs/ReferenceImages/Room Themes/`, `docs/ReferenceImages/Login Scene Cycle Normalized/`, and `docs/ReferenceImages/Logo/`.
- Acceptance criteria: candidate portraits are visually reviewed, imported through `npm run avatar:add`, catalog paths resolve, and setup/chat browser views show readable circular portraits.

#### Accumulated accomplishments

- Reference room themes and login scene cycle images exist.
- Runtime avatar catalog and portraits exist for several rooms.
- Initial avatar generation attempts produced rough/cropped candidates that were not approved or imported as runtime avatars.
- Earlier avatar board/crop attempts were superseded by individually generated full-square portraits.
- Six generated full-square avatar candidates were saved in `docs/ReferenceImages/Character Profile/` and mirrored to `docs/ReferenceImages/Avatars/`: radio-club tinkerer, midnight station poet, ramen cartographer, rainy groundskeeper, sports announcer, and archive night guard. `sips` verified each candidate is `768x768`; `avatar-full-square-preview.png` was visually inspected.
- A prior session recorded the six candidates as reference-only, but NEXT-001 reconciliation proved that all six corresponding runtime portraits and catalog entries were already present and byte-identical at `HEAD`; the old ledger claim was stale.
- NEXT-001 approved all six full portraits under the centering rubric. No regeneration was necessary: each is a single character, has a complete and naturally centered face, reads at setup-card size, and belongs to its intended world. The `804x530` `avatar-full-square-preview.png` remained reference-only and was not imported.
- Six dry-run and six real `npm run avatar:add -- --replace` commands succeeded for Hina, Ink, Ame, Shiori, Yuto, and Rei. The importer produced no Git diff because runtime images and catalog metadata already matched the accepted candidates exactly.
- Browser QA used a disposable local account whose JSON-store mutation was backed up and restored byte-for-byte afterward. Desktop setup and chat visually confirmed each full portrait and circular stamp, world association, message portrait loading, and readable face framing. At 390x844, the app reported `scrollWidth: 390`, all tested avatar images loaded at natural `768x768`, and setup/card geometry stayed within the viewport; the narrow screenshot raster itself was incorrectly scaled by the in-app browser, so mobile visual evidence is geometry-backed rather than screenshot-accepted. Browser console warnings/errors were empty.
- NEXT-001 validation passed: `npm run typecheck`, `npm run build`, and `git diff --check`. No application code, catalog, or runtime portrait diff was introduced.
- Generated Kokoroe wordmark PNG was saved as reference art in `docs/ReferenceImages/Logo/kokoroe-logo-wordmark-generated-2026-05-21.png`.
- Trace-friendly PNG variants and a vectorized SVG were created under `docs/ReferenceImages/Logo/`; the cleaned SVG `kokoroe-logo-wordmark-vectorized-cleaned-2026-05-21.svg` removes converter noise, has no embedded raster image, has no opacity-zero paths, and contains 48 paths plus one ellipse after replacing the first-`o` dark scribble with a coral oval accent.
- `docs/ReferenceImages/Logo/kokoroe-logo-svg-preview-cleaned.png` was rendered from the cleaned SVG with `sharp` and visually inspected.
- Current dirty runtime includes `public/brand/kokoroe-logo-wordmark.svg`, referenced by the login screen in `app/page.tsx`.

#### Branches and worktrees

| Branch | Worktree | Base commit | Last observed HEAD | State |
|---|---|---|---|---|
| `main` | `/Users/safwankamal/Desktop/Code/Kokoroe` | Unknown | `45367e0` | Dirty; asset/docs changes observed. |

#### Chat sessions

| Session | Link | Started / updated | Git state | Scope | Outcome |
|---|---|---|---|---|---|
| Unavailable from current surface |  | 2026-07-18T09:47:50-05:00 | `main` / `45367e0`, dirty | Avatar/profile-pic generation request and ledger setup | Rough local avatar generation was not accepted into runtime; ledger initialized. |
| Unavailable from current surface |  | 2026-07-18T10:17:38-05:00 | `main` / `45367e0`, dirty; `.codex/PROJECT_LEDGER.md` untracked | Kokoroe logo reference generation and SVG cleanup | Saved generated logo reference assets, made trace-friendly PNG variants, cleaned vectorized SVG, removed first-`o` dark scribble, added coral accent, and rendered/inspected preview. No runtime integration, tests, commit, or app build performed. |
| Unavailable from current surface |  | 2026-07-18T10:19:20-05:00 | `main` / `45367e0`, dirty; `.codex/PROJECT_LEDGER.md` untracked | Full-square avatar candidate generation and save-path correction | Saved six `768x768` PNG reference candidates to `docs/ReferenceImages/Character Profile/` and `docs/ReferenceImages/Avatars/`; visual preview inspected. No `npm run avatar:add`, app test, commit, or runtime catalog update performed. |
| Unavailable from current surface |  | Start unavailable; updated 2026-07-18T11:44:09-05:00 | `main` / `45367e0`, dirty; no commit | SP-003 / NEXT-001 avatar intake reconciliation and browser QA | Approved all six candidates without regeneration; dry-ran and reran six intentional importer replacements; proved runtime/catalog already matched `HEAD`; visually inspected desktop setup/chat across all identities; verified narrow DOM geometry and asset loads; passed typecheck/build/diff checks; restored disposable QA store state exactly. |

#### Decisions

- Follow `docs/AVATAR_PIPELINE.md` before adding or replacing runtime portraits.
- Never publish contact sheets, multi-character previews, or reference-only images as runtime avatars.
- Keep generated logo source/reference work in `docs/ReferenceImages/Logo/`; the user-requested runtime wordmark lives under `public/brand/`.
- Keep generated candidate portraits as full-square images without circular mattes; let runtime CSS/catalog thumbnail settings handle circular cropping.

#### Blockers and open questions

- The in-app browser's 390x844 screenshot raster was scaled incorrectly even though DOM geometry and overflow measurements were correct; use a reliable narrow screenshot surface for final mobile visual acceptance if portrait framing changes later.

#### Future directions

- Re-run the approval/import/browser pipeline only when adding or changing a portrait; regenerate only candidates that fail the full-square centering rubric.
- Re-run runtime wordmark QA only when the wordmark asset or login framing changes; NEXT-003 accepted its current desktop and mobile placement.

### SP-004 — Login/setup/auth visual flow

#### Goal and boundaries

Implement/refine Kokoroe login and setup as manga-auth flow, including scene art without destabilizing the form.

#### Dependencies and downstream impact

Depends on SP-001 auth contracts and SP-003 login scene assets.

#### Current state and acceptance criteria

- State: 🔵 ACTIVE
- Evidence: `docs/DESIGN_DECISIONS.md` records login direction; `docs/ReferenceImages/Concept/login-panel-blend-concept.png` records the latest vertical blended-panel concept; `app/page.tsx` renders the dirty runtime login/setup flow with scene-cycle art, runtime wordmark, dream-world selection, and avatar selection after world choice.
- Acceptance criteria: login form remains stable and usable; scene art cycles without layout shift; browser inspection verifies desktop and mobile layout.

#### Accumulated accomplishments

- Login concept art and normalized scene-cycle assets exist in `docs/ReferenceImages/`.
- Runtime current login scene assets exist in `public/login-scene-current/`.
- Generated a reference-only login-page composition concept showing a top manga bedroom/rain scene blending into a paper login form with Kokoroe branding, email/password fields, sign-in button, and create-account option.
- Current dirty app implementation separates login from dream-world/avatar setup. Login uses a top art panel fading into form content; setup combines joined-world cards, public world search, selected-world scene art, and world-scoped avatar choice.
- `npm run check` passed on 2026-07-18T10:21:43-05:00.
- NEXT-003 browser-inspected login and authenticated setup at 1440x1000 and 390x844. Desktop login remains a centered `700x849` panel with all controls visible; desktop setup remained within a `980x653` panel. Mobile login now uses a shorter `47vh` art panel, `54%` fade/halftone transition, and stronger negative form overlap, reducing document height from 1043px to 961px while keeping the artwork, wordmark, primary action, and scrollable secondary action coherent.
- Setup copy now reads “Choose a dream world, then pick the character identity you'll carry into it.” The mobile mood badge and header spacing were tightened, reducing header height from about 258px to 230px. At 390px the setup document width remained exactly 390px with no horizontal overflow; viewport screenshots accepted both the top world hierarchy and the scrolled world/avatar/action section.
- NEXT-003 validation passed: 2 test files / 21 tests, TypeScript, Next.js 16.2.10 production build, and `git diff --check`. Browser console warnings/errors were empty. A disposable local account exercised account creation, login-to-setup transition, world/avatar setup, and logout; after detecting a stale in-memory dev-store rewrite, the exact Kokoroe dev process was restarted and the pre-QA JSON file was restored byte-for-byte.

#### Branches and worktrees

| Branch | Worktree | Base commit | Last observed HEAD | State |
|---|---|---|---|---|
| `main` | `/Users/safwankamal/Desktop/Code/Kokoroe` | Unknown | `45367e0` | Dirty. |
| `codex/reconcile-kokoroe-dirty-worktree` | same | `45367e0` | `bf90e7e` | Accepted login/setup runtime and documentation committed in `665baea` and `21cb409`. |

#### Chat sessions

| Session | Link | Started / updated | Git state | Scope | Outcome |
|---|---|---|---|---|---|
| Unavailable from current surface |  | 2026-07-18T09:47:50-05:00 | `main` / `45367e0`, dirty | Ledger initialization | Existing design direction recorded. |
| Unavailable from current surface |  | 2026-07-18T10:19:03-05:00 | `main` / `45367e0`, dirty | Login concept generation and reference save | Saved `docs/ReferenceImages/Concept/login-panel-blend-concept.png`; visually inspected concept; no runtime implementation or tests. |
| Unavailable from current surface |  | 2026-07-18T10:23:47-05:00 | `main` / `45367e0`, dirty; no commit | Ledger reconciliation for handoff | Verified current dirty login/setup implementation, runtime logo path, login-scene assets, and `npm run check` pass. Browser visual inspection not run in this ledger-only turn. |
| Unavailable from current surface |  | Start unavailable; updated 2026-07-18T12:12:52-05:00 | `main` / `45367e0`, dirty; no commit | SP-004 / NEXT-003 login/setup visual acceptance | Screenshot-inspected desktop and 390x844 login/setup, tightened only mobile art/fade/form overlap and setup header spacing, refined dream-world copy, accepted desktop/mobile hierarchy and lower setup actions, passed full checks, and restored disposable JSON data byte-for-byte after restarting the repo dev server. No AI, chat, room, or backend logic was changed. |

#### Decisions

- Login should use art and manga-panel language, not a generic centered SaaS card.
- Current preferred direction in design docs: single vertical manga panel with rotating art at top fading into paper login area below.
- The latest concept clarifies the transition: use ink wash, halftone, rain streaks, and desk shadow to blend top artwork into the lower auth controls while minimizing blank whitespace.

#### Blockers and open questions

- No current SP-004 blocker; preserve the accepted implementation while SP-006 begins.

#### Future directions

- Re-run login/setup visual acceptance only when structure, scene art, wordmark, or responsive styling changes; preserve the current vertical blended-panel direction.

### SP-005 — Supabase persistence and realtime

#### Goal and boundaries

Support hosted Supabase persistence and narrow realtime message sync without moving write authority to the client.

#### Dependencies and downstream impact

Depends on SP-001 route/store contracts. Downstream: production deployment and multi-user room sync.

#### Current state and acceptance criteria

- State: 🔵 ACTIVE
- Evidence: `docs/ROADMAP.md`, `app/stores/supabase-store.ts`, `app/realtime.ts`, and package dependencies.
- Acceptance criteria: hosted Supabase store works with server-owned message writes; client subscriptions only read allowed active-room inserts; RLS policies are narrow and documented.

#### Accumulated accomplishments

- Supabase adapter and realtime module exist.
- Roadmap states initial migration, RLS, and server-only REST adapter have been verified against hosted project.

#### Branches and worktrees

| Branch | Worktree | Base commit | Last observed HEAD | State |
|---|---|---|---|---|
| `main` | `/Users/safwankamal/Desktop/Code/Kokoroe` | Unknown | `45367e0` | Dirty. |

#### Chat sessions

| Session | Link | Started / updated | Git state | Scope | Outcome |
|---|---|---|---|---|---|
| Unavailable from current surface |  | 2026-07-18T09:47:50-05:00 | `main` / `45367e0`, dirty | Ledger initialization | Existing Supabase/realtime state recorded from docs. |

#### Decisions

- Message writes remain server-owned API calls.
- Design narrow RLS read policies before expanding client-side realtime.

#### Blockers and open questions

- Hosted Supabase details were not independently revalidated during ledger initialization.

#### Future directions

- Verify current Supabase env/migration/RLS state before changing realtime.

### SP-006 — Bounded message classification

#### Goal and boundaries

Classify message context into one allow-listed presentation id without rewriting the user's text or generating visual styling. Keep the model behind a typed contract with confidence and a deterministic `plain` fallback.

#### Dependencies and downstream impact

Depends on SP-001 message flow and the completed SP-002 catalog contract. Its accepted outputs gate SP-007 and any later message masking work.

#### Current state and acceptance criteria

- State: 🟡 READY NEXT
- Evidence: `content/message-presentations/catalog.json`, `app/message-presentations.ts`, `docs/MESSAGE_PRESENTATION_PIPELINE.md`, and `docs/AI_FEATURE_NOTES.md` already define bounded ids and fallback behavior.
- Acceptance criteria: a representative labeled evaluation set exists; the typed response validates `presentationId`, confidence, and optional concise reason; invalid/low-confidence output becomes `plain`; original text is preserved; tests cover allowed ids, threshold behavior, malformed output, and provider failure.

#### Decisions

- Begin with classification only. Do not combine rewriting, art generation, or arbitrary CSS/asset output.
- Define the evaluation set and acceptance threshold before selecting or integrating a model provider.
- Keep provider-specific code behind a narrow interface so local and hosted model options remain replaceable.

#### Blockers and open questions

- No implementation blocker. Provider/model choice should follow the evaluation contract rather than precede it.

#### Future directions

- After offline evaluation, integrate classification at a server-owned boundary and expose automatic selection behind an explicit rollout control.

### SP-007 — Approval-gated art generation

#### Goal and boundaries

Generate coherent manga-style portraits, room art, or occasional scene moments without publishing raw model output directly into runtime catalogs.

#### Dependencies and downstream impact

Depends on SP-003 asset-intake contracts and acceptance of SP-006 behavior. Downstream consumers include avatars, room scenes, and future contextual visual moments.

#### Current state and acceptance criteria

- State: ⚪ DEFERRED
- Evidence: `docs/AVATAR_PIPELINE.md`, `docs/CONCEPT_ART_NOTES.md`, and `docs/AI_FEATURE_NOTES.md` define approval and consistency requirements.
- Acceptance criteria for the first slice: one bounded asset type, reproducible metadata, explicit human review, validated import through the existing pipeline, and browser inspection before runtime exposure.

#### Decisions

- Start only after SP-006 classifier acceptance.
- Model output remains reference material until approved; no direct runtime publication.
- Reuse existing avatar/room asset contracts rather than creating a parallel generated-asset path.

#### Blockers and open questions

- Blocked on SP-006 acceptance and selection of the first bounded asset type.

#### Future directions

- Prefer one reviewed portrait or room-scene workflow before attempting conversation-driven scene generation.

## Prioritized Future Chats

| Task | Target | Priority | Readiness | Why / dependencies | Scope and non-goals | Outcome / verification | Branch | Start chat |
|---|---|---|---|---|---|---|---|---|
| NEXT-001 | SP-003 | P0 | OPTIONAL | Completed for the current six portraits at `main` / `45367e0`; rerun only when a portrait candidate or framing value changes. | Reapply the approval/import/browser pipeline to changed portraits only; never publish previews/contact sheets and do not regenerate accepted art without a new reason. | Current six portraits pass full-square review, importer validation, desktop setup/chat inspection, narrow geometry/asset-load checks, typecheck, build, and diff checks. | `codex/next-001-avatar-intake` | [Start chat](codex://new?prompt=Use%20%24maintain-project-ledger.%20Read%20.codex%2FPROJECT_LEDGER.md%2C%20starting%20with%20Resume%20Here.%20Work%20on%20SP-003%20%2F%20NEXT-001%20only%20if%20an%20avatar%20candidate%20or%20thumbnail%20framing%20has%20changed.%20Review%20the%20changed%20full-square%20portrait%2C%20regenerate%20only%20if%20it%20fails%20centering%2C%20import%20only%20approved%20art%20through%20npm%20run%20avatar%3Aadd%2C%20inspect%20setup%20and%20chat%20views%2C%20verify%20Git%20state%2C%20respect%20recorded%20decisions%2C%20and%20update%20the%20ledger%20at%20handoff.&path=%2FUsers%2Fsafwankamal%2FDesktop%2FCode%2FKokoroe) |
| NEXT-002 | SP-002 | P0 | OPTIONAL | Completed for the current sad rig at `main` / `45367e0`; rerun only if rain data, styling, shell art, or responsive bubble geometry changes. | Reapply screenshot QA to the changed sad rig only; keep the cloud/text stationary and do not touch unrelated chat/backend or non-sad motion. | Current rig has accepted desktop and 390x844 screenshots, 12 live drops, no document overflow, passing 21 tests/typecheck/build, and clean diff checks. | `codex/next-002-sad-rain-qa` | [Start chat](codex://new?prompt=Use%20%24maintain-project-ledger.%20Read%20.codex%2FPROJECT_LEDGER.md%2C%20starting%20with%20Resume%20Here.%20Work%20on%20SP-002%20%2F%20NEXT-002%20only%20if%20the%20sad-rain%20implementation%20or%20shell%20geometry%20has%20changed.%20Screenshot-inspect%20the%20running%20chat%20at%20desktop%20and%20mobile%20widths%2C%20keep%20the%20cloud%20and%20copy%20stationary%2C%20avoid%20generic%20motion%2C%20do%20not%20touch%20unrelated%20chat%2Fbackend%20changes%2C%20verify%20current%20Git%20state%2C%20respect%20recorded%20decisions%2C%20and%20update%20the%20ledger%20at%20handoff.&path=%2FUsers%2Fsafwankamal%2FDesktop%2FCode%2FKokoroe) |
| NEXT-003 | SP-004 | P0 | OPTIONAL | Completed for the current dirty login/setup implementation at `main` / `45367e0`; rerun only if structure, scene art, wordmark, or responsive CSS changes. | Reapply desktop/mobile visual acceptance to changed login/setup surfaces only; do not add AI features or rebuild unrelated chat logic. | Current login/setup passes 1440x1000 and 390x844 viewport inspection, no-overflow geometry, 21 tests, TypeScript, production build, diff checks, and exact disposable-data restoration. | `codex/next-003-login-setup-visual-verify` | [Start chat](codex://new?prompt=Use%20%24maintain-project-ledger.%20Read%20.codex%2FPROJECT_LEDGER.md%2C%20starting%20with%20Resume%20Here.%20Work%20on%20SP-004%20%2F%20NEXT-003%20only%20if%20the%20login%2Fsetup%20structure%2C%20scene%20art%2C%20wordmark%2C%20or%20responsive%20CSS%20has%20changed.%20Browser-inspect%20desktop%20and%20mobile%20sizes%2C%20preserve%20the%20accepted%20vertical%20blend%2C%20do%20not%20touch%20AI%20or%20unrelated%20chat%20logic%2C%20verify%20Git%20state%2C%20respect%20recorded%20decisions%2C%20and%20update%20the%20ledger%20at%20handoff.&path=%2FUsers%2Fsafwankamal%2FDesktop%2FCode%2FKokoroe) |
| NEXT-004 | SP-001 | P3 | OPTIONAL | Completed for the 2026-07-18T11:27:30-05:00 snapshot; rerun only if the dirty tree changes materially or immediately before an intentional commit. | Re-inspect diffs and checks without reverting user changes; do not stage or commit without user direction. | Current snapshot has a clear ownership/risk report, passing full checks, and logged-out responsive QA; authenticated UI remains outside this pass. | `codex/next-004-worktree-reconcile` | [Start chat](codex://new?prompt=Use%20%24maintain-project-ledger.%20Read%20.codex%2FPROJECT_LEDGER.md%2C%20starting%20with%20Resume%20Here.%20Work%20on%20SP-001%20%2F%20NEXT-004.%20Inspect%20the%20current%20dirty%20worktree%2C%20summarize%20changed%20files%20and%20risks%2C%20run%20appropriate%20checks%2C%20do%20not%20revert%20user%20changes%20without%20explicit%20request%2C%20and%20update%20the%20ledger%20at%20handoff.&path=%2FUsers%2Fsafwankamal%2FDesktop%2FCode%2FKokoroe) |
| NEXT-005 | SP-006 | P0 | READY | Core presentation contract is tested and committed; classification is the user's next requested implementation phase. | Define evaluation data and a typed classifier boundary that emits one allow-listed `presentationId`, confidence, and optional concise reason with `plain` fallback. Do not implement rewriting, art generation, or arbitrary styling. | Tests cover allowed ids, confidence threshold, malformed/provider failures, and original-text preservation; chosen model is justified against the evaluation set. | `codex/next-005-message-classifier` | [Start chat](codex://new?prompt=Use%20%24maintain-project-ledger.%20Read%20.codex%2FPROJECT_LEDGER.md%2C%20starting%20with%20Resume%20Here.%20Work%20on%20SP-006%20%2F%20NEXT-005.%20Build%20the%20bounded%20message-classification%20foundation%20only%3A%20define%20the%20evaluation%20set%20and%20typed%20classifier%20contract%2C%20return%20one%20allow-listed%20presentationId%20with%20confidence%20and%20a%20plain%20fallback%2C%20preserve%20original%20text%2C%20do%20not%20implement%20rewriting%20or%20art%20generation%2C%20verify%20current%20Git%20state%2C%20respect%20recorded%20decisions%2C%20and%20update%20the%20ledger%20at%20handoff.&path=%2FUsers%2Fsafwankamal%2FDesktop%2FCode%2FKokoroe) |
| NEXT-006 | SP-007 | P1 | BLOCKED | Art generation is sequenced after message-classifier acceptance and must reuse the existing approval pipeline. | After SP-006 acceptance, implement one bounded approval-gated asset type. Do not publish raw output directly or add message rewriting. | Generated reference includes metadata, passes human review and existing importer validation, and is browser-inspected before runtime exposure. | `codex/next-006-art-generation` | [Start chat](codex://new?prompt=Use%20%24maintain-project-ledger.%20Read%20.codex%2FPROJECT_LEDGER.md%2C%20starting%20with%20Resume%20Here.%20Work%20on%20SP-007%20%2F%20NEXT-006%20only%20after%20SP-006%20classifier%20acceptance.%20Design%20and%20implement%20the%20first%20approval-gated%20art-generation%20slice%20using%20existing%20avatar%20and%20asset-intake%20contracts%3B%20do%20not%20publish%20model%20output%20directly%20or%20add%20message%20rewriting%2C%20verify%20current%20Git%20state%2C%20respect%20recorded%20decisions%2C%20and%20update%20the%20ledger%20at%20handoff.&path=%2FUsers%2Fsafwankamal%2FDesktop%2FCode%2FKokoroe) |

<details>
<summary>NEXT-001 handoff prompt</summary>

Use `$maintain-project-ledger`. Read `.codex/PROJECT_LEDGER.md`, starting with `Resume Here`. Work on `SP-003` / `NEXT-001` only if an avatar candidate or thumbnail framing has changed. Review the changed full-square portrait, regenerate only if it fails centering, import only approved art through `npm run avatar:add`, inspect setup and chat views, verify current Git state, respect recorded decisions, and update the ledger at handoff.

</details>

<details>
<summary>NEXT-002 handoff prompt</summary>

Use `$maintain-project-ledger`. Read `.codex/PROJECT_LEDGER.md`, starting with `Resume Here`. Work on `SP-002` / `NEXT-002` only if the sad-rain implementation or shell geometry has changed. Screenshot-inspect the running chat at desktop and mobile widths, keep the cloud and copy stationary, avoid generic motion, do not touch unrelated chat/backend changes, verify current Git state, respect recorded decisions, and update the ledger at handoff.

</details>

<details>
<summary>NEXT-003 handoff prompt</summary>

Use `$maintain-project-ledger`. Read `.codex/PROJECT_LEDGER.md`, starting with `Resume Here`. Work on `SP-004` / `NEXT-003`. Browser-inspect the current dirty login and setup flow at desktop and mobile sizes; refine visible layout, art fade, texture transition, dream-world copy, and responsive spacing only as needed; do not add AI features or rebuild unrelated chat logic; verify current Git state, respect recorded decisions, and update the ledger at handoff.

</details>

<details>
<summary>NEXT-004 handoff prompt</summary>

Use `$maintain-project-ledger`. Read `.codex/PROJECT_LEDGER.md`, starting with `Resume Here`. Work on `SP-001` / `NEXT-004`. Inspect the current dirty worktree, summarize changed files and risks, run appropriate checks, do not revert user changes without explicit request, and update the ledger at handoff.

</details>

<details>
<summary>NEXT-005 handoff prompt</summary>

Use `$maintain-project-ledger`. Read `.codex/PROJECT_LEDGER.md`, starting with `Resume Here`. Work on `SP-006` / `NEXT-005`. Build the bounded message-classification foundation only: define the evaluation set and typed classifier contract, return one allow-listed `presentationId` with confidence and a `plain` fallback, preserve original text, do not implement rewriting or art generation, verify current Git state, respect recorded decisions, and update the ledger at handoff.

</details>

<details>
<summary>NEXT-006 handoff prompt</summary>

Use `$maintain-project-ledger`. Read `.codex/PROJECT_LEDGER.md`, starting with `Resume Here`. Work on `SP-007` / `NEXT-006` only after SP-006 classifier acceptance. Design and implement the first approval-gated art-generation slice using existing avatar and asset-intake contracts; do not publish model output directly or add message rewriting, verify current Git state, respect recorded decisions, and update the ledger at handoff.

</details>

## Cross-cutting Decisions

| ID | Decision | Rationale / evidence | Applies to | Status |
|---|---|---|---|---|
| DEC-001 | Use warm manga paper palette and deep ink borders. | `AGENTS.md` and `docs/DESIGN_DECISIONS.md`. | UI and assets | Active |
| DEC-002 | Runtime message presentations are catalog-driven. | `docs/MESSAGE_PRESENTATION_PIPELINE.md`; catalog/runtime files exist. | Chat bubbles and future classifier | Active |
| DEC-003 | Runtime avatars must go through approved intake. | `AGENTS.md` and `docs/AVATAR_PIPELINE.md`. | Avatar assets and catalog | Active |
| DEC-004 | Text stays real HTML/CSS, not baked into art assets. | `docs/DESIGN_DECISIONS.md` and `docs/CONCEPT_ART_NOTES.md`. | Login, bubbles, message UI | Active |
| DEC-005 | Future AI features are deferred and constrained. | `docs/AI_FEATURE_NOTES.md`. | AI masking, classifier, generated assets | Active |
| DEC-006 | Scribble constructs once with a visible nib, resolves to the catalog SVG, then reveals real HTML copy. | Browser-verified implementation in `app/page.tsx`, `app/globals.css`, and `docs/MESSAGE_PRESENTATION_PIPELINE.md`. | Scribble presentation motion | Active |
| DEC-007 | Login auth should use a vertical blended manga panel. | User-requested concept and `docs/ReferenceImages/Concept/login-panel-blend-concept.png`. | Login/auth UI | Active |
| DEC-008 | Project chat titles should preserve a primary `SP-xxx — ...` prefix when a relevant ledger sub-problem exists. | User preference; `/Users/safwankamal/.codex/skills/name-project-chat/SKILL.md` updated outside the repo. | Project continuity and chat naming | Active |
| DEC-009 | Implement bounded message classification before approval-gated art generation. | User direction on 2026-07-18; `docs/ROADMAP.md` and `docs/AI_FEATURE_NOTES.md`. | SP-006 and SP-007 | Active |

## State Conflicts

| ID | Conflicting claims | Branches / commits | Required verification | Status |
|---|---|---|---|---|
| CONFLICT-001 | Prior SP-002 work auto-ran the newest three presentation rigs, while later direction rejected generic or ambient transcript motion. | `codex/reconcile-kokoroe-dirty-worktree` / `665baea` | Resolved: only accepted recent sad rain and one-shot Scribble auto-run; other shell-specific rigs remain paused until hover/focus. Policy is covered by tests in `tests/message-presentations.test.ts`. | Resolved |

## Ledger History

| Timestamp | Branch / commit | Material update |
|---|---|---|
| 2026-07-18T09:47:50-05:00 | `main` / `45367e0` | Initialized ledger from repository evidence; recorded dirty worktree, active sub-problems, avatar intake risk, and prioritized next-chat queue. |
| 2026-07-18T10:17:38-05:00 | `main` / `45367e0` | Recorded Kokoroe logo reference generation, trace-friendly PNG variants, cleaned SVG outcome, visual render inspection, and remaining runtime-integration handoff. |
| 2026-07-18T10:18:51-05:00 | `main` / `45367e0` | Recorded SP-002 sad bubble tail-dot cleanup, runtime template URL cache-bust, typecheck pass, visual preview verification, and suggested chat title. |
| 2026-07-18T10:19:20-05:00 | `main` / `45367e0` | Recorded six full-square generated avatar reference candidates, verified saved paths/dimensions, and updated SP-003/NEXT-001 handoff to require approval and `npm run avatar:add` before runtime use. |
| 2026-07-18T10:19:35-05:00 | `main` / `45367e0` | Recorded members option verification: API/UI/store integration present, `npm run check` passed, dev server started, `/api/health` and `/api/rooms` returned expected room/member data; browser visual inspection remains queued. |
| 2026-07-18T10:21:17-05:00 | `main` / `45367e0` | Recorded verified SP-002 bubble-motion work, procedural Scribble handoff, full validation results, and confirmed chat title/link while preserving concurrent ledger updates. |
| 2026-07-18T10:22:12-05:00 | `main` / `45367e0` | Recorded generated vertical blended login-panel concept, saved reference image path, updated SP-004/NEXT-003 handoff, and noted no runtime implementation or tests. |
| 2026-07-18T10:22:17-05:00 | `main` / `45367e0` | Recorded sad bubble rain refactor from tiled CSS backgrounds to 12 individual animated raindrops, validation results, screenshot timeout, and conflict with earlier generic/ambient bubble motion direction. |
| 2026-07-18T10:23:47-05:00 | `main` / `45367e0` | Reconciled ledger with current dirty runtime login/setup/logo state, recorded `npm run check` pass, and reprioritized NEXT-003 toward browser visual verification. |
| 2026-07-18T10:24:30-05:00 | `main` / `45367e0` | Reconciled Resume Here and NEXT-002 back to the latest SP-002 sad-rain QA handoff after concurrent ledger updates. |
| 2026-07-18T11:03:11-05:00 | `main` / `45367e0` | Verified ledger/Git alignment and recorded a prior unconfirmed suggested composite chat title that was later corrected because it used the wrong primary `SP-*` anchor. |
| 2026-07-18T11:04:15-05:00 | `main` / `45367e0` | Reconciled concurrent SP-001–SP-004 ledger updates, verified the current combined dirty worktree with 21 tests/typecheck/build/diff checks, refreshed SP-002 resume details, and preserved sad-rain visual QA as the next action. |
| 2026-07-18T11:04:40-05:00 | `main` / `45367e0` | Recorded another unconfirmed title suggestion that was later superseded by the corrected SP-002 composite title for this multi-topic Kokoroe thread. |
| 2026-07-18T11:05:33-05:00 | `main` / `45367e0` | Recorded user preference that project chat titles should retain `SP-xxx` prefixes when ledger-linked; `name-project-chat` skill was updated outside the repo. |
| 2026-07-18T11:06:02-05:00 | `main` / `45367e0` | Corrected the current chat-title handoff to preserve the SP-002 primary anchor while reflecting the broader auth, Supabase, UI, and bubble workstreams. |
| 2026-07-18T11:27:30-05:00 | `main` / `45367e0` | Completed SP-001 / NEXT-004 reconciliation: mapped 19 dirty paths into ownership/risk clusters, passed 21 tests/typecheck/build/diff checks, inspected logged-out desktop/mobile login, recorded local dependency drift and authenticated-flow limits, and made no code reverts, staging, or commits. |
| 2026-07-18T11:43:34-05:00 | `main` / `45367e0` | Rechecked SP-001 handoff and found post-validation `next-env.d.ts` generated-state drift, no live Next dev process, and a 20-path dirty tree; prioritized generated-state normalization followed by authenticated acceptance testing before commit-boundary decisions. |
| 2026-07-18T11:44:09-05:00 | `main` / `45367e0` | Completed SP-003 / NEXT-001: approved six centered full-square portraits without regeneration, reconciled stale ledger claims against byte-identical runtime/catalog state, reran importer dry/real replacements, inspected setup/chat framing, passed typecheck/build/diff checks, restored disposable QA data exactly, and normalized the transient `next-env.d.ts` dev-route import. |
| 2026-07-18T11:59:11-05:00 | `main` / `45367e0` | Completed SP-002 / NEXT-002: tuned sad rain behind and around the stable cloud, accepted desktop and 390x844 screenshots, passed 21 tests/typecheck/build/diff checks, restored disposable JSON QA data exactly, and left unrelated dirty changes untouched. |
| 2026-07-18T12:12:52-05:00 | `main` / `45367e0` | Completed SP-004 / NEXT-003: accepted desktop/mobile login and setup, tightened mobile art/fade overlap and setup spacing, refined dream-world copy, accepted runtime wordmark placement, passed 21 tests/typecheck/build/diff checks, restored disposable JSON QA data exactly after restarting the stale dev process, and left unrelated logic untouched. |
| 2026-07-18T15:15:09-05:00 | `codex/reconcile-kokoroe-dirty-worktree` / `bf90e7e` | Reconciled the mixed worktree into four product/tooling commits, resolved CONFLICT-001 with tested interaction-driven effect policy, passed 24 tests/typecheck/build/diff checks, normalized generated state, and queued SP-006/NEXT-005 classification before blocked SP-007/NEXT-006 art generation. |
