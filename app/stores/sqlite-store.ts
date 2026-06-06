import { mkdirSync } from "node:fs";
import path from "node:path";
import type { ChatMessage } from "../chat-data";
import { createSeedStore } from "./seed";
import type { KokoroeStoreAdapter, KokoroeUser, StoreState } from "./types";

type SqliteRunResult = {
  changes: number;
};

type SqliteStatement = {
  all(...values: unknown[]): unknown[];
  get(...values: unknown[]): unknown;
  run(...values: unknown[]): SqliteRunResult;
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
};

type DatabaseSyncConstructor = new (filename: string) => SqliteDatabase;

type MetaRow = {
  counter: number;
  version: number;
};

type UserRow = {
  created_at: string;
  display_name: string;
  email: string | null;
  id: string;
  password_hash: string | null;
  password_salt: string | null;
  updated_at: string;
  username: string | null;
};

type ProfileRow = {
  current_room_id: string;
  user_id: string;
};

type AvatarSelectionRow = {
  avatar_id: string;
  room_id: string;
  user_id: string;
};

type SessionRow = {
  created_at: string;
  expires_at?: string | null;
  id: string;
  last_seen_at: string;
  user_id: string;
};

type MessageRow = {
  author: string;
  avatar_id: string | null;
  created_at: string | null;
  id: string;
  is_mine: number;
  room_id: string;
  text: string;
  time_label: string;
  tone: ChatMessage["tone"];
  user_id: string | null;
};

const dataDirectory = path.join(process.cwd(), ".data");
const databasePath = path.join(dataDirectory, "kokoroe-dev.sqlite");
const stateKey = "kokoroe";
const globalSqliteStore = globalThis as typeof globalThis & {
  __kokoroeSqliteDb?: SqliteDatabase;
  __kokoroeSqliteState?: StoreState;
};

