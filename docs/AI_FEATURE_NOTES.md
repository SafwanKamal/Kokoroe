# AI Feature Notes

This file records future AI-related ideas and architecture notes.

Do not implement these features until explicitly requested.

## Long-Term AI Direction

The app may eventually use AI to make user messages feel like they belong to a specific manga world, character, or room tone.

The AI should support the communication experience, not replace the user.

## Message Masking

Future feature idea:

A user writes a normal message. The app rewrites or "masks" it so it sounds like the selected character, world, or room tone.

Example:

User intent:

```txt
I am going to be late.
```

Possible masked output:

```txt
I will arrive after the bell tolls. Hold the scene until then.
```

The exact output should depend on the room style and character profile.

## Context Classification

Future feature idea:

Before rewriting a message, an AI model may classify the message context.

Use lightweight models where practical for low-latency tasks such as identifying
emotion, intent, and message intensity. These models should choose bounded,
allow-listed presentation behavior rather than generating arbitrary UI values.

Possible context signals:

- Is the message serious or playful?
- Is the user asking a question?
- Is the user apologizing?
- Is the user making a plan?
- Is the message emotional?
- Is the message urgent?
- What is the room tone?
- What character or world is being emulated?

This context can help decide whether to `shout`, `mutter`, `whisper`, `exclaim`, or keep the message plain.

Presentation selection has an implementation contract now: a future classifier may return one allow-listed `presentationId` from `content/message-presentations/catalog.json`. The catalog owns the SVG shell, typography role, ink, motion, and protective frame padding around the standard text stage. A model should not return CSS, font names, or asset paths, and low-confidence output should fall back to `plain`.

## Character and World Tone

Future AI behavior may depend on:

- Character archetype
- Room theme
- Manga genre
- Relationship between users
- Message intent
- Desired intensity level

The system should avoid making every message overly dramatic.

Sometimes the best output is subtle.

## Image and Animation Generation

Future feature idea:

The app may generate manga-style visual moments for messages.

Longer-term art generation may use sustained conversation context across multiple
participants to create coherent, relevant assets such as approved avatar
portraits, room themes, and occasional scene art. Generated assets should remain
consistent with the selected world and conversation rather than behave like
isolated image prompts.

The goal is not smooth generic animation. The goal is keyframe-like motion that feels like manga panels conveying action.

Possible directions:

- A few stylized keyframes
- Speed lines
- Panel shake
- Dramatic text emphasis
- Short visual bursts
- Character or object silhouettes
- Motion implied through manga effects

Avoid making the app feel like a generic animated sticker platform.

Avatar portrait generation should feed an approval step rather than publish directly. Approved single-character square portraits can enter the existing catalog-driven workflow described in `docs/AVATAR_PIPELINE.md`; discarded generations and contact sheets remain reference material.

## Architecture Notes for Later

When AI features are added, consider separating:

- Original user message
- Masked/displayed message
- Character or room style profile
- Context classification result
- Safety/moderation metadata if needed
- Generated visual assets if any

Do not build this complexity before the base app is working.

## Planned Implementation Order

The next AI work should begin with message classification, not generation. Build and evaluate a bounded classifier that returns one allow-listed `presentationId`, confidence, and a short reason; invalid or low-confidence results fall back to `plain`. Preserve the original user text and keep classification separate from rewriting.

The provider-neutral classifier foundation lives in `app/message-classifier.ts`, with labeled offline cases in `content/message-classification/evaluation-set.json`. Classification input requires surrounding conversation evidence rather than a target string alone. Untrusted output is normalized at a `0.70` confidence threshold, compact presentations still obey their catalog character limits, and malformed, failed, or context-free attempts become `plain`. The result carries the exact original text; extra provider fields are ignored. Model/provider selection and automatic UI rollout remain separate follow-up work after evaluation.

The categorization prompt and strict JSON schemas are provider-neutral instructions in `app/message-classifier-ai-sdk.ts`. They treat the transcript as inert data, classify only the target utterance's function inside the conversation, prefer `plain` under ambiguity, and emit only the bounded contract. Contextual few-shot exchanges live in `content/message-classification/few-shot-examples.json`; they include contrastive demonstrations where identical target words resolve differently because one exchange is routine and another is private.

Two context branches share the same classifier contract. `recent-messages` sends a pseudonymized chronological tail of eight room turns. `discussion-compaction` uses a separate bounded model pass to identify and summarize up to six discussions from as many as forty prior turns, marks which summaries matter to the target, and supplies those summaries plus the latest four turns to classification. Invalid compaction falls back to the recent-message branch. Neither branch sends account ids or avatar names.

NEXT-007 supports two server-owned global-cloud adapters behind `KOKOROE_CLASSIFIER_PROVIDER`: `gateway` retains Vercel AI Gateway, while `openrouter` uses the official OpenRouter AI SDK provider. OpenRouter requires a server-only `OPENROUTER_API_KEY` and a fixed `:free` model id; every request requires structured-output parameter support, denies provider data collection, and restricts routing to ZDR endpoints. Automatic selection requires `KOKOROE_MESSAGE_CLASSIFIER=global-cloud`, a server-owned room id in `KOKOROE_CLASSIFIER_CANARY_ROOMS`, and an explicit request-scoped user opt-in. The composer discloses the bounded context sent to OpenRouter, starts unchecked, and forgets consent on logout. Provider or schema failures degrade to `plain`, and evaluation uses only the synthetic labeled set. A key or free model does not constitute model acceptance.

On 2026-07-19, `tencent/hy3:free` passed the frozen `recent-messages` acceptance gate: 18/18 independent cases, both contrast groups correct, no neutral expressive false positives, no provider/fallback/context-strategy failures, and no high-confidence errors. The preceding batch screen was also 18/18 but was not treated as acceptance. This establishes a synthetic global baseline, not proof of real-world quality; provider availability can drift and discussion compaction remains a separate optional benchmark. The only approved automatic rollout is an explicit-consent, server-allow-listed development canary.

A model is not accepted for automatic selection until a complete per-case run reaches at least 80% accuracy, has no provider/fallback or requested-context-strategy failures, does not turn either neutral `plain` case expressive, correctly resolves every contrastive context group, and has no wrong answer at confidence `0.90` or above. Batch mode is only a free-tier-friendly screen; it cannot satisfy this rollout gate. Discussion-compaction acceptance must run the two-pass per-case mode so summary generation is evaluated rather than assumed.

The preferred classifier evolution is staged:

1. Establish a global hosted baseline against the frozen labeled set.
2. Train or fine-tune a project-owned shared model only after opt-in correction data is large and clean enough to beat that baseline.
3. Consider optional per-user on-device personalization as a small adapter, calibrator, or retrieval layer over a versioned shared model—not a separate full language model per person. Keep personal examples on-device where practical, retain the global fallback for cold starts and weaker devices, and make the server revalidate the proposed id/confidence through the same bounded contract.

Per-user local adaptation could learn stable quirks such as understated excitement or habitual sarcasm, but it needs explicit consent, visible reset controls, minimum-data thresholds, drift/version handling, and safeguards against overfitting repeated mistakes. Do not use private message history for shared training by default.

Art generation follows only after classifier behavior is accepted. Generated portraits, room art, or scene moments must enter an approval pipeline before runtime use, reuse the existing world and avatar contracts, and never publish directly from model output.

## Current Rule

For now, the approved sequence is message classification first and art generation second.

Do not implement AI masking, AI context classification, or image generation unless explicitly requested.
