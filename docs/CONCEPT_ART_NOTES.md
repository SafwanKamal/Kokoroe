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

## Selected Direction: Expressive Conversational Evolution

The core chat experience represents how real-world digital messaging transforms from standard mobile chat exchanges into an imaginative, co-created manga adventure. This visual direction is captured in [chat_evolution_art.png](file:///Users/safwankamal/Desktop/Code/Kokoroe/docs/RerferenceImages/Concept/chat_evolution_art.png).

### Visual Elements to Keep

- **Dual-Phone Showcase Layout**: Two high-fidelity vertical smartphone mockups displayed side-by-side on a warm cream paper background, keeping the messaging platform interface at the absolute center of focus.
- **Left Smartphone UI (Initial State / Simple Texting)**:
  - Sidebar showing other scenes with individual manga illustrations.
  - A pinned "Today's Panel" widget at the top displaying a sketch of the current environment (e.g., a rainy library window).
  - A clean vertical chat feed displaying blank dialogue bubbles in various expressive speech styles (cloud-like whisper, jagged shout, hand-drawn mutter, dark scratched scribble) with respective color-coded labels (WHISPER, SHOUT, MUTTER, SCRIBBLE) next to character portraits.
  - A detailed bottom text input bar saying "What's on your mind?" next to a hand-drawn red "SEND" button.
- **Right Smartphone UI (Evolved State / Manga Integration)**:
  - Shows the same room and header, but the chat feed background has transformed into a beautiful, sequential manga page.
  - The blank chat bubbles have expanded and integrated directly as speech bubbles inside co-created panel scenes (showing the avatars eating ramen together under glowing lanterns).
  - Keeps the bottom "What's on your mind?" input bar and "SEND" button.
- **Color Palette & Texture**:
  - Fine hand-inked borders and brush outlines over a warm cream paper base.
  - High-fidelity vector phone frames blending with hand-drawn artwork.
  - Curated Kokoroe selective color accents: ramen gold, sky wash blue, and plot coral.

### Visual Elements to Avoid

- **Text-In-Bubbles Asset Baking**: All chat bubbles and panels must support dynamic browser rendering of raw HTML/CSS text rather than hardcoded image assets.
- **Confusing Layouts**: Maintain standard mobile messaging navigation, timestamps, and input bar placements so the app remains instantly familiar and accessible to users.

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
