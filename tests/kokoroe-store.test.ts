import { rm } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type KokoroeStoreModule = typeof import("../app/kokoroe-store");

const dataStorePath = path.join(process.cwd(), ".data", "kokoroe-dev-store.json");
const dataStoreTempPath = `${dataStorePath}.tmp`;

async function resetStore() {
  delete process.env.KOKOROE_STORE;
  vi.resetModules();

  const globalStore = globalThis as typeof globalThis & {
    __kokoroeStore?: unknown;
    __kokoroeWriteQueue?: Promise<void>;
  };

  delete globalStore.__kokoroeStore;
  delete globalStore.__kokoroeWriteQueue;
  await rm(dataStorePath, { force: true });
  await rm(dataStoreTempPath, { force: true });
}

async function loadStoreModule(): Promise<KokoroeStoreModule> {
  return import("../app/kokoroe-store");
}

async function createTestAccount(store: KokoroeStoreModule, suffix: string) {
  const result = await store.createAccount({
    displayName: `Reader ${suffix}`,
    password: "correct-password",
    usernameOrEmail: `reader-${suffix}@kokoroe.test`,
  });

  expect(result.status).toBe(201);

  if ("error" in result) {
    throw new Error(result.error);
  }

  return result;
}

describe("kokoroe store contract", () => {
  beforeEach(async () => {
    await resetStore();
  });

  it("creates credential-backed accounts and rejects duplicate identifiers", async () => {
    const store = await loadStoreModule();
    const first = await createTestAccount(store, "duplicate");
    const duplicate = await store.createAccount({
      displayName: "Reader Duplicate",
      password: "correct-password",
      usernameOrEmail: "reader-duplicate@kokoroe.test",
    });

    expect(first.user.email).toBe("reader-duplicate@kokoroe.test");
    expect(first.user.passwordHash).toBeDefined();
    expect(first.user.passwordSalt).toBeDefined();
    expect(duplicate.status).toBe(409);
    expect("error" in duplicate ? duplicate.error : "").toMatch(/already exists/i);
  });

  it("verifies login passwords and creates a session for valid credentials", async () => {
    const store = await loadStoreModule();
    await createTestAccount(store, "login");

    const rejected = await store.createDevSession({
      password: "wrong-password",
      usernameOrEmail: "reader-login@kokoroe.test",
    });
    const accepted = await store.createDevSession({
      password: "correct-password",
      usernameOrEmail: "reader-login@kokoroe.test",
    });

    expect(rejected.status).toBe(401);
    expect(accepted.status).toBe(201);

    if ("error" in accepted) {
      throw new Error(accepted.error);
    }

    const restored = await store.getDevSession(accepted.session.id);
    expect(restored.status).toBe(200);
  });

  it("persists world-scoped avatar memory on profile updates", async () => {
    const store = await loadStoreModule();
    const account = await createTestAccount(store, "profile");
    const roomsPayload = store.getRoomsPayload();
    const room = roomsPayload.rooms.find((candidateRoom) => candidateRoom.id === "quiet-alley");

    expect(room).toBeDefined();
    const avatar = roomsPayload.avatarsByRoom["quiet-alley"][1] ?? roomsPayload.avatarsByRoom["quiet-alley"][0];
    const updated = await store.updateProfile({
      currentRoomId: "quiet-alley",
      selectedAvatarIds: { "quiet-alley": avatar.id },
      sessionId: account.session.id,
    });

    expect(updated.status).toBe(200);

    if ("error" in updated) {
      throw new Error(updated.error);
    }

    expect(updated.profile.currentRoomId).toBe("quiet-alley");
    expect(updated.profile.selectedAvatarIds["quiet-alley"]).toBe(avatar.id);
    expect(updated.profile.selectedAvatarIds["after-school"]).toBe(
      roomsPayload.avatarsByRoom["after-school"][0].id,
    );
  });

  it("rejects message avatars that do not belong to the target room", async () => {
    const store = await loadStoreModule();
    const account = await createTestAccount(store, "wrong-avatar");
    const result = await store.createMessage({
      avatarId: "library-ink",
      roomId: "after-school",
      sessionId: account.session.id,
      text: "Wrong stage, wrong mask.",
      tone: "plain",
    });

    expect(result.status).toBe(404);
    expect("error" in result ? result.error : "").toMatch(/unknown avatar/i);
  });

  it("creates messages with validated room, avatar, text, and presentation", async () => {
    const store = await loadStoreModule();
    const account = await createTestAccount(store, "message");
    const roomsPayload = store.getRoomsPayload();
    const avatar = roomsPayload.avatarsByRoom["ramen-stand"][0];
    const result = await store.createMessage({
      avatarId: avatar.id,
      roomId: "ramen-stand",
      sessionId: account.session.id,
      text: "Extra garlic for the night shift.",
      tone: "plain",
    });

    expect(result.status).toBe(201);

    if ("error" in result) {
      throw new Error(result.error);
    }

    expect(result.message.roomId).toBe("ramen-stand");
    expect(result.message.avatarId).toBe(avatar.id);
    expect(result.message.author).toBe(avatar.name);
    expect(result.message.text).toBe("Extra garlic for the night shift.");
    expect(result.message.mine).toBe(true);

    const roomMessages = await store.getMessages("ramen-stand");
    expect(roomMessages.status).toBe(200);
    expect("messages" in roomMessages ? roomMessages.messages : []).toContainEqual(result.message);
  });
});
