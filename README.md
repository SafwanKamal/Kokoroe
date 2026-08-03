# Kokoroe

Kokoroe is a manga-inspired chat app built with Next.js. It combines expressive message presentations, world-scoped avatars, multiple rooms, credential-backed sessions, and swappable local or Supabase persistence.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default development store is `.data/kokoroe-dev-store.json`, which is created locally and ignored by git.

Useful commands:

```bash
npm run check       # tests, type checking, and production build
npm test            # Vitest suite
npm run typecheck   # TypeScript only
npm run build       # production build
```

## Persistence

- JSON is the zero-configuration development default.
- Set `KOKOROE_STORE=sqlite` to use `.data/kokoroe-dev.sqlite`.
- Set `KOKOROE_STORE=supabase` and configure the variables in `.env.example` to use Supabase.
- Message classification is off by default. `KOKOROE_CLASSIFIER_PROVIDER=openrouter` uses the server-only `OPENROUTER_API_KEY`, the accepted `tencent/hy3:free` recent-message candidate, strict structured output, required-parameter routing, denied provider data collection, and per-request ZDR routing; account-wide ZDR is optional. `gateway` retains the Vercel AI Gateway adapter. Classification always receives pseudonymized conversation context: `KOKOROE_CLASSIFIER_CONTEXT=recent-messages` uses the latest eight room turns, while `discussion-compaction` first segments up to forty turns into bounded topic summaries and then retains a four-turn tail. With no prior context, classification returns `plain` without calling a model. Automatic selection requires all three gates: `KOKOROE_MESSAGE_CLASSIFIER=global-cloud`, a server-owned room id in `KOKOROE_CLASSIFIER_CANARY_ROOMS`, and explicit request-scoped user consent in the composer. Consent is off by default and is not persisted across logout; the UI discloses the exact context window before opt-in. `npm run classifier:evaluate -- --provider=openrouter` performs one-request screening; add `--per-case` for the required benchmark or `--per-case --context-strategy=discussion-compaction` for the two-pass branch.

The UI and route handlers depend on the domain API in `app/kokoroe-store.ts`; concrete persistence adapters live in `app/stores/`.

## Project guidance

Read `AGENTS.md` before making changes. Product and architecture context lives in `docs/`, especially:

- `docs/VISION.md`
- `docs/ROADMAP.md`
- `docs/DESIGN_DECISIONS.md`
- `docs/DATABASE.md`
- `docs/AVATAR_PIPELINE.md`
- `docs/MESSAGE_PRESENTATION_PIPELINE.md`
