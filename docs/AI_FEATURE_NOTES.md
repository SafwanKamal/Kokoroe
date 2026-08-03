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

### Context-to-panel training path

Do not begin by training an image model to interpret raw chat history. Split the
problem into two bounded stages:

1. A context director converts an approved, pseudonymized conversation window
   into a typed `PanelSpec`.
2. An image model renders that specification with approved world and character
   references.

The `PanelSpec` should identify the selected world, visible character ids,
setting, story beat, action, emotion, camera/framing, composition, time and
lighting, manga effects, continuity facts, and exclusions. Dialogue and
lettering should remain real application text or reviewed SVG/HTML overlays
rather than being baked into generated pixels.

Before fine-tuning, establish a no-training baseline with a licensed base model,
structured prompts, approved character/style references, and pose, depth,
sketch, or layout conditioning where useful. Freeze a small held-out evaluation
set of varied conversation contexts and score context fidelity, character
identity, world continuity, composition, visual quality, safety, and unwanted
text independently. This identifies whether the first failure is context
direction, identity, style, or layout.

If the baseline demonstrates a specific repeatable gap, train a small adapter
for that gap instead of a new foundation model. Keep style and character
identity separate initially so either can be replaced or tuned without
retraining the other. Use only owned, commissioned, public-domain, or explicitly
licensed images, and record provenance, permitted uses, captions, character
ids, world ids, composition labels, and split membership beside every asset.
Split evaluation data by scene or story sequence rather than random neighboring
panels to avoid continuity leakage.

The first training dataset should favor carefully reviewed variation over
volume: recurring characters across multiple expressions, poses, distances,
angles, lighting conditions, interactions, and quiet as well as dramatic
moments. Add more data only in response to measured failures. DreamBooth-style
subject tuning can be useful for a narrow identity experiment, while LoRA-style
adapters are the preferred first style or concept experiment because they are
smaller and easier to compare, version, and remove.

No generated scene may publish automatically. Store the source context id,
`PanelSpec`, model and adapter versions, seed, guidance/control settings,
reference ids, moderation result, and reviewer outcome with each candidate.
Approved scene moments remain a separate asset class from runtime avatars and
room art and need their own import and browser-review contract before product
integration.

### Dual-corpus curation

Contextual panel work begins with two separate provenance-aware corpora. They
share the same normalized `PanelSpec` contract but serve different evaluation
purposes and must not be silently merged.

The authorized manga corpus evaluates visual grounding: how an observed story
beat, cast, setting, composition, and manga grammar correspond to an actual
panel. Its unit is a scene bundle, not an isolated scraped image. Each bundle
should retain a rights record, work and scene ids, ordered page/panel position,
an image reference, prior narrative context available at that point, a
human-reviewed `PanelSpec`, visible character and continuity annotations, and
visual-composition labels. Future story information may be recorded for
analysis but must be excluded from model input. Acquisition is restricted to
owned, commissioned, public-domain, or explicitly licensed sources; crawler
access and `robots.txt` compliance do not themselves establish training or
redistribution rights.

The human-conversation corpus evaluates contextual direction and end-to-end
generation. Its unit is a consented conversation episode with a chosen cutoff,
so only turns available at generation time enter the context window. Every
participant must be covered by the collection and model-evaluation consent,
version, retention, withdrawal, and deletion records. Raw conversations belong
in a restricted source store; the working corpus uses pseudonymous participant
ids, redacted turns, and the minimum retained metadata needed for evaluation.
Existing Kokoroe messages collected for ordinary chat or classifier operation
must not be repurposed for art-model development without a new, specific
authorization.

Human conversation does not imply one objectively correct illustration.
Reviewers should annotate zero or more acceptable `PanelSpec` interpretations,
confidence, and a `shouldGenerate` decision. Routine, sensitive, ambiguous, and
visually unhelpful exchanges should include valid `shouldGenerate: false`
examples so the system does not dramatize every conversation.

A separate generation-run registry joins either corpus to renderer evidence.
Each run records the source record and normalized-spec versions, model and
adapter versions, seed and control settings, input reference ids, output asset,
automated checks, reviewer ratings, rejection reasons, and approval status.
This permits model comparisons without copying source panels or raw
conversations into result records.

Recommended logical entities:

- `source_works`, `rights_records`, `scene_bundles`, and `panel_observations`
  for the manga corpus;
- `conversation_studies`, `participant_consents`, `conversation_episodes`, and
  `redacted_turns` for the human corpus;
- versioned `panel_specs`, `annotations`, `dataset_splits`, `generation_runs`,
  and `review_outcomes` shared across both.

The first pilot should validate the schema, rights and withdrawal workflow,
annotation agreement, context cutoffs, and model-comparison loop before scaling
the crawler or collecting a large volume of conversation.

