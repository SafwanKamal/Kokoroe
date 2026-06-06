import type { ChatMessage } from "../chat-data";

export type KokoroeProfile = {
  currentRoomId: string;
  selectedAvatarIds: Record<string, string>;
};

export type KokoroeUser = {
  id: string;
  displayName: string;
  email?: string;
  passwordHash?: string;
  passwordSalt?: string;
  profile: KokoroeProfile;
  username?: string;
  createdAt: string;
  updatedAt: string;
};

export type KokoroePublicUser = Omit<KokoroeUser, "passwordHash" | "passwordSalt">;

export type KokoroeSession = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
};

export type StoreState = {
  version: 1;
  counter: number;
  users: KokoroeUser[];
  sessions: KokoroeSession[];
  messages: ChatMessage[];
};

export type KokoroeStoreAdapter = {
  getState(): Promise<StoreState>;
  saveState(store: StoreState): Promise<void>;
  insertUserWithSession?(store: StoreState, user: KokoroeUser, session: KokoroeSession): Promise<void>;
  insertSession?(store: StoreState, user: KokoroeUser, session: KokoroeSession): Promise<void>;
  replaceSessions?(store: StoreState): Promise<void>;
  updateSession?(store: StoreState, session: KokoroeSession): Promise<void>;
  updateUserProfile?(store: StoreState, user: KokoroeUser, session: KokoroeSession): Promise<void>;
  insertMessage?(store: StoreState, user: KokoroeUser, session: KokoroeSession, message: ChatMessage): Promise<void>;
};
