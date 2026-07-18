# Design Decisions

This file records project-level decisions that should be remembered across coding sessions.

When a design or product decision becomes stable, add it here instead of relying only on chat history.

## UI Style

The app should feel manga-inspired, expressive, playful, and human-made.

Avoid generic rectangular chat capsules stacked vertically.

Prefer:

- Irregular chat bubbles
- Manga panel-inspired layout sections
- Expressive borders
- Slight asymmetry
- Human-drawn-feeling shapes
- Fun but readable typography
- World-specific visual flavor

## Chat Bubble Direction

Chat bubbles should not look too perfect.

They may use:

- Slightly uneven shapes
- Speech-bubble tails
- Thought-bubble variants
- Panel-like framing
- Subtle rotation or offset when appropriate
- Different styles for different message tones

The bubbles should still remain readable and accessible.

World theme does not determine message bubble shape. Worlds set the scene, palette, motif, and surrounding panel language; the message tone/persona determines the bubble template. Until AI tone selection exists, sent messages may receive a varied/random bubble tone for prototyping.

Message presentation is catalog-driven. `content/message-presentations/catalog.json` is the single source for a presentation's SVG shell, font role, ink role, motion behavior, emotional tags, suitability limit, and validated safe-area geometry. A later tone model may select a valid catalog id; it should not compose raw CSS or arbitrary shell/font combinations. Bubbles begin with a compact preferred text stage, expand horizontally up to a catalog-defined safe max width when the message is longer, then grow vertically from actual wrapped text. Newly composed bubble messages allow up to 120 characters. Compact frames such as scribble and shout yield to `plain` for text beyond their declared limit.

Message-template SVGs should expand with the responsive bubble box. Keep the text safe area and the SVG shell coupled, using `preserveAspectRatio="none"` for transcript bubble templates so long desktop messages widen the drawn frame before adding height.

`scribble` uses a fully ink-filled, scratched speech shape with light paper-colored text above it. Keep it for short, frantic messages rather than opening a blank text cavity inside the chaos.

In the transcript, portraits sit beneath and beside their bubble tails so speech visually originates from the character. Incoming tails point toward the left portrait; a user's outgoing bubble shell is mirrored toward a right-side portrait. Do not show persistent tone badges or speaker-name labels beside every bubble. Clicking a portrait may reveal the character identity on demand.

Portrait reveals should distinguish account identity from avatar identity. Multiple accounts may choose the same world avatar, so the reveal should show the account display name or handle plus the selected avatar/signature; a current user's own message should make the account side explicit with a concise "You" label.

Timestamps should behave like centered transcript dividers rather than per-message metadata. Show the first visible time and then only repeat it when the next message is separated by a meaningful gap; nearby messages should read as one conversational run.

On desktop, the chat window should use most of the available viewport instead of sitting as a small centered panel with large paper margins. Keep mobile and tablet compact, but let the desktop shell grow broadly and vertically while avoiding page overflow.

## Production Message Template Assets

Use the lightweight SVGs in `docs/ReferenceImages/chat-template-svgs-production/` as implementation reference assets, not the heavier cropped reference SVGs.

- The production SVGs should be decorative shells or accent layers; render message copy as real HTML/CSS text on top.
- Keep message text selectable, accessible, and responsive.
- Preserve SVG aspect ratio for fixed-size/compact non-message uses.
- For transcript bubbles, the current prototype intentionally allows controlled horizontal SVG stretching so the shell and text box expand together. Keep per-template max widths conservative so tails, jagged borders, and ornaments do not become absurdly distorted.
- For future higher-fidelity variable-width bubbles, rebuild the shape as a component, split the artwork into stretch-safe sections, or use a 9-slice/border-image style approach.
- Keep paper grain, halftone, hatching, and speed-line textures as separate optional overlays instead of baking them into every bubble.

## Text and Microcopy

The app can use expressive action words instead of only literal UI labels.

Examples:

- `Send` may become `Shout`, `Mutter`, `Whisper`, `Exclaim`, `Shoot`, `Announce`, or `Scribble`
- `Message` may become `Line`, `Panel`, `Bubble`, or another world-appropriate term
- Generic chat-space labels should become `World`, `Scene`, `Panel`, `Arc`, or another themed term

Use expressive language when it supports the world or character tone.

Do not make labels so unusual that users cannot understand the interface.

## Message Tone Typography

Match the drawn message-tone reference with font settings instead of treating the reference text as image assets.

