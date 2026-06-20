import type { Avatar, ChatMessage, Room } from "./chat-data";
import type { KokoroeProfile, KokoroePublicUser, KokoroeSession } from "./kokoroe-store";
import type { MessagePresentationId } from "./message-presentations";

type ApiErrorPayload = {
  error?: string;
};

type LoginPayload = {
  displayName?: string;
  password?: string;
  usernameOrEmail?: string;
};

type LoginResponse = {
  mode: "development";
  user: KokoroePublicUser;
  session: KokoroeSession;
};

type CurrentSessionResponse = ({ authenticated: true } & LoginResponse) | { authenticated: false };

type ProfileResponse = {
  profile: KokoroeProfile;
  user?: KokoroePublicUser;
};

type MessagesResponse = {
  messages: ChatMessage[];
};

type RoomsResponse = {
  avatarsByRoom: Record<string, Avatar[]>;
  membersByRoom: Record<string, KokoroePublicUser[]>;
  rooms: Room[];
};

type RoomJoinPayload = {
  roomId: string;
  sessionId?: string;
};

type RoomJoinResponse = {
  membersByRoom: Record<string, KokoroePublicUser[]>;
  profile: KokoroeProfile;
};

type MemberCreatePayload = {
  accountIdentifier: string;
  roomId: string;
  sessionId?: string;
};

type MemberCreateResponse = {
  account: KokoroePublicUser;
  membersByRoom: Record<string, KokoroePublicUser[]>;
};

type MemberSearchResponse = {
  accounts: KokoroePublicUser[];
};

type MessageCreatePayload = {
  avatarId: string;
  roomId: string;
  sessionId?: string;
  text: string;
  tone: MessagePresentationId;
};

type MessageCreateResponse = {
  message: ChatMessage;
};

type ProfilePatchPayload = {
  currentRoomId?: string;
  selectedAvatarIds?: Record<string, string>;
  sessionId: string;
};

async function readApiJson<T>(response: Response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) as T & ApiErrorPayload : {} as T & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error ?? `Kokoroe API request failed with status ${response.status}.`);
  }

  return payload;
}

export async function createLoginSession(payload: LoginPayload) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  return readApiJson<LoginResponse>(response);
}

export async function createAccountSession(payload: LoginPayload) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  return readApiJson<LoginResponse>(response);
}

export async function fetchCurrentSession() {
  const response = await fetch("/api/auth/session");
  const result = await readApiJson<CurrentSessionResponse>(response);
  return result.authenticated ? result : null;
}

export async function logoutSession() {
  const response = await fetch("/api/auth/logout", { method: "POST" });

  if (!response.ok) {
    throw new Error("Logout failed.");
  }
}

export async function fetchRoomMessages(roomId: string, sessionId?: string) {
  const params = new URLSearchParams({ roomId });

  if (sessionId) {
    params.set("sessionId", sessionId);
  }

  const response = await fetch(`/api/messages?${params.toString()}`);
  const payload = await readApiJson<MessagesResponse>(response);
  return payload.messages;
}

export async function fetchRooms() {
  const response = await fetch("/api/rooms");
  return readApiJson<RoomsResponse>(response);
}

export async function fetchProfile(sessionId: string) {
  const response = await fetch(`/api/profile?sessionId=${encodeURIComponent(sessionId)}`);
  const payload = await readApiJson<ProfileResponse>(response);
  return payload.profile;
}

export async function patchProfile(payload: ProfilePatchPayload) {
  const response = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await readApiJson<ProfileResponse>(response);
  return result.profile;
}

export async function postRoomJoin(payload: RoomJoinPayload) {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readApiJson<RoomJoinResponse>(response);
}

export async function postRoomMessage(payload: MessageCreatePayload) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await readApiJson<MessageCreateResponse>(response);
  return result.message;
}

export async function postRoomMember(payload: MemberCreatePayload) {
  const response = await fetch("/api/members", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readApiJson<MemberCreateResponse>(response);
}

export async function searchRoomMemberAccounts(payload: { query: string; roomId: string; sessionId?: string }) {
  const params = new URLSearchParams({
    query: payload.query,
    roomId: payload.roomId,
  });

  if (payload.sessionId) {
    params.set("sessionId", payload.sessionId);
  }

  const response = await fetch(`/api/members?${params.toString()}`);
  const result = await readApiJson<MemberSearchResponse>(response);
  return result.accounts;
}
