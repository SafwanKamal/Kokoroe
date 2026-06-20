import type { ChatMessage } from "../chat-data";
import { createSeedStore } from "./seed";
import type { KokoroeSession, KokoroeStoreAdapter, KokoroeUser, RoomMembership, StoreState } from "./types";

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
  expires_at: string;
  id: string;
  last_seen_at: string;
  user_id: string;
};

type MessageRow = {
  author: string;
  avatar_id: string | null;
  created_at: string | null;
  id: string;
  is_mine: boolean;
  room_id: string;
  text: string;
  time_label: string;
  tone: ChatMessage["tone"];
  user_id: string | null;
};

type RoomMembershipRow = {
  added_by_user_id: string | null;
  created_at: string;
  room_id: string;
  user_id: string;
};

const stateKey = "kokoroe";
const membershipMessagePrefix = "__kokoroe_room_membership__";
const globalSupabaseStore = globalThis as typeof globalThis & {
  __kokoroeSupabaseState?: StoreState;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("KOKOROE_STORE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return {
    restUrl: `${url.replace(/\/$/, "")}/rest/v1`,
    serviceRoleKey,
  };
}

function getHeaders() {
  const { serviceRoleKey } = getSupabaseConfig();

  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
}

async function requestSupabase<T>(path: string, init: RequestInit = {}) {
  const { restUrl } = getSupabaseConfig();
  const response = await fetch(`${restUrl}/${path}`, {
    ...init,
    headers: {
      ...getHeaders(),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${message}`);
  }

  const text = await response.text();

  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function isMissingRoomMembershipsTable(error: unknown) {
  return error instanceof Error &&
    error.message.includes("room_memberships") &&
    (error.message.includes("PGRST205") || error.message.includes("Could not find the table"));
}

function toNullable(value: string | undefined) {
  return value ?? null;
}

function toTimestamp(value: string | undefined) {
  return value ?? null;
}

async function selectRows<T>(path: string) {
  return requestSupabase<T[]>(path);
}

async function selectRoomMembershipRows() {
  try {
    return await selectRows<RoomMembershipRow>("room_memberships?select=*&order=created_at.asc,room_id.asc,user_id.asc");
  } catch (error) {
    if (isMissingRoomMembershipsTable(error)) {
      return undefined;
    }

    throw error;
  }
}

async function deleteRows(table: string, filter: string) {
  await requestSupabase(`${table}?${filter}`, {
    method: "DELETE",
    headers: { prefer: "return=minimal" },
  });
}

async function deleteRoomMembershipRows() {
  try {
    await deleteRows("room_memberships", "room_id=not.is.null");
    return true;
  } catch (error) {
    if (isMissingRoomMembershipsTable(error)) {
      return false;
    }

    throw error;
  }
}

async function insertRows<T extends Record<string, unknown>>(table: string, rows: T[]) {
  if (rows.length === 0) {
    return;
  }

  await requestSupabase(table, {
    method: "POST",
    body: JSON.stringify(rows),
    headers: { prefer: "return=minimal" },
  });
}

async function upsertRows<T extends Record<string, unknown>>(table: string, rows: T[], onConflict?: string) {
  if (rows.length === 0) {
    return;
  }

  const path = onConflict ? `${table}?on_conflict=${encodeURIComponent(onConflict)}` : table;

  await requestSupabase(path, {
    method: "POST",
    body: JSON.stringify(rows),
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
  });
}

async function updateRows<T extends Record<string, unknown>>(table: string, filter: string, values: T) {
  await requestSupabase(`${table}?${filter}`, {
    method: "PATCH",
    body: JSON.stringify(values),
    headers: { prefer: "return=minimal" },
  });
}

function toMetaRow(store: StoreState) {
  return {
    key: stateKey,
    version: store.version,
    counter: store.counter,
  };
}

function toUserRow(user: KokoroeUser) {
  return {
    id: user.id,
    display_name: user.displayName,
    email: toNullable(user.email),
    username: toNullable(user.username),
    password_hash: toNullable(user.passwordHash),
    password_salt: toNullable(user.passwordSalt),
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

function toProfileRow(user: KokoroeUser) {
  return {
    user_id: user.id,
    current_room_id: user.profile.currentRoomId,
  };
}

function toAvatarSelectionRows(user: KokoroeUser) {
  return Object.entries(user.profile.selectedAvatarIds).map(([roomId, avatarId]) => ({
    user_id: user.id,
    room_id: roomId,
    avatar_id: avatarId,
  }));
}

function toSessionRow(session: KokoroeSession) {
  return {
    id: session.id,
    user_id: session.userId,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
    last_seen_at: session.lastSeenAt,
  };
}

function toMessageRow(message: ChatMessage) {
  return {
    id: message.id,
    room_id: message.roomId,
    avatar_id: toNullable(message.avatarId),
    user_id: toNullable(message.userId),
    author: message.author,
    text: message.text,
    tone: message.tone,
    time_label: message.time,
    created_at: toTimestamp(message.createdAt),
    is_mine: message.mine ?? false,
  };
}

function toRoomMembershipRow(membership: RoomMembership) {
  return {
    room_id: membership.roomId,
    user_id: membership.userId,
    added_by_user_id: toNullable(membership.addedByUserId),
    created_at: membership.createdAt,
  };
}

function getMembershipMessageId(membership: RoomMembership) {
  return `${membershipMessagePrefix}:${membership.roomId}:${membership.userId}`;
}

function isMembershipMessage(message: MessageRow) {
  return message.id.startsWith(`${membershipMessagePrefix}:`) && message.text === membershipMessagePrefix;
}

function toRoomMembershipMessageRow(membership: RoomMembership) {
  return {
    id: getMembershipMessageId(membership),
    room_id: membership.roomId,
    avatar_id: null,
    user_id: membership.userId,
    author: membership.addedByUserId ?? "kokoroe",
    text: membershipMessagePrefix,
    tone: "plain",
    time_label: "",
    created_at: membership.createdAt,
    is_mine: false,
  };
}

function getRoomMembershipsFromMessages(messages: MessageRow[]) {
  return messages
    .filter(isMembershipMessage)
    .map((message): RoomMembership => ({
      addedByUserId: message.author === "kokoroe" ? undefined : message.author,
      createdAt: message.created_at ?? new Date(0).toISOString(),
      roomId: message.room_id,
      userId: message.user_id ?? "",
    }))
    .filter((membership) => membership.userId);
}

async function saveRoomMembershipRows(store: StoreState) {
  try {
    await upsertRows("room_memberships", store.roomMemberships.map(toRoomMembershipRow), "room_id,user_id");
    return;
  } catch (error) {
    if (!isMissingRoomMembershipsTable(error)) {
      throw error;
    }
  }

  await upsertRows("messages", store.roomMemberships.map(toRoomMembershipMessageRow), "id");
}

async function saveProfileRows(user: KokoroeUser) {
  await upsertRows("users", [toUserRow(user)]);
  await upsertRows("user_profiles", [toProfileRow(user)]);
  await upsertRows("user_avatar_selections", toAvatarSelectionRows(user), "user_id,room_id");
}

async function ensureSeedState() {
  const seedStore = createSeedStore();
  await writeSupabaseState(seedStore);
  return seedStore;
}

async function readSupabaseState(): Promise<StoreState> {
  const [metaRows, users, profiles, avatarSelections, sessions, messages, roomMemberships] = await Promise.all([
    selectRows<MetaRow>(`store_meta?select=version,counter&key=eq.${stateKey}`),
    selectRows<UserRow>("users?select=*&order=created_at.asc,id.asc"),
    selectRows<ProfileRow>("user_profiles?select=*"),
    selectRows<AvatarSelectionRow>("user_avatar_selections?select=*"),
    selectRows<SessionRow>("sessions?select=*&order=created_at.asc,id.asc"),
    selectRows<MessageRow>("messages?select=*&order=created_at.asc.nullsfirst,id.asc"),
    selectRoomMembershipRows(),
  ]);
  const meta = metaRows[0];

  if (!meta) {
    return ensureSeedState();
  }

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
    roomMembers: {},
    roomMemberships: roomMemberships ? roomMemberships.map((membership): RoomMembership => ({
      addedByUserId: membership.added_by_user_id ?? undefined,
      createdAt: membership.created_at,
      roomId: membership.room_id,
      userId: membership.user_id,
    })) : getRoomMembershipsFromMessages(messages),
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
      expiresAt: session.expires_at,
      lastSeenAt: session.last_seen_at,
    })),
    messages: messages.filter((message) => !isMembershipMessage(message)).map((message): ChatMessage => ({
      id: message.id,
      roomId: message.room_id,
      avatarId: message.avatar_id ?? undefined,
      userId: message.user_id ?? undefined,
      author: message.author,
      text: message.text,
      tone: message.tone,
      time: message.time_label,
      createdAt: message.created_at ?? undefined,
      mine: message.is_mine,
    })),
  };
}

async function writeSupabaseState(store: StoreState) {
  await deleteRows("user_avatar_selections", "user_id=not.is.null");
  await deleteRows("user_profiles", "user_id=not.is.null");
  await deleteRows("sessions", "id=not.is.null");
  await deleteRows("messages", "id=not.is.null");
  const hasRoomMembershipsTable = await deleteRoomMembershipRows();
  await deleteRows("users", "id=not.is.null");
  await deleteRows("store_meta", "key=not.is.null");

  await upsertRows("store_meta", [toMetaRow(store)]);

  await insertRows("users", store.users.map(toUserRow));

  await insertRows("user_profiles", store.users.map(toProfileRow));

  await insertRows(
    "user_avatar_selections",
    store.users.flatMap(toAvatarSelectionRows),
  );

  await insertRows("sessions", store.sessions.map(toSessionRow));

  await insertRows(
    "messages",
    hasRoomMembershipsTable
      ? store.messages.map(toMessageRow)
      : [...store.messages.map(toMessageRow), ...store.roomMemberships.map(toRoomMembershipMessageRow)],
  );

  if (hasRoomMembershipsTable) {
    await insertRows("room_memberships", store.roomMemberships.map(toRoomMembershipRow));
  }
}

export function createSupabaseStoreAdapter(): KokoroeStoreAdapter {
  return {
    async getState() {
      globalSupabaseStore.__kokoroeSupabaseState ??= await readSupabaseState();
      return globalSupabaseStore.__kokoroeSupabaseState;
    },
    async saveState(store) {
      globalSupabaseStore.__kokoroeSupabaseState = store;
      await writeSupabaseState(store);
    },
    async insertUserWithSession(store, user, session) {
      globalSupabaseStore.__kokoroeSupabaseState = store;
      await upsertRows("store_meta", [toMetaRow(store)]);
      await insertRows("users", [toUserRow(user)]);
      await insertRows("user_profiles", [toProfileRow(user)]);
      await insertRows("user_avatar_selections", toAvatarSelectionRows(user));
      await insertRows("sessions", [toSessionRow(session)]);
      await saveRoomMembershipRows(store);
    },
    async insertSession(store, user, session) {
      globalSupabaseStore.__kokoroeSupabaseState = store;
      await updateRows("users", `id=eq.${encodeURIComponent(user.id)}`, { updated_at: user.updatedAt });
      await insertRows("sessions", [toSessionRow(session)]);
    },
    async replaceSessions(store) {
      globalSupabaseStore.__kokoroeSupabaseState = store;
      await deleteRows("sessions", "id=not.is.null");
      await insertRows("sessions", store.sessions.map(toSessionRow));
    },
    async updateSession(store, session) {
      globalSupabaseStore.__kokoroeSupabaseState = store;
      await updateRows("sessions", `id=eq.${encodeURIComponent(session.id)}`, {
        expires_at: session.expiresAt,
        last_seen_at: session.lastSeenAt,
      });
    },
    async updateUserProfile(store, user, session) {
      globalSupabaseStore.__kokoroeSupabaseState = store;
      await saveProfileRows(user);
      await updateRows("sessions", `id=eq.${encodeURIComponent(session.id)}`, {
        last_seen_at: session.lastSeenAt,
      });
    },
    async insertMessage(store, user, session, message) {
      globalSupabaseStore.__kokoroeSupabaseState = store;
      await upsertRows("store_meta", [toMetaRow(store)]);
      await saveProfileRows(user);
      await updateRows("sessions", `id=eq.${encodeURIComponent(session.id)}`, {
        last_seen_at: session.lastSeenAt,
      });
      await insertRows("messages", [toMessageRow(message)]);
    },
  };
}
