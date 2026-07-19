import type {
  MessageClassificationContext,
  MessageClassificationContextTurn,
  MessageClassificationDiscussion,
} from "./message-classifier";

export const DEFAULT_RECENT_CONTEXT_TURN_LIMIT = 8;
export const DISCUSSION_SOURCE_TURN_LIMIT = 40;
export const DISCUSSION_CONTEXT_TAIL_LIMIT = 4;
export const MAX_DISCUSSION_COUNT = 6;
export const MAX_DISCUSSION_SUMMARY_LENGTH = 320;

export type ConversationContextMessage = Readonly<{
  authorKey: string;
  text: string;
}>;

export type MessageDiscussionCompactor = (input: Readonly<{
  recentTurns: readonly MessageClassificationContextTurn[];
  targetSpeaker: string;
  targetText: string;
}>) => Promise<unknown>;

function validateTurnLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("Conversation context turn limit must be a positive integer.");
  }
}

export function buildRecentMessageContext(
  messages: readonly ConversationContextMessage[],
  targetAuthorKey: string,
  limit = DEFAULT_RECENT_CONTEXT_TURN_LIMIT,
): MessageClassificationContext {
  validateTurnLimit(limit);

  const selectedMessages = messages
    .filter((message) => message.text.trim().length > 0)
    .slice(-limit);
  const participantLabels = new Map<string, string>();

  const recentTurns = selectedMessages.map((message) => {
    if (message.authorKey === targetAuthorKey) {
      return { speaker: "target-speaker", text: message.text };
    }

    let speaker = participantLabels.get(message.authorKey);

    if (!speaker) {
      speaker = `participant-${participantLabels.size + 1}`;
      participantLabels.set(message.authorKey, speaker);
    }

    return { speaker, text: message.text };
  });

  return {
    strategy: "recent-messages",
    recentTurns,
  };
}

function isValidDiscussion(value: unknown): value is MessageClassificationDiscussion {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    typeof candidate.summary === "string" &&
    candidate.summary.trim().length > 0 &&
    candidate.summary.length <= MAX_DISCUSSION_SUMMARY_LENGTH &&
    Array.isArray(candidate.participantSpeakers) &&
    candidate.participantSpeakers.length > 0 &&
    candidate.participantSpeakers.every((speaker) => typeof speaker === "string" && speaker.length > 0) &&
    typeof candidate.relevantToTarget === "boolean"
  );
}

export function normalizeDiscussionCompactionOutput(output: unknown) {
  if (!output || typeof output !== "object") {
    throw new TypeError("Discussion compaction output must be an object.");
  }

  const discussions = (output as Record<string, unknown>).discussions;

  if (
    !Array.isArray(discussions) ||
    discussions.length === 0 ||
    discussions.length > MAX_DISCUSSION_COUNT ||
    !discussions.every(isValidDiscussion)
  ) {
    throw new TypeError("Discussion compaction output contains invalid discussions.");
  }

  return discussions.map((discussion) => ({
    id: discussion.id.trim(),
    summary: discussion.summary.trim(),
    participantSpeakers: [...discussion.participantSpeakers],
    relevantToTarget: discussion.relevantToTarget,
  })) satisfies MessageClassificationDiscussion[];
}

export async function buildDiscussionCompactionContext(
  recentContext: MessageClassificationContext,
  targetText: string,
  compactor: MessageDiscussionCompactor,
): Promise<MessageClassificationContext> {
  if (recentContext.recentTurns.length === 0) {
    return recentContext;
  }

  try {
    const output = await compactor({
      recentTurns: recentContext.recentTurns,
      targetSpeaker: "target-speaker",
      targetText,
    });
    const discussions = normalizeDiscussionCompactionOutput(output);

    return {
      strategy: "discussion-compaction",
      recentTurns: recentContext.recentTurns.slice(-DISCUSSION_CONTEXT_TAIL_LIMIT),
      discussions,
    };
  } catch {
    return recentContext;
  }
}
