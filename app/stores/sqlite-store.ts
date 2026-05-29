import { mkdirSync } from "node:fs";
import path from "node:path";
import { createSeedStore } from "./seed";
import type { KokoroeStoreAdapter, StoreState } from "./types";

type SqliteStatement = {
  get(...values: unknown[]): unknown;
  run(...values: unknown[]): void;
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
};

type DatabaseSyncConstructor = new (filename: string) => SqliteDatabase;

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
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  globalSqliteStore.__kokoroeSqliteDb = database;
  return database;
}

async function readSqliteState() {
  const database = await getDatabase();
  const row = database.prepare("SELECT state_json FROM app_state WHERE key = ?").get(stateKey) as
    | { state_json?: unknown }
    | undefined;

  if (typeof row?.state_json === "string") {
    return JSON.parse(row.state_json) as StoreState;
  }

  const seedStore = createSeedStore();
  await writeSqliteState(seedStore);
  return seedStore;
}

async function writeSqliteState(store: StoreState) {
  const database = await getDatabase();
  database
    .prepare(`
      INSERT INTO app_state (key, state_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `)
    .run(stateKey, JSON.stringify(store), new Date().toISOString());
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
