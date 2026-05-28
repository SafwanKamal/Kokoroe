import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  avatarsByRoom,
  rooms,
  startingMessages,
  type ChatMessage,
} from "./chat-data";
import {
  MESSAGE_CHARACTER_LIMIT,
  messagePresentations,
  resolvePresentationId,
  type MessagePresentationId,
} from "./message-presentations";

type MessageCreateInput = {
  author?: unknown;
  avatarId?: unknown;
  roomId?: unknown;
  sessionId?: unknown;
  text?: unknown;
  tone?: unknown;
};

type DevLoginInput = {
  displayName?: unknown;
  username?: unknown;
  usernameOrEmail?: unknown;
};

type ProfileUpdateInput = {
  currentRoomId?: unknown;
  selectedAvatarIds?: unknown;
  sessionId?: unknown;
};

export type KokoroeProfile = {
  currentRoomId: string;
  selectedAvatarIds: Record<string, string>;
};

export type KokoroeUser = {
  id: string;
  displayName: string;
  profile: KokoroeProfile;
  createdAt: string;
  updatedAt: string;
};

export type KokoroeSession = {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
};

type StoreState = {
  version: 1;
  counter: number;
  users: KokoroeUser[];
  sessions: KokoroeSession[];
  messages: ChatMessage[];
};

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

function createDefaultProfile(): KokoroeProfile {
  return {
    currentRoomId: rooms[0].id,
    selectedAvatarIds: Object.fromEntries(
      rooms.map((room) => [room.id, avatarsByRoom[room.id]?.[0]?.id ?? ""]),
    ),
  };
}

function formatMessageTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isPresentationId(value: unknown): value is MessagePresentationId {
  return typeof value === "string" && value in messagePresentations;
}

function getLoginName(input: DevLoginInput) {
  const rawName = input.displayName ?? input.username ?? input.usernameOrEmail;

  if (typeof rawName !== "string") {
    return "Reader";
  }

  const trimmed = rawName.trim();

  if (!trimmed) {
    return "Reader";
  }

  return trimmed.slice(0, 40);
}

async function persistStore(store: StoreState) {
  const payload = `${JSON.stringify(store, null, 2)}\n`;
  const tempPath = `${storePath}.tmp`;

  globalStore.__kokoroeWriteQueue = (globalStore.__kokoroeWriteQueue ?? Promise.resolve()).then(async () => {
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(tempPath, payload, "utf8");
    await rename(tempPath, storePath);
  });

  await globalStore.__kokoroeWriteQueue;
}

async function readStoreFromDisk() {
  try {
    const rawStore = await readFile(storePath, "utf8");
    return JSON.parse(rawStore) as StoreState;
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }

    const seedStore = createSeedStore();
    await persistStore(seedStore);
    return seedStore;
  }
}

async function getStore() {
  globalStore.__kokoroeStore ??= await readStoreFromDisk();
  let didMigrate = false;

  for (const user of globalStore.__kokoroeStore.users) {
    if (!(user as Partial<KokoroeUser>).profile) {
      user.profile = createDefaultProfile();
      didMigrate = true;
    }
  }

  if (didMigrate) {
    await persistStore(globalStore.__kokoroeStore);
  }

  return globalStore.__kokoroeStore;
}

async function getSessionUser(sessionId: unknown) {
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return { error: "sessionId is required.", status: 400 } as const;
  }

  const store = await getStore();
  const session = store.sessions.find((candidateSession) => candidateSession.id === sessionId.trim());

  if (!session) {
    return { error: "Session not found.", status: 404 } as const;
  }

  const user = store.users.find((candidateUser) => candidateUser.id === session.userId);

  if (!user) {
    return { error: "Session user not found.", status: 404 } as const;
  }

  return { store, session, user, status: 200 } as const;
}

export function getRoomsPayload() {
  return {
    rooms,
    avatarsByRoom,
  };
}

export async function getMessages(roomId?: string) {
  const messages = (await getStore()).messages;

  if (!roomId) {
    return messages;
  }

  return messages.filter((message) => message.roomId === roomId);
}

