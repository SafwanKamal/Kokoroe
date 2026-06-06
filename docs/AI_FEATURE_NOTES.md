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

## Current Rule

For now, only design the app so AI features can be added later.

Do not implement AI masking, AI context classification, or image generation unless explicitly requested.
