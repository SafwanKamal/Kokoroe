import postgres from "postgres";
import type { ChatMessage } from "../chat-data";
import { createSeedStore } from "./seed";
import type { KokoroeStoreAdapter, KokoroeUser, StoreState } from "./types";

type SupabaseSql = ReturnType<typeof postgres>;

type MetaRow = {
  counter: number;
  version: number;
};

type UserRow = {
  created_at: Date | string;
  display_name: string;
  email: string | null;
  id: string;
  password_hash: string | null;
  password_salt: string | null;
  updated_at: Date | string;
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
  created_at: Date | string;
  expires_at: Date | string;
  id: string;
  last_seen_at: Date | string;
  user_id: string;
};

type MessageRow = {
  author: string;
  avatar_id: string | null;
  created_at: Date | string | null;
  id: string;
  is_mine: boolean;
  room_id: string;
  text: string;
  time_label: string;
  tone: ChatMessage["tone"];
  user_id: string | null;
};

const stateKey = "kokoroe";
const globalSupabaseStore = globalThis as typeof globalThis & {
  __kokoroeSupabaseSql?: SupabaseSql;
  __kokoroeSupabaseState?: StoreState;
};

function getDatabaseUrl() {
  return process.env.SUPABASE_DIRECT_URL ?? process.env.DATABASE_URL;
}

function getSql() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("KOKOROE_STORE=supabase requires SUPABASE_DIRECT_URL or DATABASE_URL.");
  }

  globalSupabaseStore.__kokoroeSupabaseSql ??= postgres(databaseUrl, {
    idle_timeout: 20,
    max: 3,
    prepare: false,
    ssl: "require",
  });

  return globalSupabaseStore.__kokoroeSupabaseSql;
}

function toIsoString(value: Date | string | null) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toNullable(value: string | undefined) {
  return value ?? null;
}

function toDateOrNull(value: string | undefined) {
  return value ? new Date(value) : null;
}

async function ensureSeedState(sql: SupabaseSql) {
  const seedStore = createSeedStore();
  await writeSupabaseState(sql, seedStore);
  return seedStore;
}

async function readSupabaseState(sql: SupabaseSql): Promise<StoreState> {
  const metaRows = await sql<MetaRow[]>`
    SELECT version, counter
    FROM store_meta
    WHERE key = ${stateKey}
  `;
  const meta = metaRows[0];

  if (!meta) {
    return ensureSeedState(sql);
  }

  const [users, profiles, avatarSelections, sessions, messages] = await Promise.all([
    sql<UserRow[]>`
      SELECT *
      FROM users
      ORDER BY created_at ASC, id ASC
    `,
    sql<ProfileRow[]>`
      SELECT *
      FROM user_profiles
    `,
    sql<AvatarSelectionRow[]>`
      SELECT *
      FROM user_avatar_selections
    `,
    sql<SessionRow[]>`
      SELECT *
      FROM sessions
      ORDER BY created_at ASC, id ASC
    `,
    sql<MessageRow[]>`
      SELECT *
      FROM messages
      ORDER BY created_at ASC NULLS FIRST, id ASC
    `,
  ]);
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
      createdAt: toIsoString(user.created_at) ?? "",
      updatedAt: toIsoString(user.updated_at) ?? "",
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      userId: session.user_id,
      createdAt: toIsoString(session.created_at) ?? "",
      expiresAt: toIsoString(session.expires_at) ?? "",
      lastSeenAt: toIsoString(session.last_seen_at) ?? "",
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
      createdAt: toIsoString(message.created_at),
      mine: message.is_mine,
    })),
  };
}

async function writeSupabaseState(sql: SupabaseSql, store: StoreState) {
  await sql.begin(async (transaction) => {
    await transaction`DELETE FROM user_avatar_selections`;
    await transaction`DELETE FROM user_profiles`;
    await transaction`DELETE FROM sessions`;
    await transaction`DELETE FROM messages`;
    await transaction`DELETE FROM users`;
    await transaction`DELETE FROM store_meta`;

    await transaction`
      INSERT INTO store_meta (key, version, counter)
      VALUES (${stateKey}, ${store.version}, ${store.counter})
    `;

    for (const user of store.users) {
      await transaction`
        INSERT INTO users (
          id,
          display_name,
          email,
          username,
          password_hash,
          password_salt,
          created_at,
          updated_at
        ) VALUES (
          ${user.id},
          ${user.displayName},
          ${toNullable(user.email)},
          ${toNullable(user.username)},
          ${toNullable(user.passwordHash)},
          ${toNullable(user.passwordSalt)},
          ${new Date(user.createdAt)},
          ${new Date(user.updatedAt)}
        )
      `;
      await transaction`
        INSERT INTO user_profiles (user_id, current_room_id)
        VALUES (${user.id}, ${user.profile.currentRoomId})
      `;

      for (const [roomId, avatarId] of Object.entries(user.profile.selectedAvatarIds)) {
        await transaction`
          INSERT INTO user_avatar_selections (user_id, room_id, avatar_id)
          VALUES (${user.id}, ${roomId}, ${avatarId})
        `;
      }
    }

    for (const session of store.sessions) {
      await transaction`
        INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at)
        VALUES (
          ${session.id},
          ${session.userId},
          ${new Date(session.createdAt)},
          ${new Date(session.expiresAt)},
          ${new Date(session.lastSeenAt)}
        )
      `;
    }

    for (const message of store.messages) {
      await transaction`
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
        ) VALUES (
          ${message.id},
          ${message.roomId},
          ${toNullable(message.avatarId)},
          ${toNullable(message.userId)},
          ${message.author},
          ${message.text},
          ${message.tone},
          ${message.time},
          ${toDateOrNull(message.createdAt)},
          ${message.mine ?? false}
        )
      `;
    }
  });
}

export function createSupabaseStoreAdapter(): KokoroeStoreAdapter {
  return {
    async getState() {
      globalSupabaseStore.__kokoroeSupabaseState ??= await readSupabaseState(getSql());
      return globalSupabaseStore.__kokoroeSupabaseState;
    },
    async saveState(store) {
      globalSupabaseStore.__kokoroeSupabaseState = store;
      await writeSupabaseState(getSql(), store);
    },
  };
}
