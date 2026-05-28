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

Keep these properties together. A shell should not be restyled ad hoc in the page component.

## Current Rendering Rule

Messages store a `tone` value that is a presentation id. Bubble copy starts from a compact preferred inner text stage, then can expand horizontally up to a catalog-defined responsive max width before it grows vertically. This matters most on desktop, where long messages should use available horizontal chat space instead of becoming tall narrow panels. The decorative SVG shell fills the same responsive bubble box and uses `preserveAspectRatio="none"` so the drawn frame expands horizontally with the text safe area. Because decorative artwork intrudes into different shells differently, each catalog entry may tighten that width and specify asymmetric frame padding plus a conservative font size. The bubble container then grows from real wrapped HTML text, so additional lines expand the surrounding shell instead of escaping into its outline. Outgoing bubbles reuse the same catalog shell mirrored toward the sender's right-side portrait.

The composer currently limits new messages to 120 characters. Compact high-energy frames may declare a smaller `maxCharacters`; when selected for longer permitted copy they resolve to `plain`. This keeps the expressive single-panel bubble language readable while ordinary dialogue can use more room.

When adjusting an entry:

1. Inspect the production SVG shell visually.
2. Choose a font and ink role that remain legible in its actual opening.
3. Adjust safe bounds with representative maximum-length text and inspect the rendered frame.
4. Verify desktop and narrow/mobile chat views in the browser.

For example, `scribble` is a dense ink-filled scratch bubble with light text above the hatching. It remains reserved for short frantic lines so the lettering keeps enough breathing room against the visual noise.

`whisper` owns its separate translucent light-blue shell derived from the plain conversation shape. Do not add visible style labels such as `WHISPER` or `SHOUT` to transcript bubbles; the drawing and typography communicate presentation. Portraits sit beneath the tail and reveal identity only when selected.

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
