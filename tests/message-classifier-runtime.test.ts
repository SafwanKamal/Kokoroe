import { afterEach, describe, expect, it } from "vitest";
import {
  getMessageClassifierPublicPolicy,
  getMessageClassifierRuntimeConfig,
  selectMessagePresentation,
} from "../app/message-classifier-runtime";

const originalClassifierMode = process.env.KOKOROE_MESSAGE_CLASSIFIER;
const originalClassifierModel = process.env.KOKOROE_CLASSIFIER_MODEL;
const originalContextStrategy = process.env.KOKOROE_CLASSIFIER_CONTEXT;
const originalClassifierProvider = process.env.KOKOROE_CLASSIFIER_PROVIDER;
const originalCanaryRooms = process.env.KOKOROE_CLASSIFIER_CANARY_ROOMS;

const conversationMessages = [
  { authorKey: "other-user", text: "The smoke is getting thicker." },
  { authorKey: "current-user", text: "Move toward the stairs." },
];

afterEach(() => {
  if (originalClassifierMode === undefined) {
    delete process.env.KOKOROE_MESSAGE_CLASSIFIER;
  } else {
    process.env.KOKOROE_MESSAGE_CLASSIFIER = originalClassifierMode;
  }

  if (originalClassifierModel === undefined) {
    delete process.env.KOKOROE_CLASSIFIER_MODEL;
  } else {
    process.env.KOKOROE_CLASSIFIER_MODEL = originalClassifierModel;
  }

  if (originalContextStrategy === undefined) {
    delete process.env.KOKOROE_CLASSIFIER_CONTEXT;
  } else {
    process.env.KOKOROE_CLASSIFIER_CONTEXT = originalContextStrategy;
  }

  if (originalClassifierProvider === undefined) {
    delete process.env.KOKOROE_CLASSIFIER_PROVIDER;
  } else {
    process.env.KOKOROE_CLASSIFIER_PROVIDER = originalClassifierProvider;
  }

  if (originalCanaryRooms === undefined) {
    delete process.env.KOKOROE_CLASSIFIER_CANARY_ROOMS;
  } else {
    process.env.KOKOROE_CLASSIFIER_CANARY_ROOMS = originalCanaryRooms;
  }
});

describe("message classifier runtime configuration", () => {
  it("keeps automatic classification off with recent context by default", () => {
    expect(getMessageClassifierRuntimeConfig({})).toEqual({
      canaryRoomIds: [],
      contextStrategy: "recent-messages",
      mode: "off",
      model: "openai/gpt-oss-20b",
      provider: "gateway",
    });
  });

  it("enables only explicit rollout and context modes", () => {
    expect(getMessageClassifierRuntimeConfig({
      KOKOROE_MESSAGE_CLASSIFIER: "global-cloud",
      KOKOROE_CLASSIFIER_MODEL: "mistral/ministral-3b",
      KOKOROE_CLASSIFIER_CONTEXT: "discussion-compaction",
    })).toEqual({
      canaryRoomIds: [],
      contextStrategy: "discussion-compaction",
      mode: "global-cloud",
      model: "mistral/ministral-3b",
      provider: "gateway",
    });

    expect(getMessageClassifierRuntimeConfig({
      KOKOROE_MESSAGE_CLASSIFIER: "true",
      KOKOROE_CLASSIFIER_CONTEXT: "anything",
    })).toEqual({
      canaryRoomIds: [],
      contextStrategy: "recent-messages",
      mode: "off",
      model: "openai/gpt-oss-20b",
      provider: "gateway",
    });
  });

  it("selects OpenRouter only explicitly and applies its fixed free default", () => {
    expect(getMessageClassifierRuntimeConfig({
      KOKOROE_CLASSIFIER_PROVIDER: "openrouter",
    })).toEqual({
      canaryRoomIds: [],
      contextStrategy: "recent-messages",
      mode: "off",
      model: "tencent/hy3:free",
      provider: "openrouter",
    });
  });

  it("publishes only the consent-relevant room policy", () => {
    expect(getMessageClassifierPublicPolicy({
      KOKOROE_MESSAGE_CLASSIFIER: "global-cloud",
      KOKOROE_CLASSIFIER_CONTEXT: "discussion-compaction",
      KOKOROE_CLASSIFIER_CANARY_ROOMS: " after-school,quiet-alley,after-school ",
    })).toEqual({
      canaryRoomIds: ["after-school", "quiet-alley"],
      contextStrategy: "discussion-compaction",
      discussionSourceMessageLimit: 40,
      discussionTailMessageLimit: 4,
      enabled: true,
      recentMessageLimit: 8,
    });
  });
});

