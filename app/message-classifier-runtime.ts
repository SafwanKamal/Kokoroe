import {
  classifyMessage,
  type MessageClassificationContextStrategy,
  type MessageClassifier,
} from "./message-classifier";
import {
  buildDiscussionCompactionContext,
  buildRecentMessageContext,
  DEFAULT_RECENT_CONTEXT_TURN_LIMIT,
  DISCUSSION_CONTEXT_TAIL_LIMIT,
  DISCUSSION_SOURCE_TURN_LIMIT,
  type ConversationContextMessage,
  type MessageDiscussionCompactor,
} from "./message-classification-context";
import {
  createProviderMessageClassifier,
  createProviderMessageDiscussionCompactor,
  getDefaultMessageClassifierModel,
  type MessageClassifierProvider,
} from "./message-classifier-provider";
import {
  resolvePresentationId,
  type MessagePresentationId,
} from "./message-presentations";

export type MessageClassifierMode = "off" | "global-cloud";

type ClassifierEnvironment = Readonly<Record<string, string | undefined>>;

export type MessageClassifierRuntimeConfig = Readonly<{
  canaryRoomIds: readonly string[];
  contextStrategy: MessageClassificationContextStrategy;
  mode: MessageClassifierMode;
  model: string;
  provider: MessageClassifierProvider;
}>;

export type MessageClassifierPublicPolicy = Readonly<{
  canaryRoomIds: readonly string[];
  discussionSourceMessageLimit: number;
  discussionTailMessageLimit: number;
  contextStrategy: MessageClassificationContextStrategy;
  enabled: boolean;
  recentMessageLimit: number;
}>;

type SelectMessagePresentationInput = Readonly<{
  cloudClassificationConsent: boolean;
  conversationMessages: readonly ConversationContextMessage[];
  roomId: string;
  text: string;
  targetAuthorKey: string;
  requestedPresentationId: MessagePresentationId;
}>;

type RuntimeDependencies = Readonly<{
  createClassifier?: (options: {
    model: string;
    provider: MessageClassifierProvider;
  }) => MessageClassifier;
  createDiscussionCompactor?: (options: {
    model: string;
    provider: MessageClassifierProvider;
  }) => MessageDiscussionCompactor;
  environment?: ClassifierEnvironment;
}>;

function parseCanaryRoomIds(value: string | undefined) {
  return Array.from(new Set(
    (value ?? "")
      .split(",")
      .map((roomId) => roomId.trim())
      .filter(Boolean),
  ));
}

export function getMessageClassifierRuntimeConfig(
  environment: ClassifierEnvironment = process.env,
): MessageClassifierRuntimeConfig {
  const provider = environment.KOKOROE_CLASSIFIER_PROVIDER === "openrouter"
    ? "openrouter"
    : "gateway";

  return {
    canaryRoomIds: parseCanaryRoomIds(environment.KOKOROE_CLASSIFIER_CANARY_ROOMS),
    contextStrategy: environment.KOKOROE_CLASSIFIER_CONTEXT === "discussion-compaction"
      ? "discussion-compaction"
      : "recent-messages",
    mode: environment.KOKOROE_MESSAGE_CLASSIFIER === "global-cloud" ? "global-cloud" : "off",
    model: environment.KOKOROE_CLASSIFIER_MODEL?.trim() || getDefaultMessageClassifierModel(provider),
    provider,
  };
}

export function getMessageClassifierPublicPolicy(
  environment: ClassifierEnvironment = process.env,
): MessageClassifierPublicPolicy {
  const config = getMessageClassifierRuntimeConfig(environment);

  return {
    canaryRoomIds: config.canaryRoomIds,
    discussionSourceMessageLimit: DISCUSSION_SOURCE_TURN_LIMIT,
    discussionTailMessageLimit: DISCUSSION_CONTEXT_TAIL_LIMIT,
    contextStrategy: config.contextStrategy,
    enabled: config.mode === "global-cloud" && config.canaryRoomIds.length > 0,
    recentMessageLimit: DEFAULT_RECENT_CONTEXT_TURN_LIMIT,
  };
}

export async function selectMessagePresentation(
  input: SelectMessagePresentationInput,
  dependencies: RuntimeDependencies = {},
) {
  const config = getMessageClassifierRuntimeConfig(dependencies.environment);

  if (
    config.mode === "off" ||
    !input.cloudClassificationConsent ||
    !config.canaryRoomIds.includes(input.roomId)
  ) {
    return resolvePresentationId(input.text, input.requestedPresentationId);
  }

  try {
    const createClassifier = dependencies.createClassifier ?? createProviderMessageClassifier;
    const recentContext = buildRecentMessageContext(
      input.conversationMessages,
      input.targetAuthorKey,
      config.contextStrategy === "discussion-compaction"
        ? DISCUSSION_SOURCE_TURN_LIMIT
        : DEFAULT_RECENT_CONTEXT_TURN_LIMIT,
    );
    const context = config.contextStrategy === "discussion-compaction"
      ? await buildDiscussionCompactionContext(
          recentContext,
          input.text,
          (dependencies.createDiscussionCompactor ?? createProviderMessageDiscussionCompactor)({
            model: config.model,
            provider: config.provider,
          }),
        )
      : recentContext;
    const result = await classifyMessage(
      {
        context,
        speaker: "target-speaker",
        text: input.text,
      },
      createClassifier({ model: config.model, provider: config.provider }),
    );

    return result.presentationId;
  } catch {
    return "plain";
  }
}
