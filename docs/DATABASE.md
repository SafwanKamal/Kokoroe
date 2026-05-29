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

## Store Adapter Contract

The current adapter contract is intentionally small:

- `getState()`: load the complete development state.
- `saveState(store)`: persist the updated state.

This matches the JSON adapter today and gives us a clean seam for SQLite/Postgres later. The SQLite adapter now writes relational tables for users, sessions, profiles, avatar selections, and messages while still reconstructing the full state object for the current domain layer. A later repository pass should replace broad full-state saves with table-specific writes without changing route contracts.

## Next Database Step

Move from full-state adapter methods to table-specific repository methods before adding hosted infrastructure.

SQLite is the right next step because Kokoroe is still shaping its data model, and local development should remain cheap, inspectable, and easy to reset. The schema should be written so it can later move to Postgres with minimal model changes.

For deployment with realtime, the likely production path is Supabase Postgres: route handlers keep doing validation/writes, and clients subscribe to committed room message changes.

## Initial Tables

- `users`: account identity, display name, timestamps
- `credentials`: username/email identity plus salted password hash, or equivalent columns while the app is small
- `sessions`: development or auth sessions, user id, timestamps, expiration later
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

## Rules

- Static room and avatar catalogs can stay file-backed until users can create or edit them.
- Messages and user profile choices should be database-backed once SQLite is introduced.
- Message creation must validate session, room, avatar ownership-by-room, character limit, and presentation id on the server.
- Login must verify credentials server-side. Account creation must reject duplicates and never persist plaintext passwords.
- Browser sessions should be restored through an httpOnly session cookie. Client state may mirror the current session id while the app is running, but refresh/login continuity should not depend on readable browser storage.
- The frontend should treat the API as the source of truth, even while the backing store is still JSON.