- Use the app font roles consistently: `M PLUS Rounded 1c` for readable UI, `Kalam` for dialogue/chat lettering, `Dela Gothic One` for heavy impact, `Reggae One` for energetic action labels, and `Mochiy Pop One`/`RocknRoll One` for playful scene and avatar headings.
- Base handwritten text: use a casual handwritten face with rounded strokes, medium size, normal weight, and slightly loose line-height. Good implementation targets: `Kalam`, `Patrick Hand`, or a similar readable handwritten UI font.
- Plain: normal weight, black ink, no transform, comfortable letter spacing.
- Whisper: a dedicated low-weight translucent light-blue outline shell, with the same handwritten family in very light blue-gray ink at low opacity.
- Mutter: compact handwritten text, green ink, slightly condensed feel, and small rotation when practical.
- Thought: softer gray-black ink, regular spacing, slightly looser rhythm than plain.
- Shout: bold condensed brush/comic display face, uppercase, slight italic slant, red speed-line accents.
- Exclaim: handwritten text at normal-to-medium weight with bright accent color and sparkle marks; do not over-bold.
- Announce: clear bold handwritten/display text, stable spacing, official-feeling yellow framing.
- Scribble: light paper-colored text over a fully ink-filled scratch shell, reserved for short frantic lines.
- Sad: light blue-gray handwritten text, lower contrast, relaxed spacing, and no aggressive transform.
- Rage: bold jagged brush face, uppercase, italic/slanted, tight spacing, with red/black splatter accents.
- Grandiose: a theatrical display face, uppercase, purple ink, and ornate/radiant accents.
- System/reply/failed/typing: keep closer to readable handwritten UI text; use tone color and small accents rather than extreme font changes.

## Randomness

The UI should encapsulate controlled randomness.

Good controlled randomness:

- Bubble variation
- Slight border irregularity
- Playful spacing
- World-specific accents
- Different expressive states

Avoid randomness that harms usability:

- Moving primary controls
- Inconsistent navigation
- Unreadable layouts
- Excessive decoration
- Confusing button labels

## Backend Direction

Build the backend behind narrow typed API contracts before moving more UI behavior around. The first backend layer lives in Next.js route handlers and exposes room/avatar catalog data plus message reads/writes. Keep persistence swappable: the current `.data/kokoroe-dev-store.json` store is a local development bridge, not the long-term data model.

Authentication endpoints create development sessions, but login and account creation should still be credential-backed. The server hashes passwords with a salt, rejects duplicate accounts, verifies login credentials, and then returns the same session/profile contract used by the rest of the app. Do not store plaintext passwords in the dev store.

Authenticated browser continuity should use an httpOnly session cookie. The React app may keep session state in memory for convenience, but refresh restore and logout should go through backend auth routes rather than localStorage.

The browser app should consume the backend API even while the backend is still local-development grade. Avoid reintroducing separate frontend-only message stores once an API contract exists.

World-scoped avatar memory belongs in the user profile contract. The frontend may optimistically update selections, but the selected room and per-room avatar ids should be persisted through the backend so refreshing the app does not collapse every world back to the first avatar.

Message creation is server-owned logic. A message must come from a valid session, use an avatar that belongs to the target world, update the user's current room/avatar profile memory, and store the avatar identity as the displayed author. The client may request a tone, but the server resolves the final presentation id.

Database handling is staged in `docs/DATABASE.md`: keep the JSON dev adapter while logic is forming, then move to SQLite before hosted Postgres-scale infrastructure.

Persistence code should live behind adapters in `app/stores/`. Route handlers and UI code should depend on the domain API in `app/kokoroe-store.ts`, not on JSON files, SQLite, or hosted database clients directly.

## Concept Art

Curated concept art should guide implementation.

The implementation agent should follow `docs/CONCEPT_ART_NOTES.md` once concept art has been created and selected.

If implementation conflicts with the curated concept art, update the notes with the reason.

## Authentication Direction

The authentication flow should follow the selected manga spread concept language while keeping steps separated: first a Kokoroe login screen with illustrated character art and expressive but clear form controls, then dream-world selection with large manga-panel world cards, then avatar selection for that selected world. Avoid replacing this with a generic centered login card.

The login screen should use a two-panel manga spread: the form on the left and a large scene-art panel on the right. The right art panel may cycle through normalized login scene images periodically while the form remains stable.

The preferred login direction is now a single vertical manga panel: rotating art sits at the top, then fades into the paper login area below. The form should feel embedded into the same panel, not separated as a card beside the art.

Avatar choice is world-scoped. A character/avatar should be selected after choosing a world because the available persona belongs to that world's fiction, setting, or franchise-like continuity. User-facing copy should prefer language like "get isekaied to your dream world" over generic chat-space phrasing.

World and avatar selection should share one compact setup page on desktop. Avoid separate full-screen panels when the decision is part of one flow; use available space dynamically with worlds, selected-world context, avatar choices, and entry actions visible together.

Setup pages should not leave large blank paper areas when a selected world has scene art. Use the current world's illustration as a low-opacity, masked backdrop behind the setup panel so empty space feels like atmosphere while foreground cards stay readable.

Small setup labels and authentication greetings should use inked manga-caption language, such as clipped strips or notched stamps. Avoid plain geometric ellipse badges when a label is decorative rather than interactive.

Major page transitions should use coherent generated manga animation assets when possible, not placeholder CSS shapes or smooth generic pans. The current production transition is a six-scene first-person isekai sequence, stored as individual high-resolution wide frames in `public/transitions/wide-isekai/` and animated as stepped manga scene cuts with slight panel punch.

