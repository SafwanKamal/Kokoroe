import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  avatarsByRoom,
  rooms,
  type ChatMessage,
} from "./chat-data";
import {
  MESSAGE_CHARACTER_LIMIT,
  messagePresentations,
  resolvePresentationId,
  type MessagePresentationId,
} from "./message-presentations";
import { createJsonStoreAdapter } from "./stores/json-store";
import { createSqliteStoreAdapter } from "./stores/sqlite-store";
import { createSupabaseStoreAdapter } from "./stores/supabase-store";
import type {
  KokoroeProfile,
  KokoroePublicUser,
  KokoroeSession,
  KokoroeUser,
  StoreState,
} from "./stores/types";
export type {
  KokoroeProfile,
  KokoroePublicUser,
  KokoroeSession,
  KokoroeUser,
} from "./stores/types";

type MessageCreateInput = {
  avatarId?: unknown;
  roomId?: unknown;
  sessionId?: unknown;
  text?: unknown;
  tone?: unknown;
};

type DevLoginInput = {
  displayName?: unknown;
  password?: unknown;
  username?: unknown;
  usernameOrEmail?: unknown;
};

type ProfileUpdateInput = {
  currentRoomId?: unknown;
  selectedAvatarIds?: unknown;
  sessionId?: unknown;
};

const hashLength = 64;
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 30;
const scrypt = promisify(scryptCallback);
const storeAdapter = process.env.KOKOROE_STORE === "supabase"
  ? createSupabaseStoreAdapter()
  : process.env.KOKOROE_STORE === "sqlite"
    ? createSqliteStoreAdapter()
    : createJsonStoreAdapter();

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

function isPresentationId(value: unknown): value is MessagePresentationId {
  return typeof value === "string" && value in messagePresentations;
}

function findRoom(roomId: unknown) {
  if (typeof roomId !== "string") {
    return undefined;
  }

  return rooms.find((candidateRoom) => candidateRoom.id === roomId);
}

