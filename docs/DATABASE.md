# Kokoroe Database Plan

Kokoroe should keep backend logic behind a persistence boundary instead of letting UI components or route handlers know which database is used.

## Current Stage

Use `.data/kokoroe-dev-store.json` as the default local development adapter.

- It is ignored by git.
- It is good enough for feature logic, profile memory, and API contract work.
- It is not production storage.
- Do not store plaintext passwords or secrets in it. Development credentials may store salted password hashes only.
- The adapter boundary lives under `app/stores/`. Domain logic should call a store adapter, not file-system APIs directly.

Set `KOKOROE_STORE=sqlite` to use the SQLite adapter at `.data/kokoroe-dev.sqlite`.
Set `KOKOROE_STORE=supabase` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to use hosted Supabase Postgres through server-only API routes. Keep the service role key out of frontend code. `SUPABASE_DIRECT_URL` or `DATABASE_URL` are still useful for migration scripts; prefer Supabase's transaction pooler connection string as `DATABASE_URL` for Vercel/serverless deployments when using direct Postgres connections.

## Store Adapter Contract

The current adapter contract is intentionally small:

- `getState()`: load the complete development state.
- `saveState(store)`: persist the updated state.

This matches the JSON adapter today and gives us a clean seam for SQLite/Postgres later. The SQLite adapter now writes relational tables for users, sessions, profiles, avatar selections, and messages while still reconstructing the full state object for the current domain layer.

The adapter contract also supports optional table-specific hooks for production-oriented stores. Supabase implements narrow account/session/profile/message writes so message creation inserts one `messages` row instead of rewriting the whole state. JSON and SQLite can continue using `saveState(store)` until they need the same optimization.

## Next Database Step

Continue moving any high-traffic store behavior from full-state adapter methods to table-specific repository methods.

SQLite is the right next step because Kokoroe is still shaping its data model, and local development should remain cheap, inspectable, and easy to reset. The schema should be written so it can later move to Postgres with minimal model changes.

For deployment with realtime, the likely production path is Supabase Postgres: route handlers keep doing validation/writes, and clients subscribe to committed room message changes.
The Supabase adapter still honors the broad state-shaped adapter contract so production can move to Postgres without rewriting route contracts. It uses Supabase's REST API with the server-only service role key because the direct database hostname is not IPv4-compatible from every environment. Prefer its table-specific hooks for account/session/profile/message mutations before serious multi-user traffic.

The initial Supabase migration has been applied to the hosted project. Row Level Security is enabled on Kokoroe tables. The current server-route adapter uses the service role key and bypasses RLS; future client-side realtime needs deliberate read policies so anon-key subscriptions only see allowed rows.

Realtime currently exposes `messages` inserts to browser clients with the publishable key. The only public RLS policy is `SELECT` on `messages`; all writes still go through Kokoroe API routes with server-side validation. The client subscribes to message inserts and filters by room id in application code so room ids with punctuation do not depend on realtime filter parsing.

`/api/health` is the lightweight production readiness check. It forces a fresh store read and returns public operational counts only, so deployment checks can confirm the configured adapter is reachable without exposing user/session data.

Backend contract tests now cover the local adapter path for account creation, duplicate rejection, password login, session restore, world-scoped avatar memory, wrong-room avatar rejection, and message persistence. Keep these tests adapter-independent so JSON/SQLite/Supabase changes do not alter route/domain behavior accidentally.

## Initial Tables

- `users`: account identity, display name, timestamps
- `credentials`: username/email identity plus salted password hash, or equivalent columns while the app is small
- `sessions`: development or auth sessions, user id, timestamps, expiration
- `user_profiles`: current room id and user-level preferences
- `user_avatar_selections`: one selected avatar per user per room
- `rooms`: only if runtime-created rooms exist; static catalog rooms can stay in content files for now
- `messages`: room id, user id, avatar id, text, presentation id, created timestamp

Implemented local SQLite tables:

- `store_meta`
- `users`
- `user_profiles`
- `user_avatar_selections`
- `sessions`
- `messages`

The older SQLite snapshot row in `app_state` is read once if present and migrated into relational tables.

Session rows include `expires_at`. Existing development sessions without that field are migrated to a 30-day expiry based on their creation time, and expired sessions are pruned when used.

## Rules

- Static room and avatar catalogs can stay file-backed until users can create or edit them.
- Messages and user profile choices should be database-backed once SQLite is introduced.
- Message creation must validate session, room, avatar ownership-by-room, character limit, and presentation id on the server.
- Login must verify credentials server-side. Account creation must reject duplicates and never persist plaintext passwords.
- Browser sessions should be restored through an httpOnly session cookie. Client state may mirror the current session id while the app is running, but refresh/login continuity should not depend on readable browser storage.
- The frontend should treat the API as the source of truth, even while the backing store is still JSON.
