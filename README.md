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

The UI and route handlers depend on the domain API in `app/kokoroe-store.ts`; concrete persistence adapters live in `app/stores/`.

## Project guidance

Read `AGENTS.md` before making changes. Product and architecture context lives in `docs/`, especially:

- `docs/VISION.md`
- `docs/ROADMAP.md`
- `docs/DESIGN_DECISIONS.md`
- `docs/DATABASE.md`
- `docs/AVATAR_PIPELINE.md`
- `docs/MESSAGE_PRESENTATION_PIPELINE.md`
