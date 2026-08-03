# Cursor Companion Concepts

These are review-only SP-009 concept sheets, not runtime cursor assets.

The `generated-2026-08-02/` directory contains a second from-scratch batch built around character-owned cursor gestures:

- `page-sleeve-spirit-six-pose.png` — humanoid paper spirit with a connected pointing finger and open-palm `write` ta-da;
- `ink-tail-courier-six-pose.png` — ink cat whose connected nib tail supplies the pointer silhouette;
- `margin-painter-six-pose.png` — tanuki familiar whose connected brush tail supplies the pointer silhouette.

Each transparent sheet retains its corresponding flat-chroma `*-source.png` generation. The fixed cell order remains `default`, `action`, `write`, `inspect`, `blocked`, `press`. These sets were reviewed whole; poses are not mixed across characters.

`page-sleeve-pointer-guide.png` records a rejected isolated sleeve-and-hand experiment. Rendered review showed that even a style-matched detached limb reads anatomically wrong beside the complete character, so it is retained only as generation history and has no runtime derivative.

`page-sleeve-layered-action.png` is the accepted component edit. Its left cell is the upright Page-Sleeve body with the pointing-side arm removed and its right cell is the matching shoulder-to-fingertip limb. The runtime derivatives `action-body.webp` and `action-arm.webp` share one 128×128 registration canvas and scale; the arm renders below the body with its sleeve base buried under the jacket shoulder.

Each 1536×1024 RGBA sheet uses a 3×2 grid of 512×512 cells in this fixed order:

| Cell | Intent |
|---|---|
| Top left | `default` |
| Top middle | `action` |
| Top right | `write` |
| Bottom left | `inspect` |
| Bottom middle | `blocked` |
| Bottom right | `press` |

## Concepts

- `ink-page-sprite-six-pose-concept.png` — paper-page humanoid with a school jacket and blue page tab.
- `bell-eared-ink-cat-six-pose-concept.png` — compact ink cat with bell ears and a strong action silhouette.
- `folded-panel-rabbit-six-pose-concept.png` — angular origami rabbit with the cleanest small-size silhouette.
- `nib-cap-crow-six-pose-concept.png` — ink crow with a fountain-pen-nib crest and the strongest high-contrast identity.

The sheets were generated with temporary flat chroma backgrounds and converted to alpha for review.

## Canonical pack and Phase 0 comparisons

The Page-Sleeve Spirit is the first canonical complete pack. Its six normalized 128×128 lossless WebPs live under `public/cursor-companions/page-sleeve-spirit/`. Nearby-action and active-action guidance use the registered two-layer action assembly: the upright body may mirror left/right, the separate arm rotates around a fixed shoulder beneath it, and the computed fingertip hotspot follows that arc. The body never rotates; it naturally occludes the arm when the limb passes behind the head. The write pose keeps its shared open-palm hotspot and replaces the separate I-beam while active.

Ink Page Sprite and Folded Panel Rabbit were selected as contrasting test candidates. Their cells are cropped to identical 128×128 lossless WebP canvases, centered to a shared horizontal axis, and aligned to one baseline under `public/cursor-companions/prototypes/`.

Compare the retained Phase 0 alternatives without adding product UI:

- `/?cursorConcept=page-sleeve-spirit` (canonical and no-query default)
- `/?cursorConcept=ink-page-sprite`
- `/?cursorConcept=folded-panel-rabbit`
- `/?cursorConcept=geometry`

The comparison paths remain visual-testing controls. The earlier Ink Page Sprite keeps its 2px frame offset. Before production release, complete coarse-pointer verification and interaction acceptance. Do not mix poses between concepts.
