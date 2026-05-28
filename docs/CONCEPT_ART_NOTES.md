# Concept Art Notes

This file should store curated concept art directions for the manga chat app.

Do not treat every generated concept as final. Only add ideas here after they have been reviewed and selected.

## How to Use This File

When concept art is generated:

1. Review the concepts.
2. Select the strongest ideas.
3. Summarize the selected direction here.
4. Note what should be copied, adapted, or avoided.
5. The implementation agent should read this file before building major UI surfaces.

## Selected Direction

## Selected Direction: Manga Scene Portal Auth

Use the authentication concept that feels like a manga magazine spread: a left sign-in window with Kokoroe branding, illustrated character art, expressive form controls, and a dream-world entry action; paired with a right-side dream-world selector made of large illustrated manga panels. This auth surface should feel like entering a story world, not a generic login modal.

## Visual Elements to Keep

- Cream manga paper background with visible but subtle print texture.
- Heavy imperfect ink panel borders around major surfaces.
- Brush-style Kokoroe wordmark and expressive scene headings.
- Blue primary action with hand-inked frame and motion marks.
- Login controls should stay stable while avatar picking happens after dream-world selection.
- Right world-selection panels with distinct color accents and illustrated world moods.
- World verbs and effects such as `Enter`, `Whisper`, `Shout`, and `Slurp` when they match the scene tone.

## Visual Elements to Avoid

Add rejected or problematic ideas here.

Examples:

- Too much visual clutter
- Hard-to-read fonts
- Overly realistic comic textures
- Excessive animation
- Generic rectangular SaaS layout
- Designs that look more superhero-comic than manga, unless intentionally chosen

## Implementation Notes

- Recreate the auth layout as a split manga spread on tablet/desktop and collapse it into sign-in followed by scene selection on mobile.
- Use CSS borders, paper texture overlays, and reusable panel components before relying on many image assets.
- Keep form fields conventional enough to be immediately understandable.
- Treat world panels as data-driven cards with per-world accent color, verb, icon, short description, and illustration slot.

## Curated Room Scenes

- `after-school-arc.png` belongs to `Skybell Academy`: sunlit hallway, lockers, after-class social energy.
- `quiet-corner.png` belongs to `Mizukage Library`: rainy reading corner, blue hush, private conversation.
- `late-night-ramen.png` belongs to `Yoru Ramen Yokocho`: lantern counter, shared bowls, warm midnight chatter.
- `plot-twist.png` belongs to `Crimson Plotroom`: red-thread evidence wall and reveal-driven drama; do not label this setting as a rooftop.
