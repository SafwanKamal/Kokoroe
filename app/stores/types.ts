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
};
