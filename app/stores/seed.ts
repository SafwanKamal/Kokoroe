import { initialAvatarSelections, startingMessages } from "../chat-data";
import type { KokoroeUser, RoomMembership, StoreState } from "./types";

const seedCreatedAt = "2026-01-01T00:00:00.000Z";

function getSeedAccountId(avatarId: string) {
  return `seed-account-${avatarId}`;
}

function getSeedUsername(avatarId: string) {
  return `cast-${avatarId}`;
}

export function getSeedCastUsers() {
  const usersByAvatar = new Map<string, KokoroeUser>();

  for (const message of startingMessages) {
    if (!message.avatarId || usersByAvatar.has(message.avatarId)) {
      continue;
    }

    usersByAvatar.set(message.avatarId, {
      id: getSeedAccountId(message.avatarId),
      displayName: `${message.author} Cast`,
      profile: {
        currentRoomId: message.roomId,
        selectedAvatarIds: {
          ...initialAvatarSelections,
          [message.roomId]: message.avatarId,
        },
      },
      username: getSeedUsername(message.avatarId),
      createdAt: seedCreatedAt,
      updatedAt: seedCreatedAt,
    });
  }

  return Array.from(usersByAvatar.values());
}

export function getSeedRoomMemberships() {
  const membershipsByRoomUser = new Map<string, RoomMembership>();

  for (const message of startingMessages) {
    if (!message.avatarId) {
      continue;
    }

    const membership: RoomMembership = {
      createdAt: seedCreatedAt,
      roomId: message.roomId,
      userId: getSeedAccountId(message.avatarId),
    };

    membershipsByRoomUser.set(`${membership.roomId}:${membership.userId}`, membership);
  }

  return Array.from(membershipsByRoomUser.values());
}

export function withSeedMessageAccounts(messages = startingMessages) {
  return messages.map((message) => (
    message.avatarId && message.id.startsWith("m")
      ? { ...message, userId: getSeedAccountId(message.avatarId) }
      : { ...message }
  ));
}

export function createSeedStore(): StoreState {
  return {
    version: 1,
    counter: 0,
    roomMembers: {},
    roomMemberships: getSeedRoomMemberships(),
    users: getSeedCastUsers(),
    sessions: [],
    messages: withSeedMessageAccounts(),
  };
}
