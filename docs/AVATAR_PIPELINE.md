# Avatar Pipeline

## Purpose

Kokoroe avatars are world-owned illustrated identities. New AI-generated portraits should be easy to review, add, replace, and render without editing UI components.

This pipeline handles approved portrait intake only. It does not generate images.

## Source Of Truth

- `content/avatars/catalog.json`: runtime avatar metadata grouped by world id.
- `public/avatars/<room-id>/<avatar-id>/portrait.png`: approved runtime portrait served by the app.
- `scripts/add-avatar.mjs`: validated catalog and asset importer.
- `docs/ReferenceImages/Character Profile/` or `docs/RerferenceImages/Avatars/`: optional reference/concept storage, never imported automatically.

Do not put contact sheets, multi-character previews, rejected generations, or prompt explorations under `public/avatars/`.

## Catalog Shape

Each entry contains readable identity metadata and one small-thumbnail framing adjustment:

```json
{
  "id": "ramen-yuto",
  "name": "Yuto",
  "mark": "YU",
  "description": "Ramen cartographer",
  "signature": "broth-route mapper",
  "accentColor": "#C58A16",
  "imageSrc": "/avatars/ramen-stand/ramen-yuto/portrait.png",
  "thumbnail": { "x": -4, "y": 20, "scale": 1.62 }
}
```

The complete portrait appears in setup/profile surfaces. `thumbnail` is only for tiny circular chat portraits where the face must remain readable.

## Intake Workflow

1. Generate or receive a candidate portrait outside `public/avatars/`.
2. Visually inspect it at full size.
3. Reject it if it is a contact sheet, contains multiple characters, has embedded blank bars, hides or cuts the face, or does not clearly belong to the intended world.
4. Judge the unmodified square portrait in a circle. If the face is already centered and readable, use `x: 0`, `y: 0`, `scale: 1`.
5. If only the small chat stamp needs framing, choose conservative `thumbnail` values. Do not alter the source portrait to fix thumbnail composition.
6. Import it with `npm run avatar:add`.
7. Verify the setup panel and chat view in the browser at desktop and narrow sizes.

## Import Command

```bash
npm run avatar:add -- \
  --input /absolute/path/to/portrait.png \
  --room ramen-stand \
  --id ramen-yuto \
  --name Yuto \
  --mark YU \
  --description "Ramen cartographer" \
  --signature "broth-route mapper" \
  --accent "#C58A16" \
  --thumbnail-x -4 \
  --thumbnail-y 20 \
  --thumbnail-scale 1.62 \
  --portrait-reviewed
```

Use `--replace` to intentionally update an existing avatar. Use `--dry-run` to validate the proposed entry without copying an asset or changing the catalog.

The importer rejects non-square PNGs and obvious preview/contact-sheet filenames. Visual review is still required because a renamed collage cannot be detected reliably by file validation alone.

## Future AI Integration

When on-demand portrait generation is implemented, the generated image should first be treated as a candidate. After review and framing, the same importer should publish it into the catalog and runtime asset folder. Keep generation prompts, rejected candidates, safety metadata, and version history out of the UI catalog unless a future product decision requires them.
