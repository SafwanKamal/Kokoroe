# Production Chat Template SVGs

These SVGs are lightweight crops derived from the full vectorized reference sheet. Each file contains only the non-paper vector paths that intersect its template region, so they are much smaller than the original cropped reference files.

This folder intentionally keeps only the unique message-tone templates. Compact variants were removed because they visually duplicated the main templates and should be handled through responsive component sizing instead.

Use these as decorative bubble shells or accent layers. Render message text with HTML/CSS on top so the chat remains selectable, accessible, and responsive.

Recommended usage:

- Place the SVG as an absolutely positioned background/accent layer inside a message component.
- Keep the message text as real DOM text with the tone-specific font settings from `docs/DESIGN_DECISIONS.md`.
- Preserve aspect ratio for icon-like/compact uses.
- For variable-width chat bubbles, prefer CSS/SVG component implementations or 9-slice-style scaling instead of stretching the whole SVG, especially for tails and jagged/rage shapes.
- Keep paper texture as a separate overlay rather than baked into each bubble.