### Manga crawler foundation

The first acquisition tool lives under `tools/manga_crawler/`. It is an
authorization-first, resumable downloader and specialist-analysis runner, not a
publisher scraper or open-web manga searcher. Sources must declare rights
evidence, permitted purposes, domain and path allowlists, and ordered scene
metadata. HTML-discovered images remain ineligible for analysis until reviewed
story metadata is imported.

Analysis is deliberately specialist-first. Layout and transcription belong to
a manga-tuned detector; Japanese OCR runs only over detected text regions; and
context normalization belongs to a project-owned or otherwise authorized model
tuned for the bounded `PanelSpec` task. General-purpose model profiles are
rejected. Every enabled model must declare its tuning target, license, and
allowed purpose, and research-only weights must remain disabled outside their
permitted use.

The tool validates redirect targets, robots policy, download size and image
dimensions; stores assets by SHA-256 with provenance; and persists retries,
analysis results, and audit events in SQLite. Live acquisition and model
analysis require separate operator acknowledgements. These acknowledgements do
not substitute for source rights or compatible model licenses.

#### Candidate source ladder

Use sources according to their actual reuse terms, not merely their public
availability:

1. **Manga109-s** is the preferred real-manga corpus. Its 87 books include page
   images plus frame, face, body, character, and text annotations; the older
   release also includes Manga109Dialog speaker-to-text associations. Its
   custom license permits machine-learning and image-processing experiments and
   commercial use of resulting models, but requires access approval, forbids
   redistribution of the raw dataset, requires disclosure when publishing
   trained models, and limits published whole-page examples. Acquire it through
   the gated Hugging Face repository after accepting the terms; do not crawl
   the public project website.
2. **Ubunchu** is a small actual-Japanese-manga pilot. Its public repository
   contains Japanese and English releases of chapters 1–8 under CC BY-NC 3.0.
   Restrict it to noncommercial research/evaluation, preserve attribution and
   license records, and verify file-level credits before import.
3. **Pepper&Carrot** is the best immediate open pipeline fixture. Complete
   sequential episodes, compiled pages, art sources, text/SVG sources,
   transcripts, and credits are published under CC BY 4.0 with commercial reuse
   allowed. It is not manga, so use it to validate chronology, character
   continuity, dialogue extraction, attribution, and `PanelSpec` normalization,
   not to establish manga style.
4. **eBDtheque** is a useful requested-access benchmark for layout, balloons,
   text, characters, and speaker associations. Its 100 mixed comic pages are
   limited to scientific noncommercial computer-science use and do not preserve
   hierarchical links between pages, so it is not the primary context corpus.
5. **Digital Comic Museum / Comics100** can provide public-domain Golden Age
   comics for page-layout scale and panel detection. They are American comics,
   not manga, and individual rights/provenance records must still be retained.
6. **Smithsonian Hokusai Manga** assets explicitly marked CC0 are safe
   historical visual references, but the sketchbook format is not a modern
   sequential-panel context dataset.

Small freely licensed works such as Duke's *Bound by Law?* may supplement
end-to-end ingestion fixtures, but their noncommercial/share-alike conditions
must remain attached and they should not be mistaken for manga training data.

#### First local pilot

The first bounded source pilot uses ignored shallow checkouts and an ignored
operator manifest:

- four Japanese pages from Ubunchu chapter 1 at repository revision
  `9f065a3fde464be893dfba9fb5fc6abc93722cf9`, restricted to
  noncommercial research/evaluation under the chapter's CC BY-NC terms;
- four Pepper&Carrot episode 1 artwork pages at repository revision
  `36cc042afc37679a4885c62defaac3ed09aa5d63`, paired with the official
  English transcript and episode-specific David Revoy attribution under
  CC BY 4.0.

The local manifest importer resolves files only beneath source-specific
allowlisted roots, streams reviewed JSONL, rejects traversal, enforces image
byte/header/dimension limits, and records stable source paths, revisions,
attribution, licenses, story order, context, content hashes, and audit events.
Re-importing the eight-page pilot produces eight unchanged records rather than
duplicates. Changed bytes reset the affected item to pending analysis and
delete its stale derived analyses.

All raw checkouts, manifests, blobs, and SQLite state remain under ignored
`.data/`. The Pepper&Carrot repository PNGs are low-resolution artwork layers
paired with a transcript rather than composited text pages, so they are useful
for sequence/context validation but not Japanese OCR evaluation.

#### First specialist layout pass

The eight pilot items were analyzed locally with the Apache-2.0
`leoxs22/manga-panel-detector-yolo26n` model at immutable revision
`535bbe1fc1e922d2108f918cd1bce29ba3516196`. Its reviewed INT8 LiteRT artifact
has SHA-256
`b1a7d8d4492e04a777ae0d3efd9dc1fbd6e8f361971eadb813279ce3dfd1b464`.
The model is tuned on Manga109-s for panel and text-region detection. Published
uses must retain the model's Apache notice and clearly indicate Manga109-s as
the training dataset under the dataset's result-publication condition.

