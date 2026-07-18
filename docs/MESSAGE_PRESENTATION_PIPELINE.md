# Message Presentation Pipeline

Kokoroe treats a chat bubble as a named presentation, not an arbitrary mixture of shell art and text styling.

## Source Of Truth

- Catalog: `content/message-presentations/catalog.json`
- Runtime renderer and sizing logic: `app/message-presentations.ts`
- Decorative SVG shells: `public/message-templates/message-template-<shell>.svg`
- CSS rendering roles: `app/globals.css`

Each catalog entry owns:

- `shell`: the decorative bubble frame asset.
- `fontRole`: a controlled typography family role such as dialogue, action, impact, or lively.
- `ink`: a controlled text color treatment matched to the shell.
- `motion`: a controlled animation/rotation treatment.
- `maxCharacters`: a per-presentation suitability ceiling within the global 120-character composer limit.
- `emotionTags`, `intensity`, and `classifierHint`: semantic cues for future selection.
- `metrics`: validated inner text width, responsive max text width, frame padding, and type scale for that particular shell.
- `metrics.mirrorPadding`: optional direction behavior for shells whose text safe-area must swap left/right when the outgoing shell art is mirrored.

Keep these properties together. A shell should not be restyled ad hoc in the page component.

## Current Rendering Rule

Messages store a `tone` value that is a presentation id. Bubble copy starts from a compact preferred inner text stage, then uses a balanced wrapping pass to choose a shell-appropriate width up to the catalog-defined responsive max width. The sizing code estimates word widths, tests candidate text-stage widths, and scores them for line balance, unused whitespace, and shell aspect ratio before rendering. This avoids both extremes: text escaping a narrow shell and short messages becoming over-wide banners. The decorative SVG shell fills the same responsive bubble box and uses `preserveAspectRatio="none"` so the drawn frame expands with the selected text safe area. Because decorative artwork intrudes into different shells differently, each catalog entry may tighten that width and specify asymmetric frame padding plus a conservative font size. The bubble container then grows from real wrapped HTML text, so additional lines expand the surrounding shell instead of escaping into its outline. Outgoing bubbles reuse the same catalog shell mirrored toward the sender's right-side portrait, while each presentation decides whether its asymmetric safe-area padding should also mirror.

The composer currently limits new messages to 120 characters. Compact high-energy frames may declare a smaller `maxCharacters`; when selected for longer permitted copy they resolve to `plain`. This keeps the expressive single-panel bubble language readable while ordinary dialogue can use more room.

For presentation debugging, a message whose complete trimmed text is exactly a presentation id forces that presentation. Matching is case-insensitive, so `sad`, `GRANDIOSE`, or ` whisper ` are valid shortcuts; phrases and punctuation such as `I feel sad` or `sad!` continue through normal presentation selection.

When adjusting an entry:

1. Inspect the production SVG shell visually.
2. Choose a font and ink role that remain legible in its actual opening.
3. Adjust safe bounds with representative maximum-length text and inspect the rendered frame.
4. Verify desktop and narrow/mobile chat views in the browser.

For example, `scribble` is a dense ink-filled scratch bubble with light text above the hatching. It remains reserved for short frantic lines so the lettering keeps enough breathing room against the visual noise.

`whisper` owns its separate translucent light-blue shell derived from the plain conversation shape. Do not add visible style labels such as `WHISPER` or `SHOUT` to transcript bubbles; the drawing and typography communicate presentation. Portraits sit beneath the tail and reveal identity only when selected.

Presentation motion should usually animate decorative details around a stable shell and text stage, following the approved `sad` rain pattern. Examples include drifting motes for `whisper`, ink ticks for `mutter`, radial speed flashes for `exclaim`, broadcast rings for `announce`, and gold glitter for `grandiose`. `shout` is a shell-motion exception and uses one strong exponential pop-in. `scribble` is a construction exception: a visible ink nib traces the perimeter and lays down clipped zig-zag fill passes, the animated builder hands off to the completed production SVG, and only then does the text enter. Each non-rain perimeter effect uses an inline SVG overlay with the same native `viewBox` and `preserveAspectRatio="none"` behavior as its shell. Position effects in that SVG coordinate system, mirror the entire effect group with outgoing art, and keep all animated marks outside the text safe area. Do not use an oversized generic rig, fixed `rem` trajectories, or unmirrored percentage anchors. All effect rigs must be decorative, ignore pointer input, and disappear when reduced motion is requested.

Only accepted environmental or construction effects auto-run: `sad` rain may remain active on the newest three messages, and a recent `scribble` may perform its one-shot build on arrival or reload. Other shell-specific rigs stay mounted but visually hidden and CSS-paused until the message row is hovered or keyboard-focused. This keeps the transcript still by default while preserving deliberate inspection and replay. Historical `scribble` messages replay their construction on hover or focus before returning to the completed static SVG.

The quiet/chaotic presentations have distinct approved rhythms: `whisper` uses visible blue rising breath motes plus softly traveling dashed contour segments; `mutter` uses green suppressed ink-tick twitches and three sequential green-and-gold dots followed by stillness; `scribble` uses a roughly 2.75-second pen-built reveal with paper, outline, broad clipped ink passes, finishing scratches, final-SVG handoff, and delayed copy. Light marks over dark shells and pale marks over translucent shells must use normal compositing rather than multiply blending.

Timestamps are transcript dividers, not bubble labels. Render them centered in the chat window and suppress repeats for messages that are only a few minutes apart.

## Future Classifier Contract

A future small model may choose presentation, but should not invent presentation styling. It may emit a constrained result such as:

```json
{
  "presentationId": "whisper",
  "confidence": 0.84,
  "reason": "Private reassurance"
}
```

Only ids present in the catalog are valid. Invalid or low-confidence choices fall back to `plain`. Text rewriting, if later introduced, remains a separate concern from visual presentation selection.

## Oval Text Research

CSS Shapes supports wrapping surrounding text around a floated `circle()` or `ellipse()` through `shape-outside`, but it does not provide broadly supported `shape-inside` behavior for flowing message copy within an oval. Kokoroe therefore uses a stable rectangular inner text stage inside illustrated oval shells instead of relying on an unsupported browser layout primitive.
