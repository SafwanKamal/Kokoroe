# Chibi Cursor Companion Plan

## Product Goal

Make desktop pointer movement feel character-driven by letting a small chibi companion react to the kind of interface under the pointer. The companion is a playful enhancement, never the only indication that an element is clickable, editable, busy, or disabled.

The first release should prove one polished companion pack and a small, predictable pose vocabulary before expanding to every avatar.

## Experience Model

Use a fixed, pointer-transparent DOM overlay rather than a browser cursor image. This allows pose swaps, responsive scaling, a visible hotspot, and graceful fallback without forcing every asset into native cursor size limits.

The companion follows the pointer on fine-pointer desktop devices. Most app surfaces may hide the native arrow after the companion assets are ready. Precision surfaces keep the native system cursor visible and place the companion slightly beside it:

- text fields and textareas use one themed I-beam while the overlay is healthy; selectable non-entry text keeps the native I-beam;
- a small pointing hand and sleeve extend from a bounded orbit around the chibi toward the nearest visible enabled action, including buttons, links, checkboxes, radios, and text-entry controls;
- resize, drag, and other operating-system precision cursors remain native;
- outside the Kokoroe app shell, the normal cursor is untouched.

Touch and coarse-pointer devices do not mount the companion. Keyboard and screen-reader behavior remains unchanged.

## MVP Pose Vocabulary

| Intent | Chibi pose | Example targets | Notes |
|---|---|---|---|
| `default` | Neutral step or attentive idle | Paper, gutters, non-interactive scene art | No ambient looping beyond an optional tiny settle on entry. |
| `action` | Reaching or pointing | Buttons, links, checkboxes, radios, room cards, avatars, navigation | The hotspot remains exact even if the body is offset; choice inputs must not fall through to native precision handling. |
| `write` | Holding a brush or pen | Inputs and the composer textarea | Replace the generic marker plus native I-beam with one themed I-beam; restore the native I-beam on loading, failure, or teardown. |
| `inspect` | Leaning in or peeking | Message bubbles, portraits, room art with details | Use only where inspection or reveal is actually available. |
| `blocked` | Arms crossed or puzzled | Disabled controls and unavailable actions | Never replace the control's disabled styling or explanation. |
| `press` | Short impact/tap pose | Pointer down on an enabled action | Transient interaction state; return to the current target intent on release. |

State priority is `blocked` first, then precision intent, explicit target intent, semantic fallback, and finally `default`. The `press` pose temporarily overrides enabled states only.

## Asset Contract

Start with one canonical Kokoroe companion available throughout login, setup, and chat. Later packs may follow the user's selected room avatar, with the canonical companion as a fallback when an avatar pack is unavailable.

Runtime assets should live at:

```text
public/cursor-companions/<companion-id>/<pose>.webp
```

Source and review art should remain under `docs/ReferenceImages/`, not in runtime folders.

Add a catalog at `content/cursor-companions/catalog.json` rather than hard-coding paths or offsets in React. Each companion entry should declare:

- stable companion id and optional avatar id;
- the allowed pose ids and asset paths;
- intrinsic frame width and height;
- hotspot coordinates for each pose;
- visual offset from the hotspot;
- preferred desktop size and maximum size;
- fallback pose;
- review status and source reference.

Every pose in a pack must use the same transparent canvas, scale, outline weight, lighting, and character proportions. Hands or props may cross the hotspot, but the hotspot itself must stay registered between poses so switching never makes the pointer jump.

For the pilot, use lossless source PNGs and optimized transparent WebP runtime derivatives at 1x and 2x density. Avoid GIFs, video, sprite-sheet timing, and baked UI text.

## Interaction Architecture

Keep the implementation small and isolated:

```text
content/cursor-companions/catalog.json
app/cursor-companions.ts
app/chibi-cursor.tsx
tests/cursor-companions.test.ts
public/cursor-companions/...
```

`app/chibi-cursor.tsx` should:

1. Mount only when `(hover: hover) and (pointer: fine)` matches.
2. Preload the active pack before hiding the native arrow.
3. Track pointer coordinates in one `requestAnimationFrame` loop using CSS custom properties or a direct transform; pointer movement must not cause React renders.
4. Resolve intent with `pointerover` and `Element.closest()`.
5. Prefer explicit `data-cursor-intent` annotations for Kokoroe-specific surfaces.
6. Apply conservative semantic fallbacks for native `button`, `a`, `input`, `textarea`, and disabled states.
7. Restore the native cursor immediately on asset failure, window blur, pointer exit, or component teardown.

Explicit annotations keep the feature reviewable:

```tsx
<button data-cursor-intent="action">...</button>
<article data-cursor-intent="inspect">...</article>
```

Do not infer personality from CSS class names. Do not attach an event listener to every target.