async function getDatabase() {
  if (globalSqliteStore.__kokoroeSqliteDb) {
    return globalSqliteStore.__kokoroeSqliteDb;
  }

  mkdirSync(dataDirectory, { recursive: true });

  const { DatabaseSync } = await import("node:sqlite") as { DatabaseSync: DatabaseSyncConstructor };
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS store_meta (
      key TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      counter INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      email TEXT,
      username TEXT,
      password_hash TEXT,
      password_salt TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
      ON users(email)
      WHERE email IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
      ON users(username)
      WHERE username IS NOT NULL;

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      current_room_id TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_avatar_selections (
      user_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      avatar_id TEXT NOT NULL,
      PRIMARY KEY(user_id, room_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      avatar_id TEXT,
      user_id TEXT,
      author TEXT NOT NULL,
      text TEXT NOT NULL,
      tone TEXT NOT NULL,
      time_label TEXT NOT NULL,
      created_at TEXT,
      is_mine INTEGER NOT NULL DEFAULT 0
    );
  `);

  try {
    database.exec("ALTER TABLE sessions ADD COLUMN expires_at TEXT");
  } catch {
  }

  globalSqliteStore.__kokoroeSqliteDb = database;
  return database;
}

function getSnapshotState(database: SqliteDatabase) {
  try {
    const row = database.prepare("SELECT state_json FROM app_state WHERE key = ?").get(stateKey) as
      | { state_json?: unknown }
      | undefined;

    if (typeof row?.state_json === "string") {
      return JSON.parse(row.state_json) as StoreState;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function toNullable(value: string | undefined) {
  return value ?? null;
}

function writeSqliteStateSync(database: SqliteDatabase, store: StoreState) {
  database.exec("BEGIN IMMEDIATE");

  try {
    database.prepare("DELETE FROM user_avatar_selections").run();
    database.prepare("DELETE FROM user_profiles").run();
    database.prepare("DELETE FROM sessions").run();
    database.prepare("DELETE FROM messages").run();
    database.prepare("DELETE FROM users").run();
    database.prepare("DELETE FROM store_meta").run();

    database
      .prepare("INSERT INTO store_meta (key, version, counter) VALUES (?, ?, ?)")
      .run(stateKey, store.version, store.counter);

    const insertUser = database.prepare(`
      INSERT INTO users (
        id,
        display_name,
        email,
        username,
        password_hash,
        password_salt,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertProfile = database.prepare(`
      INSERT INTO user_profiles (user_id, current_room_id)
      VALUES (?, ?)
    `);
    const insertAvatarSelection = database.prepare(`
      INSERT INTO user_avatar_selections (user_id, room_id, avatar_id)
      VALUES (?, ?, ?)
    `);

    for (const user of store.users) {
      insertUser.run(
        user.id,
        user.displayName,
        toNullable(user.email),
        toNullable(user.username),
        toNullable(user.passwordHash),
        toNullable(user.passwordSalt),
        user.createdAt,
        user.updatedAt,
      );
      insertProfile.run(user.id, user.profile.currentRoomId);

      for (const [roomId, avatarId] of Object.entries(user.profile.selectedAvatarIds)) {
        insertAvatarSelection.run(user.id, roomId, avatarId);
      }
    }

    const insertSession = database.prepare(`
      INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const session of store.sessions) {
      insertSession.run(session.id, session.userId, session.createdAt, session.expiresAt, session.lastSeenAt);
    }

    const insertMessage = database.prepare(`
      INSERT INTO messages (
        id,
        room_id,
        avatar_id,
        user_id,
        author,
        text,
        tone,
        time_label,
        created_at,
        is_mine
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const message of store.messages) {
      insertMessage.run(
        message.id,
        message.roomId,
        toNullable(message.avatarId),
        toNullable(message.userId),
        message.author,
        message.text,
        message.tone,
        message.time,
        toNullable(message.createdAt),
        message.mine ? 1 : 0,
      );
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function readSqliteStateSync(database: SqliteDatabase) {
  const meta = database.prepare("SELECT version, counter FROM store_meta WHERE key = ?").get(stateKey) as
    | MetaRow
    | undefined;

  if (!meta) {
    const snapshotState = getSnapshotState(database);
    const seedStore = snapshotState ?? createSeedStore();
    writeSqliteStateSync(database, seedStore);
    return seedStore;
  }

  const users = database.prepare("SELECT * FROM users ORDER BY created_at ASC, id ASC").all() as UserRow[];
  const profiles = database.prepare("SELECT * FROM user_profiles").all() as ProfileRow[];
  const avatarSelections = database.prepare("SELECT * FROM user_avatar_selections").all() as AvatarSelectionRow[];
  const sessions = database.prepare("SELECT * FROM sessions ORDER BY created_at ASC, id ASC").all() as SessionRow[];
  const messages = database.prepare("SELECT * FROM messages ORDER BY rowid ASC").all() as MessageRow[];
  const profilesByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const avatarSelectionsByUserId = new Map<string, Record<string, string>>();

  for (const selection of avatarSelections) {
    const currentSelections = avatarSelectionsByUserId.get(selection.user_id) ?? {};
    currentSelections[selection.room_id] = selection.avatar_id;
    avatarSelectionsByUserId.set(selection.user_id, currentSelections);
  }

  return {
    version: meta.version as StoreState["version"],
    counter: meta.counter,
    users: users.map((user): KokoroeUser => ({
      id: user.id,
      displayName: user.display_name,
      email: user.email ?? undefined,
      passwordHash: user.password_hash ?? undefined,
      passwordSalt: user.password_salt ?? undefined,
      profile: {
        currentRoomId: profilesByUserId.get(user.id)?.current_room_id ?? "",
        selectedAvatarIds: avatarSelectionsByUserId.get(user.id) ?? {},
      },
      username: user.username ?? undefined,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      userId: session.user_id,
      createdAt: session.created_at,
      expiresAt: session.expires_at ?? "",
      lastSeenAt: session.last_seen_at,
    })),
    messages: messages.map((message): ChatMessage => ({
      id: message.id,
      roomId: message.room_id,
      avatarId: message.avatar_id ?? undefined,
      userId: message.user_id ?? undefined,
      author: message.author,
      text: message.text,
      tone: message.tone,
      time: message.time_label,
      createdAt: message.created_at ?? undefined,
      mine: message.is_mine === 1,
    })),
  };
}

async function readSqliteState() {
  return readSqliteStateSync(await getDatabase());
}

async function writeSqliteState(store: StoreState) {
  writeSqliteStateSync(await getDatabase(), store);
}

export function createSqliteStoreAdapter(): KokoroeStoreAdapter {
  return {
    async getState() {
      globalSqliteStore.__kokoroeSqliteState ??= await readSqliteState();
      return globalSqliteStore.__kokoroeSqliteState;
    },
    async saveState(store) {
      globalSqliteStore.__kokoroeSqliteState = store;
      await writeSqliteState(store);
    },
  };
}
