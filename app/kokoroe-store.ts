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
  text?: unknown;
  tone?: unknown;
};

type StoreState = {
  counter: number;
  messages: ChatMessage[];
};

const storeKey = Symbol.for("kokoroe.store");
const globalStore = globalThis as typeof globalThis & {
  [storeKey]?: StoreState;
};

function getStore() {
  globalStore[storeKey] ??= {
    counter: 0,
    messages: [...startingMessages],
  };

  return globalStore[storeKey];
}

function formatMessageTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isPresentationId(value: unknown): value is MessagePresentationId {
  return typeof value === "string" && value in messagePresentations;
}

export function getRoomsPayload() {
  return {
    rooms,
    avatarsByRoom,
  };
}

export function getMessages(roomId?: string) {
  const messages = getStore().messages;

  if (!roomId) {
    return messages;
  }

  return messages.filter((message) => message.roomId === roomId);
}

export function createMessage(input: MessageCreateInput) {
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
  const store = getStore();
  store.counter += 1;

  const message: ChatMessage = {
    id: `${room.id}-${Date.now().toString(36)}-${store.counter}`,
    roomId: room.id,
    avatarId: avatar.id,
    author: typeof input.author === "string" && input.author.trim() ? input.author.trim() : avatar.name,
    text,
    tone: resolvePresentationId(text, requestedTone),
    time: formatMessageTime(new Date()),
    mine: true,
  };

  store.messages.push(message);

  return { message, status: 201 } as const;
}