function findAvatar(roomId: string, avatarId: unknown) {
  if (typeof avatarId !== "string") {
    return undefined;
  }

  return avatarsByRoom[roomId]?.find((candidateAvatar) => candidateAvatar.id === avatarId);
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

function getCredentialIdentifier(input: DevLoginInput) {
  const rawIdentifier = input.usernameOrEmail ?? input.username ?? input.displayName;

  if (typeof rawIdentifier !== "string" || !rawIdentifier.trim()) {
    return undefined;
  }

  return rawIdentifier.trim().toLowerCase();
}

function getPassword(input: DevLoginInput) {
  if (typeof input.password !== "string") {
    return undefined;
  }

  return input.password;
}

function getUserHandle(identifier: string) {
  return identifier.includes("@") ? identifier.split("@")[0] : identifier;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hashBuffer = (await scrypt(password, salt, hashLength)) as Buffer;
  return {
    passwordHash: hashBuffer.toString("hex"),
    passwordSalt: salt,
  };
}

async function verifyPassword(password: string, passwordHash: string, passwordSalt: string) {
  const expected = Buffer.from(passwordHash, "hex");
  const actual = (await scrypt(password, passwordSalt, expected.length)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getSessionExpiresAt(createdAt: string) {
  const createdTime = Date.parse(createdAt);
  const baseTime = Number.isFinite(createdTime) ? createdTime : Date.now();
  return new Date(baseTime + sessionLifetimeMs).toISOString();
}

function isSessionExpired(session: KokoroeSession, now = Date.now()) {
  const expiresTime = Date.parse(session.expiresAt);
  return Number.isFinite(expiresTime) && expiresTime <= now;
}

function pruneExpiredSessions(store: StoreState, now = Date.now()) {
  const activeSessions = store.sessions.filter((session) => !isSessionExpired(session, now));

  if (activeSessions.length === store.sessions.length) {
    return false;
  }

  store.sessions = activeSessions;
  return true;
}

async function getStore() {
  const store = await storeAdapter.getState();
  let didMigrate = false;

  for (const user of store.users) {
    if (!(user as Partial<KokoroeUser>).profile) {
      user.profile = createDefaultProfile();
      didMigrate = true;
    }
  }

  for (const session of store.sessions) {
    if (!(session as Partial<KokoroeSession>).expiresAt) {
      session.expiresAt = getSessionExpiresAt(session.createdAt);
      didMigrate = true;
    }
  }

  if (didMigrate) {
    await saveStore(store);
  }

  return store;
}

async function saveStore(store: StoreState) {
  await storeAdapter.saveState(store);
}

async function persistNewAccount(store: StoreState, user: KokoroeUser, session: KokoroeSession) {
  if (storeAdapter.insertUserWithSession) {
    await storeAdapter.insertUserWithSession(store, user, session);
    return;
  }

  await saveStore(store);
}

async function persistLoginSession(store: StoreState, user: KokoroeUser, session: KokoroeSession) {
  if (storeAdapter.insertSession) {
    await storeAdapter.insertSession(store, user, session);
    return;
  }

  await saveStore(store);
}

async function persistSessions(store: StoreState) {
  if (storeAdapter.replaceSessions) {
    await storeAdapter.replaceSessions(store);
    return;
  }

  await saveStore(store);
}

async function persistSessionTouch(store: StoreState, session: KokoroeSession) {
  if (storeAdapter.updateSession) {
    await storeAdapter.updateSession(store, session);
    return;
  }

  await saveStore(store);
}

async function persistProfile(store: StoreState, user: KokoroeUser, session: KokoroeSession) {
  if (storeAdapter.updateUserProfile) {
    await storeAdapter.updateUserProfile(store, user, session);
    return;
  }

  await saveStore(store);
}

async function persistMessage(
  store: StoreState,
  user: KokoroeUser,
  session: KokoroeSession,
  message: ChatMessage,
) {
  if (storeAdapter.insertMessage) {
    await storeAdapter.insertMessage(store, user, session, message);
    return;
  }

  await saveStore(store);
}

function findUserByCredential(store: StoreState, identifier: string) {
  const normalizedIdentifier = identifier.toLowerCase();

  return store.users.find((user) => (
    user.username?.toLowerCase() === normalizedIdentifier ||
    user.email?.toLowerCase() === normalizedIdentifier ||
    user.displayName.toLowerCase() === normalizedIdentifier
  ));
}

function createSession(userId: string): KokoroeSession {
  const now = new Date();

  return {
    id: `session-${randomUUID()}`,
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + sessionLifetimeMs).toISOString(),
    lastSeenAt: now.toISOString(),
  };
}

async function getSessionUser(sessionId: unknown) {
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return { error: "sessionId is required.", status: 400 } as const;
  }

  const store = await getStore();
  const normalizedSessionId = sessionId.trim();
  const session = store.sessions.find((candidateSession) => candidateSession.id === normalizedSessionId);

  if (!session) {
    return { error: "Session not found.", status: 404 } as const;
  }

  if (isSessionExpired(session)) {
    store.sessions = store.sessions.filter((candidateSession) => candidateSession.id !== normalizedSessionId);
    await persistSessions(store);
    return { error: "Session expired. Log in again.", status: 401 } as const;
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

export function getPublicUser(user: KokoroeUser): KokoroePublicUser {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...publicUser } = user;
  return publicUser;
}

export async function getMessages(roomId?: string) {
  const messages = (await getStore()).messages;

  if (!roomId) {
    return { messages, status: 200 } as const;
  }

  const room = findRoom(roomId);

  if (!room) {
    return { error: `Unknown room "${roomId}".`, status: 404 } as const;
  }

  return { messages: messages.filter((message) => message.roomId === room.id), status: 200 } as const;
}

export async function createDevSession(input: DevLoginInput) {
  const now = new Date().toISOString();
  const identifier = getCredentialIdentifier(input);
  const password = getPassword(input);

  if (!identifier) {
    return { error: "Username or email is required.", status: 400 } as const;
  }

  if (!password) {
    return { error: "Password is required.", status: 400 } as const;
  }

  const store = await getStore();
  const user = findUserByCredential(store, identifier);

  if (!user || !user.passwordHash || !user.passwordSalt) {
    return { error: "Account not found. Create an account first.", status: 404 } as const;
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash, user.passwordSalt);

  if (!isPasswordValid) {
    return { error: "Password is incorrect.", status: 401 } as const;
  }

  user.updatedAt = now;
  const session = createSession(user.id);
  store.sessions.push(session);
  await persistLoginSession(store, user, session);

  return { user, session, status: 201 } as const;
}

export async function createAccount(input: DevLoginInput) {
  const now = new Date().toISOString();
  const identifier = getCredentialIdentifier(input);
  const password = getPassword(input);

  if (!identifier) {
    return { error: "Username or email is required.", status: 400 } as const;
  }

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters.", status: 400 } as const;
  }

  const store = await getStore();
  const existingUser = findUserByCredential(store, identifier);

  if (existingUser) {
    return { error: "That account already exists. Log in instead.", status: 409 } as const;
  }

  const passwordFields = await hashPassword(password);
  const displayName = getLoginName({
    ...input,
    displayName: typeof input.displayName === "string" && input.displayName.trim()
      ? input.displayName
      : getUserHandle(identifier),
  });
  const user: KokoroeUser = {
    id: `user-${randomUUID()}`,
    displayName,
    email: identifier.includes("@") ? identifier : undefined,
    passwordHash: passwordFields.passwordHash,
    passwordSalt: passwordFields.passwordSalt,
    profile: createDefaultProfile(),
    username: identifier.includes("@") ? getUserHandle(identifier) : identifier,
    createdAt: now,
    updatedAt: now,
  };
  const session = createSession(user.id);

  store.users.push(user);
  store.sessions.push(session);
  await persistNewAccount(store, user, session);

  return { user, session, status: 201 } as const;
}

export async function getDevSession(sessionId: unknown) {
  const result = await getSessionUser(sessionId);

  if ("error" in result) {
    return result;
  }

  const { session, store, user } = result;
  session.lastSeenAt = new Date().toISOString();
  await persistSessionTouch(store, session);

  return { user, session, status: 200 } as const;
}

export async function destroyDevSession(sessionId: unknown) {
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return { status: 204 } as const;
  }

  const store = await getStore();
  const didPrune = pruneExpiredSessions(store);
  const nextSessions = store.sessions.filter((session) => session.id !== sessionId.trim());

  if (nextSessions.length === store.sessions.length && !didPrune) {
    return { status: 204 } as const;
  }

  store.sessions = nextSessions;
  await persistSessions(store);

  return { status: 204 } as const;
}

