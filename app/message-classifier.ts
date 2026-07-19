import {
  isMessagePresentationId,
  resolvePresentationId,
  type MessagePresentationId,
} from "./message-presentations";

export const DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.7;
export const MAX_CLASSIFICATION_REASON_LENGTH = 160;

export type MessageClassificationContextStrategy =
  | "recent-messages"
  | "discussion-compaction";

export type MessageClassificationContextTurn = Readonly<{
  speaker: string;
  text: string;
}>;

export type MessageClassificationDiscussion = Readonly<{
  id: string;
  summary: string;
  participantSpeakers: readonly string[];
  relevantToTarget: boolean;
}>;

export type MessageClassificationContext = Readonly<{
  strategy: MessageClassificationContextStrategy;
  recentTurns: readonly MessageClassificationContextTurn[];
  discussions?: readonly MessageClassificationDiscussion[];
}>;

export type MessageClassificationInput = Readonly<{
  context: MessageClassificationContext;
  speaker: string;
  text: string;
}>;

export type MessageClassifierOutput = Readonly<{
  presentationId: MessagePresentationId;
  confidence: number;
  reason?: string;
}>;

export type MessageClassificationFallbackReason =
  | "invalid-output"
  | "insufficient-context"
  | "low-confidence"
  | "presentation-limit"
  | "provider-failure";

export type MessageClassificationResult = Readonly<{
  originalText: string;
  presentationId: MessagePresentationId;
  confidence: number;
  reason?: string;
  fallbackReason?: MessageClassificationFallbackReason;
}>;

export type MessageClassifier = (
  input: MessageClassificationInput,
) => Promise<unknown>;

function plainFallback(
  originalText: string,
  fallbackReason: MessageClassificationFallbackReason,
  confidence = 0,
): MessageClassificationResult {
  return {
    originalText,
    presentationId: "plain",
    confidence,
    fallbackReason,
  };
}

function isValidConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isValidReason(value: unknown): value is string | undefined {
  return value === undefined || (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_CLASSIFICATION_REASON_LENGTH
  );
}

export function normalizeMessageClassification(
  originalText: string,
  output: unknown,
  confidenceThreshold = DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD,
): MessageClassificationResult {
  if (!isValidConfidence(confidenceThreshold)) {
    throw new RangeError("Classification confidence threshold must be between 0 and 1.");
  }

  if (!output || typeof output !== "object") {
    return plainFallback(originalText, "invalid-output");
  }

  const candidate = output as Record<string, unknown>;

  if (
    !isMessagePresentationId(candidate.presentationId) ||
    !isValidConfidence(candidate.confidence) ||
    !isValidReason(candidate.reason)
  ) {
    return plainFallback(originalText, "invalid-output");
  }

  if (candidate.confidence < confidenceThreshold) {
    return plainFallback(originalText, "low-confidence", candidate.confidence);
  }

  const presentationId = resolvePresentationId(originalText, candidate.presentationId);

  if (presentationId === "plain" && candidate.presentationId !== "plain") {
    return plainFallback(originalText, "presentation-limit", candidate.confidence);
  }

  return {
    originalText,
    presentationId,
    confidence: candidate.confidence,
    ...(candidate.reason === undefined ? {} : { reason: candidate.reason.trim() }),
  };
}

export async function classifyMessage(
  input: MessageClassificationInput,
  classifier: MessageClassifier,
  confidenceThreshold = DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD,
): Promise<MessageClassificationResult> {
  if (
    input.context.recentTurns.length === 0 &&
    (input.context.discussions?.length ?? 0) === 0
  ) {
    return plainFallback(input.text, "insufficient-context");
  }

  let output: unknown;

  try {
    output = await classifier(input);
  } catch {
    return plainFallback(input.text, "provider-failure");
  }

  return normalizeMessageClassification(input.text, output, confidenceThreshold);
}
