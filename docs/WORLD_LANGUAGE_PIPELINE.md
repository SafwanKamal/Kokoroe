# World Language Pipeline

Kokoroe treats interface voice as a small product system, not as clever strings scattered through components. The language may feel manga-aware and characteristic, but the underlying action must remain clear.

## Source of Truth

- Approved and draft copy: `content/world-language/catalog.json`
- Typed runtime access: `app/world-language.ts`
- Structural validation: `npm run world-language:check`
- Behavioral tests: `tests/world-language.test.ts`

Every catalog entry has a semantic id, surface, intent, plain-language meaning, review status, and one or more variants. Expressive actions may also provide a literal `ariaLabel`.

Use semantic ids such as `auth.create.submit`; do not name entries after their current words. That lets the copy change without renaming component logic.

## Editorial Flow

1. **Inventory the literal moment.** Record the surface, user intent, current generic text, and whether misunderstanding could cost data, privacy, money, or access.
2. **Choose the metaphor lane.** Prefer Kokoroe's existing vocabulary: cast and identity, panels and lines, stories and arcs, scenes and worlds, inking and page turns.
3. **Draft by operation.** Give meaningfully different work its own activity phrase. Account creation may be `Inking your place…`; returning to an account may be `Turning to your story…`. Do not rotate synonyms randomly.
4. **Protect clarity.** Keep form fields, permissions, policy consent, errors, and destructive actions mostly literal. Add a literal accessible label when an expressive button could be misunderstood.
5. **Review in context.** Check tone, length, grammar, and the surrounding visual hierarchy at desktop and mobile widths. A phrase that is charming in a list may be awkward inside its actual control.
6. **Approve and integrate.** Move the entry from `draft` to `approved`, consume it through `getWorldCopy`, then run `npm run world-language:check`, tests, and browser inspection.

## Research-backed Voice Rules

Kokoroe's characteristic language comes from its content nouns, not from disguising ordinary controls as lore.

| Interface role | Rule | Evidence applied |
|---|---|---|
| Action buttons | Start with a familiar verb and name the result. Do not trade clarity for cute or clever phrasing. | Apple recommends concise, action-oriented button labels and explicitly warns against overly clever wording. |
| Binary settings | Name the affected feature, then show an unmistakable `On` or `Off` state. | Apple requires toggles to clearly identify what they affect; Microsoft recommends short noun labels and retaining `On`/`Off` when those states fit. |
| Manga vocabulary | Use established objects such as panels, speech bubbles or balloons, characters, and worlds. Do not invent mystical substitutes for UI state. | Clip Studio Paint's comic tooling uses the established terms panels, balloons, balloon layers, and speech bubbles. Kokoroe retains `bubble` because that is already the product's consent and presentation term. |
| AI and consent | Say when AI is active, explain what it changes, and make opting out immediate. | Google's People + AI Guidebook emphasizes clear in-context controls, explicit data-use explanations, and easy opt-out. |
| Account boundaries | A reversible session action may carry a restrained story metaphor when its placement is familiar and its accessible name stays literal. Keep destructive confirmations and consequences conventional. | `Leave the Story` gives Kokoroe a recognizable voice while `Sign out of Kokoroe` preserves the exact action for assistive technology. |

Research sources: [Apple Writing](https://developer.apple.com/design/human-interface-guidelines/writing), [Apple Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles), [Microsoft toggle guidance](https://learn.microsoft.com/windows/apps/design/controls/toggles), [Clip Studio Paint balloons](https://help.clip-studio.com/en-us/manual_en/540_comic/Balloons.htm), and [Google People + AI feedback and controls](https://pair.withgoogle.com/guidebook-v2/chapter/feedback-controls/).

## Runtime Rules

- Runtime UI should consume approved copy through `getWorldCopy`; do not import the JSON directly.
- A `default` variant is required. Named variants describe real UI states such as `busy`, `empty`, or `retry`.
- Variant selection must be deterministic from product state. The system should not pick a random synonym on every render.
- Placeholders use `{name}` syntax and must be present in every variant of an entry.
- Use `getWorldCopyAriaLabel` for expressive controls whose visible label does not state the literal action.
- This catalog owns product-system copy. User messages, room-authored fiction, legal policy text, and server error details remain in their appropriate sources.

## First Integrated Slice

Authentication proves the pipeline with a coherent cast-and-story lane:

- `Create account` becomes `Join the Cast`.
- Account creation works as `Inking your place…`.
- Returning sign-in remains the established `Get Isekaied`, while its work state becomes `Turning to your story…`.
- Nearby headings and switch copy explain the metaphor; username, password, privacy, and consent language stay literal.

## Navigation Slice

Chat and setup navigation use clear actions with manga-specific content nouns:

- `Back to Setup` becomes `Change World + Character`.
- AI bubble styling is presented as `AI Bubble Styling · Off` or `AI Bubble Styling · On`; the control remains an `aria-pressed` toggle named `AI bubble styling`.
- `Logout` becomes `Leave the Story`, with the accessible action `Sign out of Kokoroe`.

This revision supersedes `Change World + Role` and `Bubble Spirit · Asleep/Awake`. Those labels used a less precise identity noun or invented an undefined metaphor for a binary setting. `Leave the Story` remains accepted: it is a restrained, comprehensible narrative action supported by the literal accessible name `Sign out of Kokoroe`. Disabling AI bubble styling changes the cloud classifier path, not message text or the local presentation fallback.

Expand one surface at a time. The next useful inventory is room discovery, membership, empty states, and network activity copy.