export async function createDevSession(input: DevLoginInput) {
  const now = new Date().toISOString();
  const displayName = getLoginName(input);
  const store = await getStore();
  const existingUser = store.users.find((user) => user.displayName.toLowerCase() === displayName.toLowerCase());
  const user =
    existingUser ??
    ({
      id: `user-${randomUUID()}`,
      displayName,
      profile: createDefaultProfile(),
      createdAt: now,
      updatedAt: now,
    } satisfies KokoroeUser);

  if (existingUser) {
    existingUser.displayName = displayName;
    existingUser.updatedAt = now;
  } else {
    store.users.push(user);
  }

  const session: KokoroeSession = {
    id: `session-${randomUUID()}`,
    userId: user.id,
    createdAt: now,
    lastSeenAt: now,
  };

  store.sessions.push(session);
  await persistStore(store);

  return { user, session, status: 201 } as const;
}

export async function getDevSession(sessionId: unknown) {
  const result = await getSessionUser(sessionId);

  if ("error" in result) {
    return result;
  }

  const { session, store, user } = result;
  session.lastSeenAt = new Date().toISOString();
  await persistStore(store);

  return { user, session, status: 200 } as const;
}

export async function updateProfile(input: ProfileUpdateInput) {
  const result = await getSessionUser(input.sessionId);

  if (result.status !== 200) {
    return result;
  }

  const { store, user } = result;
  const nextProfile: KokoroeProfile = {
    currentRoomId: user.profile.currentRoomId,
    selectedAvatarIds: { ...user.profile.selectedAvatarIds },
  };

  if (typeof input.currentRoomId === "string") {
    const room = rooms.find((candidateRoom) => candidateRoom.id === input.currentRoomId);

    if (!room) {
      return { error: `Unknown room "${input.currentRoomId}".`, status: 404 } as const;
    }

    nextProfile.currentRoomId = room.id;
  }

  if (input.selectedAvatarIds && typeof input.selectedAvatarIds === "object" && !Array.isArray(input.selectedAvatarIds)) {
    for (const [roomId, avatarId] of Object.entries(input.selectedAvatarIds)) {
      if (typeof avatarId !== "string") {
        return { error: `Invalid avatar selection for room "${roomId}".`, status: 400 } as const;
      }

      const avatar = avatarsByRoom[roomId]?.find((candidateAvatar) => candidateAvatar.id === avatarId);

      if (!avatar) {
        return { error: `Unknown avatar "${avatarId}" for room "${roomId}".`, status: 404 } as const;
      }

      nextProfile.selectedAvatarIds[roomId] = avatar.id;
    }
  }

  user.profile = nextProfile;
  user.updatedAt = new Date().toISOString();
  await persistStore(store);

  return { profile: user.profile, user, status: 200 } as const;
}

export async function createMessage(input: MessageCreateInput) {
  if (typeof input.roomId !== "string") {
    return { error: "roomId is required.", status: 400 } as const;
  }

  const room = rooms.find((candidateRoom) => candidateRoom.id === input.roomId);

  if (!room) {
    return { error: `Unknown room "${input.roomId}".`, status: 404 } as const;
  }

  if (typeof input.avatarId !== "string") {
    return { error: "avatarId is required.", status: 400 } as const;
  }

  const avatar = avatarsByRoom[room.id]?.find((candidateAvatar) => candidateAvatar.id === input.avatarId);

  if (!avatar) {
    return { error: `Unknown avatar "${input.avatarId}" for room "${room.id}".`, status: 404 } as const;
  }

  if (typeof input.text !== "string" || !input.text.trim()) {
    return { error: "text is required.", status: 400 } as const;
  }

  const text = input.text.trim();

  if (text.length > MESSAGE_CHARACTER_LIMIT) {
    return { error: `text must be ${MESSAGE_CHARACTER_LIMIT} characters or fewer.`, status: 400 } as const;
  }

  const requestedTone = isPresentationId(input.tone) ? input.tone : "plain";
  const store = await getStore();
  const session =
    typeof input.sessionId === "string"
      ? store.sessions.find((candidateSession) => candidateSession.id === input.sessionId)
      : undefined;
  const sessionUser = session ? store.users.find((candidateUser) => candidateUser.id === session.userId) : undefined;
  store.counter += 1;

  const message: ChatMessage = {
    id: `${room.id}-${Date.now().toString(36)}-${store.counter}`,
    roomId: room.id,
    avatarId: avatar.id,
    author:
      typeof input.author === "string" && input.author.trim()
        ? input.author.trim()
        : sessionUser?.displayName ?? avatar.name,
    text,
    tone: resolvePresentationId(text, requestedTone),
    time: formatMessageTime(new Date()),
    mine: true,
  };

  store.messages.push(message);
  await persistStore(store);

  return { message, status: 201 } as const;
}
