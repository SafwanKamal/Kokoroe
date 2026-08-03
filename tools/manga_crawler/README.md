# Kokoroe Manga Corpus Crawler

This program downloads only explicitly authorized manga scene assets and prepares
them for specialist-model analysis. It does not ship with a publisher scraper,
does not search the web for manga, and does not run a general-purpose LLM.

The crawler is intentionally conservative:

- every enabled source needs a rights record and an allowlisted purpose;
- only allowlisted domains and path prefixes are reachable;
- URL credentials, non-HTTP schemes, nonstandard ports, private-address targets,
  and redirect escapes are rejected;
- `robots.txt` is honored, but is treated as access policy rather than a rights
  license;
- live crawling requires an explicit command-line acknowledgement;
- downloads are rate-limited, byte-limited, dimension-limited, checksummed,
  content-addressed, atomic, resumable, and deduplicated;
- persistent SQLite state records queue status, retries, analyses, and audit
  events;
- raw assets are written under `.data/` by default, which this repository
  already ignores;
- analysis accepts only declared task-tuned model profiles and refuses profiles
  marked general-purpose.

## Model strategy

Use separate models for separate evidence:

1. **Manga layout/transcription** — the example configuration includes a
   disabled LiteRT profile for
   `leoxs22/manga-panel-detector-yolo26n`. That specialist detects panels and
   text regions only; it deliberately returns empty character, reading-order,
   and speaker-association evidence rather than inventing unsupported results.
   The model is Apache-2.0 and was trained on Manga109-s, whose use must be
   indicated clearly when publishing the model or derived experiment results.
   Pin the reviewed model revision and keep its weights under ignored restricted
   storage. The Magi-compatible example remains disabled because upstream Magi
   models declare academic-research-only usage.
2. **Japanese OCR** — the built-in optional adapter uses
   `kha-white/manga-ocr-base` through `manga-ocr`. It runs only on text regions
   emitted by a layout model; whole-page OCR is disabled because the model can
   hallucinate text when none is present.
3. **Context normalization** — configure a project-owned or otherwise
   authorized model tuned specifically for `manga-context-normalization`. It
   receives source metadata plus prior specialist results and must emit the
   bounded `PanelSpec` contract. A generic chat model is rejected when its
   profile sets `general_purpose: true`.

Models connect through one of three adapters:

- `command-json`: safest for local model wrappers. No shell is used. The command
  must contain `{input_json}` and `{output_json}` placeholders.
- `http-json`: calls a JSON inference service. Non-local endpoints require
  `data_transfer_authorized: true`; sending image bytes additionally requires
  `send_image_bytes: true`.
- `manga-ocr`: optional in-process Japanese OCR.

Every model profile must declare its task, tuning target, license, and allowed
purpose. Operator acknowledgement does not override an incompatible license;
configuration validation rejects it first.

## Install

The crawler core uses only Python's standard library:

```bash
cd tools/manga_crawler
python3 run.py --config example-config.json validate
```

For the optional manga OCR adapter, use a dedicated environment with a Python
version supported by PyTorch:

```bash
python3.13 -m venv .venv
.venv/bin/pip install -e '.[ocr]'
```

Do not install the heavy OCR/model dependencies into the Kokoroe application
environment.

For the optional LiteRT panel/text detector, create a separate environment and
install the crawler with its layout extra:

```bash
python3 -m venv ../../.data/manga-models/runtime
../../.data/manga-models/runtime/bin/pip install -e '.[layout]'
```

Download the reviewed model file outside version control, pin its immutable
upstream revision in both the download URL and `model_id`, record its SHA-256,
and pass that digest through `--model-sha256` in the disabled example profile.
The wrapper refuses a changed artifact before loading it, uses standard
640-pixel letterboxing, and converts the model's normalized detections back into
integer coordinates on the original page.

## Configure an authorized source

Copy `example-config.json` outside version control and replace every placeholder.
The preferred source mode is an explicit `assets` manifest because it preserves
work, scene, chapter, page order, prior context, and character hints.

An optional HTML discovery source has this shape:

```json
{
  "discovery": {
    "mode": "html",
    "seed_urls": ["https://licensed.example/authorized/index.html"],
    "page_link_regex": "/authorized/chapter-[0-9]+/",
    "image_url_regex": "/authorized/images/.+\\.(png|jpg)$",
    "max_depth": 2,
    "max_urls": 500
  }
}
```

Discovered images are deliberately marked `metadata-required`. A human or a
source-specific importer must supply story/scene metadata before those records
are eligible for a curated corpus.