Input focus effects should avoid generic blue browser rings, cheap dot fields, and slash-like marks. If a particle effect is used, it should be a small intentional motif animated with restrained transform/opacity movement and removed if it competes with typing. Sakura petals are a Crimson Plotroom chat-window atmosphere layer, not a default chatbox or composer-focus effect.

Message bubbles should stay visually still until a non-generic, manga-specific motion language is designed and approved. Do not add placeholder pop, bounce, wiggle, ghost-fade, or generic spawn animations to settled transcript bubbles just because the catalog has a `motion` value. If a bubble needs motion, prefer shell-specific environmental details that belong to the artwork, such as rain lines animated around the sad bubble, while keeping the bubble frame and text safe area stable.

The approved bubble-motion language extends that environmental-detail rule across expressive presentations: whisper motes, mutter ink ticks, exclaim speed flashes, announce broadcast rings, grandiose gold glitter, and sad rain may animate around stable shells. Shout is a shell-motion exception and enters with a strong exponential scale-up, brief overshoot, and snap-settle. Scribble is a construction exception: a visible nib draws its outline and broad clipped ink passes, resolves into the completed catalog SVG, and reveals the copy only after the drawing is finished. Non-rain perimeter effects use shell-specific SVG overlays that share the exact template viewBox, mirror with outgoing art, and stay beneath copy. Incoming bubbles share one left anchor and outgoing bubbles share one right anchor; tone must not horizontally indent an otherwise aligned conversation run.

The transcript stays visually still by default. `sad` rain is the accepted environmental exception and may remain active on the newest three sad messages; a recent Scribble may perform its one-shot construction on arrival or reload. Other shell-specific rigs stay mounted but hidden and paused until hover or keyboard focus. Historical Scribble messages replay on hover/focus, and reduced motion always shows the completed SVG and text immediately.

Each world owns its own cast of avatars. Switching worlds from chat should immediately restore the last avatar selected for that world; changing that remembered identity happens through the setup screen, not by carrying an avatar between worlds.

World-owned avatars should stay visibly identifiable after selection: use portrait art, individual accent color, and a concise signature motif in setup and chat presence surfaces while keeping names and message text readable.

Avatars should appear as illustrated, themed identities rather than initial-only tokens. Use their portrait and personal accent in setup selection and chat presence so changing character is visible in the experience.

Chatroom members are accounts, not avatars. Adding someone in the chat window adds an existing account to that room; it must not create a sendable avatar or let the current user send as that account. Avatar selection and future avatar creation belong in the world/setup window.

The Room Cast add-member flow should recommend existing accounts by username, email, or display name as the user types. Recommendations may show public account identity plus that account's selected avatar for the current world, but adding still creates an account membership rather than an avatar.

Room access is membership-based. A logged-in account may only read, enter, switch to, or send in rooms where it has a room membership. The post-login world screen should list joined rooms only. Public rooms may be discovered through room search and joined from there; private rooms must not appear in public search. Joining a room creates membership for the logged-in account; adding a member creates membership for another account.

Multi-character profile sheets and preview/contact-sheet images are reference material only. Never expose them as selectable avatars or runtime identity portraits.

Room theme illustrations are runtime scene assets: surface them in world selection and chat headers so the selected world reads immediately through place and atmosphere. When an illustration contradicts a placeholder world name, adjust the public-facing name while keeping stable internal ids for state continuity.

Keep high-resolution room art as reference/source material, and serve compressed derivatives from `public/rooms/<room-id>/scene.jpg` for featured surfaces and `preview.jpg` for card/sidebar thumbnails.

## Usability

Personality should not come at the cost of usability.

The app must remain:

- Readable
- Navigable
- Responsive
- Clear
- Fast enough for normal use
- Visually consistent

Desktop panels should feel vertically balanced in the viewport. Major windows, widgets, and page sections should not appear pinned too high or stretched downward unless the content truly needs scrolling.

Motion should make screen changes feel like moving through manga panels, not generic app fades. Use `motion/react` for screen transitions, selectable-card feedback, message entry movement, and layout changes. CSS animations may carry ambient paper grain, subtle scene breathing, speed-line movement, selected-state energy, and typing indicators. Always respect reduced-motion preferences.

The chat shell should read as a living manga page: keep strong outer and panel boundaries, use ink gutters between navigation and conversation, let room art and restrained world-specific atmosphere animate behind stable content, and create transcript rhythm through spacing and controlled indentation rather than moving settled bubbles. The composer should foreground the selected avatar and use an explicit room-owned action verb (`Send`, `Whisper`, `Serve`, or `Reveal`) while keeping the action location predictable.

Major page transitions may include a brief manga portal/jump burst, such as a character silhouette diving into the selected world. Keep it short and decorative so it adds life without delaying navigation.

## Design Review Rule

For UI work, the agent must inspect the result in the browser when possible.

Terminal success is not enough for visual tasks.
