# Paper Material Research

This note records the visual-material rules behind Kokoroe's site-wide paper and manga-print treatment.

## Findings

- Paper and printed ink are separate layers. The paper substrate needs irregular fibers and value variation; manga screentone is a controlled dot layer used for shade and texture in selected regions, not a universal pattern over every control.
- SVG `feTurbulence` is a broadly supported way to synthesize repeatable organic texture. A small tiled asset avoids a large raster download and keeps the result deterministic.
- Repeating CSS radial gradients are suitable for screentone because dot size and spacing remain explicit. Layered gradients can be combined with transparency or blend modes.
- Traditional screentone is applied to bounded portions of line art. Kokoroe therefore concentrates visible dots over scene artwork and atmospheric edges while keeping fields, body copy, and semantic states calm.
- Printed color should read as flat ink absorbed by stock: slightly desaturated imagery, warm paper showing through, hard charcoal boundaries, and limited accent color. Registration drift is reserved for decorative shadows and offset rules; applying it to text or controls would reduce clarity.
- Texture is decorative. Control boundaries and focus/state indicators still need at least 3:1 contrast against adjacent colors. Grain must stay faint enough that the established text contrast remains the effective foreground/background relationship.
- Material texture stays static. It should not shimmer like digital film grain, and it should not add motion or continuous rendering cost.

## Implementation Rules

1. Use one cached, repeating fiber SVG as the common physical substrate.
2. Keep the full-page fiber overlay static, pointer-transparent, and low opacity.
3. Apply screentone selectively to illustration regions and panel edges, never across readable copy as a dominant layer.
4. Desaturate scene imagery slightly so room colors feel printed rather than screen-emissive.
5. Preserve strong ink gutters, hard shadows, visible focus, errors, and selected states.
6. Prefer CSS/SVG layers over added JavaScript, WebGL, or large photographic texture assets.

## Sources

- [MDN: SVG `feTurbulence`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence)
- [MDN: Using CSS gradients](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Images/Using_gradients)
- [MDN: `repeating-radial-gradient()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/gradient/repeating-radial-gradient)
- [Clip Studio Paint: How to Use Screentones](https://tips.clip-studio.com/en-us/articles/4511)
- [Clip Studio Paint: Effect and Tone Tools for Comics](https://www.clipstudio.net/en/comics-manga/tool/effects-tones.html)
- [Risograph Museum: Risograph printing](https://www.risomuseum.com/pages/risograph)
- [W3C: Understanding non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