The crawler now provides a dependency-isolated LiteRT wrapper that letterboxes
pages to 640 pixels, converts the model's normalized output back to original
integer page coordinates, and emits only supported evidence. It returns empty
character, reading-order, and speaker-link arrays because this detector does not
perform those tasks. MAGI remains disabled because its upstream weights are
limited to academic research.

The bounded pass produced eight analysis records. The two Ubunchu interior
pages yielded three panels/four text regions and six panels/twelve text regions;
the chapter notice and cover correctly remained empty. Two sequential
Pepper&Carrot strip pages yielded three panels each and no text regions; its
blank first art layer and unframed full-page illustration remained empty.
Every result was rendered as an overlay and visually inspected. These are
machine-generated pilot annotations, not accepted ground truth. No OCR,
character grounding, context normalization, training, dataset export, or
runtime publication occurred.

#### Translated-first extraction side project

Source acquisition now prioritizes manga with professionally aligned
translations over larger untranslated page collections. The extraction,
translation-alignment, and animatic work is isolated in the standalone
`/Users/safwankamal/Desktop/Desktop - Safwan’s MacBook Air/Code/MangaPanelLab`
project rather than expanding Kokoroe's runtime or application dependencies.

MangaPanelLab's first source is OpenMantra at pinned revision
`59341ad922284a8be219b7784feb5a79779a1447`, restricted to noncommercial
research/evaluation under CC BY-NC 4.0. It supplies five real manga, 214
Japanese pages, and 1,592 text-region annotations with professional English and
Chinese translations. The project downloads the source as a pinned inert
archive rather than cloning or executing its repository, normalizes the
translation evidence, and keeps source pages, panel crops, text crops, reading
order, OCR, machine translation, and animations as separate layers.

The first bounded extraction processed eight pages into 45 panel crops and 83
professionally translated text-region crops. A 36-frame GIF animatic verified a
non-generative panel-motion path using only crop ordering, pan/zoom, and aligned
English captions. These derivatives remain ignored, noncommercial pilot
artifacts. Panel order is machine-suggested and must be reviewed; no OCR,
machine translation, character grounding, training, or Kokoroe runtime
publication occurred.

Ubunchu is the next source-adapter candidate because its Japanese and English
release pages can test page alignment and localization-induced layout changes.
WIPO's officially multilingual *Honmono* manga remains rights-review-only:
public download availability is not sufficient permission for dataset
extraction or model use.

The completed semantic baseline keeps the pinned panel/text detector as the
geometry authority. Apache-2.0 Qwen3-VL-4B ran 24 deterministic attempts over
the reviewed eight-page set on the 16 GB Apple M4 host. After a narrow
identical-duplicate-key normalizer, 15 proposals were schema-valid: all 15 had
exact panel order, 12 had acceptable story beats, but dialogue assignment was
only 99/159 (62.3%). The deterministic containment/overlap assignment scored
83/83 across the review set. Peak resident memory was approximately 5.65-5.80
GB and mean runtime was 153.941 seconds per attempt.

This rejects one-pass semantic proposals for production. The next experiment
must link text regions to panels deterministically, then use smaller Qwen calls
for page-level order/story and panel-local semantics before strict merge-time
validation. Florence-2 remains deferred because accepted order/geometry did not
disagree; Molmo2 remains deferred until the split-pass design is measured. Full
evidence and failure analysis live in MangaPanelLab's
`docs/VLM_BASELINE_RESULTS.md`. No VLM output becomes reviewed ground truth
automatically.

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

NEXT-007 supports two server-owned global-cloud adapters behind `KOKOROE_CLASSIFIER_PROVIDER`: `gateway` retains Vercel AI Gateway, while `openrouter` uses the official OpenRouter AI SDK provider. OpenRouter requires a server-only `OPENROUTER_API_KEY` and a fixed `:free` model id; every request requires structured-output parameter support, denies provider data collection, and restricts routing to ZDR endpoints. Automatic selection requires `KOKOROE_MESSAGE_CLASSIFIER=global-cloud`, a server-owned room id in `KOKOROE_CLASSIFIER_CANARY_ROOMS`, and an explicit request-scoped user opt-in. The optional, unchecked login control discloses the bounded context and purpose separately from the required Privacy Policy agreement; the browser-session choice can be withdrawn from chat navigation and is removed on logout. Each message request still carries the current boolean consent gate to the server. Provider or schema failures degrade to `plain`, and evaluation uses only the synthetic labeled set. A key or free model does not constitute model acceptance.

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