describe("selectMessagePresentation", () => {
  it("preserves the requested presentation while rollout is off", async () => {
    delete process.env.KOKOROE_MESSAGE_CLASSIFIER;

    await expect(selectMessagePresentation({
      cloudClassificationConsent: true,
      conversationMessages,
      roomId: "after-school",
      text: "Keep this quiet.",
      targetAuthorKey: "current-user",
      requestedPresentationId: "whisper",
    }, {
      createClassifier: () => {
        throw new Error("disabled rollout must not create a cloud classifier");
      },
    })).resolves.toBe("whisper");
  });

  it("does not call the provider without explicit consent or outside the canary", async () => {
    const environment = {
      KOKOROE_MESSAGE_CLASSIFIER: "global-cloud",
      KOKOROE_CLASSIFIER_CANARY_ROOMS: "after-school",
    };
    const createClassifier = () => {
      throw new Error("the cloud classifier must stay behind both gates");
    };

    await expect(selectMessagePresentation({
      cloudClassificationConsent: false,
      conversationMessages,
      roomId: "after-school",
      text: "Keep this quiet.",
      targetAuthorKey: "current-user",
      requestedPresentationId: "whisper",
    }, { createClassifier, environment })).resolves.toBe("whisper");

    await expect(selectMessagePresentation({
      cloudClassificationConsent: true,
      conversationMessages,
      roomId: "quiet-alley",
      text: "Keep this quiet.",
      targetAuthorKey: "current-user",
      requestedPresentationId: "whisper",
    }, { createClassifier, environment })).resolves.toBe("whisper");
  });

  it("uses pseudonymized recent context when explicitly enabled", async () => {
    process.env.KOKOROE_MESSAGE_CLASSIFIER = "global-cloud";
    process.env.KOKOROE_CLASSIFIER_CANARY_ROOMS = "after-school";
    process.env.KOKOROE_CLASSIFIER_MODEL = "test/global-model";
    let observedOptions: { model: string; provider: "gateway" | "openrouter" } | undefined;

    const presentationId = await selectMessagePresentation({
      cloudClassificationConsent: true,
      conversationMessages,
      roomId: "after-school",
      text: "EVERYONE, RUN!",
      targetAuthorKey: "current-user",
      requestedPresentationId: "plain",
    }, {
      createClassifier: (options) => {
        observedOptions = options;
        return async (input) => {
          expect(input.context).toEqual({
            strategy: "recent-messages",
            recentTurns: [
              { speaker: "participant-1", text: conversationMessages[0]?.text },
              { speaker: "target-speaker", text: conversationMessages[1]?.text },
            ],
          });
          return { presentationId: "shout", confidence: 0.95 };
        };
      },
    });

    expect(presentationId).toBe("shout");
    expect(observedOptions).toEqual({ model: "test/global-model", provider: "gateway" });
  });

  it("degrades to plain when the enabled provider fails", async () => {
    process.env.KOKOROE_MESSAGE_CLASSIFIER = "global-cloud";
    process.env.KOKOROE_CLASSIFIER_CANARY_ROOMS = "after-school";

    await expect(selectMessagePresentation({
      cloudClassificationConsent: true,
      conversationMessages,
      roomId: "after-school",
      text: "Original words stay here.",
      targetAuthorKey: "current-user",
      requestedPresentationId: "grandiose",
    }, {
      createClassifier: () => async () => {
        throw new Error("cloud unavailable");
      },
    })).resolves.toBe("plain");
  });

  it("degrades to plain when provider configuration cannot create a classifier", async () => {
    process.env.KOKOROE_MESSAGE_CLASSIFIER = "global-cloud";
    process.env.KOKOROE_CLASSIFIER_CANARY_ROOMS = "after-school";

    await expect(selectMessagePresentation({
      cloudClassificationConsent: true,
      conversationMessages,
      roomId: "after-school",
      text: "Original words stay here.",
      targetAuthorKey: "current-user",
      requestedPresentationId: "grandiose",
    }, {
      createClassifier: () => {
        throw new Error("missing provider configuration");
      },
    })).resolves.toBe("plain");
  });

  it("can compact separate discussions before contextual classification", async () => {
    process.env.KOKOROE_MESSAGE_CLASSIFIER = "global-cloud";
    process.env.KOKOROE_CLASSIFIER_CONTEXT = "discussion-compaction";
    process.env.KOKOROE_CLASSIFIER_CANARY_ROOMS = "after-school";

    await expect(selectMessagePresentation({
      cloudClassificationConsent: true,
      conversationMessages,
      roomId: "after-school",
      text: "Leave her chair there.",
      targetAuthorKey: "current-user",
      requestedPresentationId: "plain",
    }, {
      createDiscussionCompactor: () => async () => ({
        discussions: [{
          id: "memorial-dinner",
          summary: "The group is discussing a memorial place setting.",
          participantSpeakers: ["target-speaker", "participant-1"],
          relevantToTarget: true,
        }],
      }),
      createClassifier: () => async (input) => {
        expect(input.context.strategy).toBe("discussion-compaction");
        expect(input.context.discussions?.[0]?.id).toBe("memorial-dinner");
        return { presentationId: "sad", confidence: 0.94 };
      },
    })).resolves.toBe("sad");
  });
});
