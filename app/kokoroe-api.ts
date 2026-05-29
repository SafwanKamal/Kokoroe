import type { ChatMessage } from "./chat-data";
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
  const payload = (await response.json()) as T & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error ?? "Kokoroe API request failed.");
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

export async function fetchRoomMessages(roomId: string) {
  const response = await fetch(`/api/messages?roomId=${encodeURIComponent(roomId)}`);
  const payload = await readApiJson<MessagesResponse>(response);
  return payload.messages;
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

export async function postRoomMessage(payload: MessageCreatePayload) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await readApiJson<MessageCreateResponse>(response);
  return result.message;
}
