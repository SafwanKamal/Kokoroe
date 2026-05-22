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

## Production Message Template Assets

Use the lightweight SVGs in `docs/RerferenceImages/chat-template-svgs-production/` as implementation reference assets, not the heavier cropped reference SVGs.

- The production SVGs should be decorative shells or accent layers; render message copy as real HTML/CSS text on top.
- Keep message text selectable, accessible, and responsive.
- Preserve SVG aspect ratio for fixed-size/compact uses.
- Do not freely stretch the whole SVG for variable-width messages, because tails, jagged borders, and ornaments will distort.
- For variable-width bubbles, rebuild the shape as a component, split the artwork into stretch-safe sections, or use a 9-slice/border-image style approach.
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

- Base handwritten text: use a casual handwritten face with rounded strokes, medium size, normal weight, and slightly loose line-height. Good implementation targets: `Kalam`, `Patrick Hand`, or a similar readable handwritten UI font.
- Plain: normal weight, black ink, no transform, comfortable letter spacing.
- Whisper: same handwritten family, very light blue-gray ink at low opacity, wider letter spacing, lighter weight, and softer contrast.
- Mutter: compact handwritten text, green ink, tighter letter spacing, slightly condensed feel, uneven baseline or small rotation per word when practical.
- Thought: softer gray-black ink, regular spacing, slightly looser rhythm than plain.
- Shout: bold condensed brush/comic display face, uppercase, slight italic slant, red speed-line accents.
- Exclaim: handwritten text at normal-to-medium weight with bright accent color and sparkle marks; do not over-bold.
- Announce: clear bold handwritten/display text, stable spacing, official-feeling yellow framing.
- Scribble: white or light text over chaotic black scribble fill; text should stay readable while the surrounding mark carries the chaos.
- Sad: light blue-gray handwritten text, lower contrast, relaxed spacing, and no aggressive transform.
- Rage: bold jagged brush face, uppercase, italic/slanted, tight spacing, with red/black splatter accents.
- Grandiose: tall decorative serif or theatrical display face, uppercase, purple ink, wider spacing, ornate/radiant accents.
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

## Concept Art

Curated concept art should guide implementation.

The implementation agent should follow `docs/CONCEPT_ART_NOTES.md` once concept art has been created and selected.

If implementation conflicts with the curated concept art, update the notes with the reason.

## Authentication Direction

The authentication flow should follow the selected manga spread concept language while keeping steps separated: first a Kokoroe login screen with illustrated character art and expressive but clear form controls, then dream-world selection with large manga-panel world cards, then avatar selection for that selected world. Avoid replacing this with a generic centered login card.

The login screen should use a two-panel manga spread: the form on the left and a large scene-art panel on the right. The right art panel may cycle through normalized login scene images periodically while the form remains stable.

The preferred login direction is now a single vertical manga panel: rotating art sits at the top, then fades into the paper login area below. The form should feel embedded into the same panel, not separated as a card beside the art.

Avatar choice is world-scoped. A character/avatar should be selected after choosing a world because the available persona belongs to that world's fiction, setting, or franchise-like continuity. User-facing copy should prefer language like "get isekaied to your dream world" over generic chat-space phrasing.

## Usability

Personality should not come at the cost of usability.

The app must remain:

- Readable
- Navigable
- Responsive
- Clear
- Fast enough for normal use
- Visually consistent

## Design Review Rule

For UI work, the agent must inspect the result in the browser when possible.

Terminal success is not enough for visual tasks.
