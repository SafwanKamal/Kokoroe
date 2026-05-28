import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { startingMessages } from "../chat-data";
import type { KokoroeStoreAdapter, StoreState } from "./types";

const dataDirectory = path.join(process.cwd(), ".data");
const storePath = path.join(dataDirectory, "kokoroe-dev-store.json");
const globalStore = globalThis as typeof globalThis & {
  __kokoroeStore?: StoreState;
  __kokoroeWriteQueue?: Promise<void>;
};

function createSeedStore(): StoreState {
  return {
    version: 1,
    counter: 0,
    users: [],
    sessions: [],
    messages: [...startingMessages],
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function persistJsonStore(store: StoreState) {
  const payload = `${JSON.stringify(store, null, 2)}\n`;
  const tempPath = `${storePath}.tmp`;

  globalStore.__kokoroeWriteQueue = (globalStore.__kokoroeWriteQueue ?? Promise.resolve()).then(async () => {
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(tempPath, payload, "utf8");
    await rename(tempPath, storePath);
  });

  await globalStore.__kokoroeWriteQueue;
}

async function readJsonStore() {
  try {
    const rawStore = await readFile(storePath, "utf8");
    return JSON.parse(rawStore) as StoreState;
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }

    const seedStore = createSeedStore();
    await persistJsonStore(seedStore);
    return seedStore;
  }
}

export function createJsonStoreAdapter(): KokoroeStoreAdapter {
  return {
    async getState() {
      globalStore.__kokoroeStore ??= await readJsonStore();
      return globalStore.__kokoroeStore;
    },
    async saveState(store) {
      globalStore.__kokoroeStore = store;
      await persistJsonStore(store);
    },
  };
}
