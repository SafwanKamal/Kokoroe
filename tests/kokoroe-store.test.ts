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
    const roomsPayload = await store.getRoomsPayload();
    const room = roomsPayload.rooms.find((candidateRoom) => candidateRoom.id === "quiet-alley");

    expect(room).toBeDefined();
    await store.joinRoom({
      roomId: "quiet-alley",
      sessionId: account.session.id,
    });

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
    const roomsPayload = await store.getRoomsPayload();
    const avatar = roomsPayload.avatarsByRoom["ramen-stand"][0];

    await store.joinRoom({
      roomId: "ramen-stand",
      sessionId: account.session.id,
    });

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

    const roomMessages = await store.getMessages("ramen-stand", account.session.id);
    expect(roomMessages.status).toBe(200);
    expect("messages" in roomMessages ? roomMessages.messages : []).toContainEqual(result.message);
  });

  it("requires room membership before reading or sending in a room", async () => {
    const store = await loadStoreModule();
    const account = await createTestAccount(store, "room-access");
    const roomsPayload = await store.getRoomsPayload();
    const avatar = roomsPayload.avatarsByRoom["ramen-stand"][0];

    const rejectedMessage = await store.createMessage({
      avatarId: avatar.id,
      roomId: "ramen-stand",
      sessionId: account.session.id,
      text: "Trying to enter without joining.",
      tone: "plain",
    });
    const rejectedRead = await store.getMessages("ramen-stand", account.session.id);

    expect(rejectedMessage.status).toBe(403);
    expect("error" in rejectedMessage ? rejectedMessage.error : "").toMatch(/join/i);
    expect(rejectedRead.status).toBe(403);

    const joined = await store.joinRoom({
      roomId: "ramen-stand",
      sessionId: account.session.id,
    });

    expect(joined.status).toBe(200);

    if ("error" in joined) {
      throw new Error(joined.error);
    }

    expect(joined.membersByRoom["ramen-stand"].map((member) => member.id)).toContain(account.user.id);
    expect(joined.profile.currentRoomId).toBe("ramen-stand");
  });

  it("marks messages as mine only for the viewing account", async () => {
    const store = await loadStoreModule();
    const author = await createTestAccount(store, "mine-author");
    const viewer = await createTestAccount(store, "mine-viewer");
    const roomsPayload = await store.getRoomsPayload();
    const avatar = roomsPayload.avatarsByRoom["after-school"][0];

    const sent = await store.createMessage({
      avatarId: avatar.id,
      roomId: "after-school",
      sessionId: author.session.id,
      text: "Side depends on viewer.",
      tone: "plain",
    });

    expect(sent.status).toBe(201);

    if ("error" in sent) {
      throw new Error(sent.error);
    }

    const authorRead = await store.getMessages("after-school", author.session.id);
    const viewerRead = await store.getMessages("after-school", viewer.session.id);

    expect(authorRead.status).toBe(200);
    expect(viewerRead.status).toBe(200);

    if ("error" in authorRead) {
      throw new Error(authorRead.error);
    }

    if ("error" in viewerRead) {
      throw new Error(viewerRead.error);
    }

    expect(authorRead.messages.find((message) => message.id === sent.message.id)?.mine).toBe(true);
    expect(viewerRead.messages.find((message) => message.id === sent.message.id)?.mine).toBe(false);
  });

  it("regenerates seed messages with cast account ownership", async () => {
    const store = await loadStoreModule();
    const viewer = await createTestAccount(store, "legacy-mine");
    const messages = await store.getMessages("after-school", viewer.session.id);

    expect(messages.status).toBe(200);

    if ("error" in messages) {
      throw new Error(messages.error);
    }

    const seedMessage = messages.messages.find((message) => message.id === "m1");
    expect(seedMessage?.userId).toBe("seed-account-skybell-hina");
    expect(seedMessage?.mine).toBe(false);
  });

  it("adds existing accounts as room members without creating sendable avatars", async () => {
    const store = await loadStoreModule();
    const account = await createTestAccount(store, "member-adder");
    const invited = await createTestAccount(store, "member-invited");
    const added = await store.createRoomMember({
      accountIdentifier: invited.user.email,
      roomId: "quiet-alley",
      sessionId: account.session.id,
    });

    expect(added.status).toBe(201);

    if ("error" in added) {
      throw new Error(added.error);
    }

    expect(added.account.id).toBe(invited.user.id);
    expect(added.membersByRoom["quiet-alley"].map((member) => member.id)).toContain(invited.user.id);

    await store.joinRoom({
      roomId: "quiet-alley",
      sessionId: account.session.id,
    });

    const message = await store.createMessage({
      avatarId: invited.user.id,
      roomId: "quiet-alley",
      sessionId: account.session.id,
      text: "Trying to speak as another account.",
      tone: "plain",
    });

    expect(message.status).toBe(404);
    expect("error" in message ? message.error : "").toMatch(/unknown avatar/i);
  });

  it("recommends matching accounts that are not already room members", async () => {
    const store = await loadStoreModule();
    const account = await createTestAccount(store, "search-owner");
    const invited = await createTestAccount(store, "search-target");

    const searchResult = await store.searchAccounts({
      query: "target",
      roomId: "quiet-alley",
      sessionId: account.session.id,
    });

    expect(searchResult.status).toBe(200);

    if ("error" in searchResult) {
      throw new Error(searchResult.error);
    }

    expect(searchResult.accounts.map((candidate) => candidate.id)).toContain(invited.user.id);

    await store.createRoomMember({
      accountIdentifier: invited.user.email,
      roomId: "quiet-alley",
      sessionId: account.session.id,
    });

    const afterAddSearch = await store.searchAccounts({
      query: invited.user.email,
      roomId: "quiet-alley",
      sessionId: account.session.id,
    });

    expect(afterAddSearch.status).toBe(200);

    if ("error" in afterAddSearch) {
      throw new Error(afterAddSearch.error);
    }

    expect(afterAddSearch.accounts.map((candidate) => candidate.id)).not.toContain(invited.user.id);
  });
});