## Motion and Visual Rules

- Pose changes should crossfade or snap within roughly 80–120 ms; the pointer position itself must never lag behind the hand.
- Move and rotate only the pointing-hand guide around a fixed-radius chibi orbit toward the nearest enabled action target. Anchor the fingertip on the orbit and let the wrist/sleeve extend inward so it reads as part of the character; clamp the guide inside the viewport and update it in the existing animation frame.
- The follower may use a tiny entry settle, but no constant bobbing, autonomous orbiting, particle trail, elastic chase, or generic idle loop. The target-driven hand orbit is directional feedback, not ambient motion.
- `prefers-reduced-motion: reduce` keeps pose changes but removes interpolation, squash, and entry motion.
- Keep the rendered chibi approximately 48–64 CSS pixels and offset its body away from the hotspot so it does not cover labels or small controls.
- Use a small ink dot, brush tip, or star point as the exact hotspot. Visual size must not enlarge the clickable area.
- Clamp the artwork inside the viewport while leaving the hotspot at the true pointer coordinate.
- The overlay uses `pointer-events: none`, is excluded from the accessibility tree, and must not create scroll width.

## Preference and Personalization

Ship an explicit `Chibi cursor` preference with a literal accessible label. It may default on only for supported fine-pointer devices after the pilot is visually accepted; the user can always switch back to the classic cursor. Store the preference locally first, then move it into the profile contract only if cross-device sync is wanted.

The companion id and the enabled/disabled preference are separate. Phase two can select a companion pack from the active world's chosen avatar without changing pointer behavior.

Any themed visible copy for the preference must follow `docs/WORLD_LANGUAGE_PIPELINE.md`.

## Delivery Sequence

### Phase 0 — Interaction prototype

- Draw temporary geometric stand-ins for all six poses.
- Prove hotspot registration, intent resolution, precision-cursor fallback, viewport clamping, teardown, and zero layout/scroll impact.
- Annotate only a representative slice: one navigation action, a room card, a message/portrait, the composer textarea, send, and one disabled action.
- Do not generate or polish character art yet.

Exit criterion: the prototype feels precise at desktop and narrow laptop widths, never traps or loses the native cursor, and adds no pointer-move React renders.

### Phase 1 — One production companion pack

- Create and visually review one canonical chibi pack using the asset contract.
- Add the catalog, loader, preference, reduced-motion behavior, and semantic fallback.
- Extend explicit intent annotations across login, setup, room navigation, members, transcript, and composer controls.
- Keep unsupported and unannotated surfaces on `default` or the native precision cursor.

Exit criterion: one consistent companion works across the complete logged-out and authenticated flow with graceful fallback.

### Phase 2 — Avatar-linked personalization

- Add approved packs for selected avatars one at a time.
- Resolve the active pack from world-scoped avatar memory.
- Preload the next room's pack during room switching; retain the current or canonical pack until the new pack is ready.
- Never expose a partial pack: missing or rejected poses use the canonical pack, not mixed character artwork.

Exit criterion: room/avatar switching changes the companion without flashing, pointer jumps, or broken asset requests.

## Verification Matrix

Terminal verification:

- catalog paths, pose ids, dimensions, and hotspot bounds validate;
- tests cover intent priority, disabled/precision fallback, preference persistence, media-query gating, and asset failure;
- typecheck, production build, and diff checks pass;
- a pointer-move test or profiler inspection confirms no React render per movement.

Rendered verification:

- inspect at 1440×900, a narrower desktop/laptop viewport, and 390×844;
- confirm the feature is absent on emulated touch/coarse-pointer mobile;
- exercise login, setup, room cards, members, message/portrait inspection, composer writing, send, disabled, and loading states;
- test pointer exit/re-entry, window blur, rapid target crossing, scroll, zoom, and room switching;
- verify the chibi never hides the label or focus ring of a small control and never creates horizontal overflow;
- verify keyboard-only navigation and screen-reader semantics are identical with the feature on and off;
- verify normal, reduced-motion, classic-cursor preference, failed-asset, and slow-asset-loading paths.

## Non-Goals

- No cursor trails, particles, physics chase, autonomous roaming, speech bubbles, sounds, or random pose rotation.
- No custom cursor on touch devices.
- No AI selection of poses.
- No replacement for focus, hover, disabled, error, or busy UI states.
- No bulk generation of every avatar pack before the pilot interaction is accepted.

## Open Product Choices

Resolve these during the Phase 0 review, not before prototyping:

1. Whether the canonical companion is a new Kokoroe mascot or a chibi version of one existing avatar.
2. Whether supported desktop users see it by default or opt in on first use.
3. Whether `inspect` applies to all messages or only portraits and elements with a real reveal action.