export async function updateProfile(input: ProfileUpdateInput) {
  const result = await getSessionUser(input.sessionId);

  if (result.status !== 200) {
    return result;
  }

  const { session, store, user } = result;
  const now = new Date().toISOString();
  const nextProfile: KokoroeProfile = {
    currentRoomId: user.profile.currentRoomId,
    selectedAvatarIds: { ...user.profile.selectedAvatarIds },
  };

  if (typeof input.currentRoomId === "string") {
    const room = findRoom(input.currentRoomId);

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

      const room = findRoom(roomId);

      if (!room) {
        return { error: `Unknown room "${roomId}".`, status: 404 } as const;
      }

      const avatar = findAvatar(room.id, avatarId);

      if (!avatar) {
        return { error: `Unknown avatar "${avatarId}" for room "${room.id}".`, status: 404 } as const;
      }

      nextProfile.selectedAvatarIds[room.id] = avatar.id;
    }
  }

  user.profile = nextProfile;
  user.updatedAt = now;
  session.lastSeenAt = now;
  await persistProfile(store, user, session);

  return { profile: user.profile, user, status: 200 } as const;
}

export async function createMessage(input: MessageCreateInput) {
  const sessionResult = await getSessionUser(input.sessionId);

  if (sessionResult.status !== 200) {
    return sessionResult;
  }

  if (typeof input.roomId !== "string") {
    return { error: "roomId is required.", status: 400 } as const;
  }

  const room = findRoom(input.roomId);

  if (!room) {
    return { error: `Unknown room "${input.roomId}".`, status: 404 } as const;
  }

  const selectedAvatarId = typeof input.avatarId === "string" ? input.avatarId : sessionResult.user.profile.selectedAvatarIds[room.id];
  const avatar = findAvatar(room.id, selectedAvatarId);

  if (!selectedAvatarId) {
    return { error: `No avatar is selected for room "${room.id}".`, status: 400 } as const;
  }

  if (!avatar) {
    return { error: `Unknown avatar "${selectedAvatarId}" for room "${room.id}".`, status: 404 } as const;
  }

  if (typeof input.text !== "string" || !input.text.trim()) {
    return { error: "text is required.", status: 400 } as const;
  }

  const text = input.text.trim();

  if (text.length > MESSAGE_CHARACTER_LIMIT) {
    return { error: `text must be ${MESSAGE_CHARACTER_LIMIT} characters or fewer.`, status: 400 } as const;
  }

  const requestedTone = isPresentationId(input.tone) ? input.tone : "plain";
  const { store, user } = sessionResult;
  const now = new Date();

  user.profile.currentRoomId = room.id;
  user.profile.selectedAvatarIds[room.id] = avatar.id;
  user.updatedAt = now.toISOString();
  sessionResult.session.lastSeenAt = now.toISOString();
  store.counter += 1;

  const message: ChatMessage = {
    id: `${room.id}-${Date.now().toString(36)}-${store.counter}`,
    roomId: room.id,
    avatarId: avatar.id,
    userId: user.id,
    author: avatar.name,
    text,
    tone: resolvePresentationId(text, requestedTone),
    time: formatMessageTime(now),
    createdAt: now.toISOString(),
    mine: true,
  };

  store.messages.push(message);
  await persistMessage(store, user, sessionResult.session, message);

  return { message, status: 201 } as const;
}