Import reviewed metadata using JSONL records containing `source_id`, `url`,
`work_id`, `scene_id`, and `page_index`, plus optional `chapter_id`,
`context_before`, and `character_hints`:

```bash
python3 run.py \
  --config operator-config.json \
  import-metadata \
  --file reviewed-discovery-metadata.jsonl
```

### Import a licensed repository or archive

For a repository, gated dataset, ZIP, CBZ, or operator-provided archive, extract
or clone it under ignored restricted storage and configure a local-only source:

```json
{
  "source_id": "open-comic",
  "enabled": true,
  "rights": {
    "authorization_id": "cc-by-4.0",
    "basis": "open-license",
    "evidence": "https://creator.example/license",
    "permitted_purposes": ["research-evaluation"],
    "redistribution_allowed": true
  },
  "local_import": {
    "allowed_roots": ["../../.data/manga-sources/open-comic"],
    "max_files": 25
  }
}
```

The reviewed JSONL manifest must contain `source_id`, `path`, `work_id`,
`scene_id`, `page_index`, `source_revision`, `attribution`, and `license`.
Optional fields include `chapter_id`, `language`, `source_url`,
`transcript_path`, `context_before`, and `character_hints`.

```bash
python3 run.py \
  --config operator-config.json \
  import-local \
  --manifest reviewed-local-assets.jsonl \
  --acknowledge-rights \
  --limit 25
```

Relative asset paths are resolved only beneath the source's configured roots.
Path traversal and ambiguous/missing roots are rejected. The importer streams
the manifest, enforces the same image byte/header/dimension checks as network
downloads, stores content-addressed copies, and is idempotent by stable source
path. If source bytes change, derived analyses for that item are invalidated.
Repository checkout, archive extraction, license acceptance, and manifest
review remain explicit operator steps; the crawler does not execute arbitrary
archive contents or silently accept gated terms.

## Commands

Run the offline test suite from the repository root:

```bash
npm run crawler:test
```

The test runner adds the crawler's `src/` directory to Python's import path, so
an editable install is not required for core development checks.

Validation and dry-run never use the network:

```bash
python3 run.py --config operator-config.json validate
python3 run.py --config operator-config.json dry-run
```

Download authorized assets:

```bash
python3 run.py \
  --config operator-config.json \
  crawl \
  --acknowledge-rights \
  --limit 25
```

Analyze already downloaded assets:

```bash
python3 run.py \
  --config operator-config.json \
  analyze \
  --acknowledge-model-licenses \
  --limit 25
```

Run both stages:

```bash
python3 run.py \
  --config operator-config.json \
  run \
  --acknowledge-rights \
  --acknowledge-model-licenses
```

Inspect the resumable queue:

```bash
python3 run.py --config operator-config.json stats
```

Use `--source SOURCE_ID` to restrict a dry-run, crawl, or analysis pass.

## Specialist analyzer contract

Each command/HTTP analyzer receives:

```json
{
  "schema_version": 1,
  "task": "manga-layout-transcription",
  "model_id": "project/model",
  "source": {
    "source_id": "licensed-source",
    "url": "https://licensed.example/page.png",
    "metadata": {}
  },
  "asset": {
    "path": "/absolute/restricted/path/hash.png",
    "sha256": "..."
  },
  "prior_results": []
}
```

Layout output must contain arrays for `panels`, `characters`, and `text_blocks`.
Every item has an `id`, `[x, y, width, height]` integer `bbox`, and confidence
between 0 and 1. It may also return `reading_order` and `speaker_links`.

Context output must contain `panel_specs`. Unknown fields are rejected. Each
candidate must include boolean `should_generate` and confidence between 0 and 1;
supported fields are defined in `analysis.py`.

The runner executes enabled profiles in configuration order and passes each
validated result to the next profile. Untrusted model output never bypasses the
normalizers.

## Operational notes

- Keep authorization evidence and operator configs outside the repository.
- Do not enable `allow_private_hosts` for internet crawls.
- Use a truthful user agent and monitored contact address.
- Keep `fail_closed_robots: true` unless the source owner has supplied a
  documented alternative access mechanism.
- Review downloaded metadata-required records before dataset export.
- Source withdrawal should remove the corresponding content-addressed blobs,
  records, state rows, derived analyses, and any exported dataset versions. That
  destructive workflow is intentionally not automatic in this first crawler;
  implement it as an audited corpus-governance command after the source schema
  and retention policy are accepted.
