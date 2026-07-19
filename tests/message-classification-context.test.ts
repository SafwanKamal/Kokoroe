import { describe, expect, it } from "vitest";
import {
  buildDiscussionCompactionContext,
  buildRecentMessageContext,
  normalizeDiscussionCompactionOutput,
} from "../app/message-classification-context";

describe("recent message classification context", () => {
  it("keeps a bounded chronological tail and pseudonymizes account keys", () => {
    const messages = Array.from({ length: 10 }, (_, index) => ({
      authorKey: index % 2 === 0 ? "private-account-id" : "other-private-id",
      text: `turn-${index}`,
    }));
    const context = buildRecentMessageContext(messages, "private-account-id", 3);

    expect(context).toEqual({
      strategy: "recent-messages",
      recentTurns: [
        { speaker: "participant-1", text: "turn-7" },
        { speaker: "target-speaker", text: "turn-8" },
        { speaker: "participant-1", text: "turn-9" },
      ],
    });
    expect(JSON.stringify(context)).not.toContain("private-id");
    expect(JSON.stringify(context)).not.toContain("private-account-id");
  });

  it("rejects invalid context limits", () => {
    expect(() => buildRecentMessageContext([], "target", 0)).toThrow(RangeError);
  });
});

describe("discussion-compaction classification context", () => {
  const recentContext = buildRecentMessageContext([
    { authorKey: "other", text: "The train is late." },
    { authorKey: "target", text: "We still need dinner." },
    { authorKey: "other", text: "The ramen stand closes soon." },
    { authorKey: "target", text: "Check the platform again." },
    { authorKey: "other", text: "The board says twenty minutes." },
  ], "target", 8);

  it("normalizes bounded discussion summaries", () => {
    expect(normalizeDiscussionCompactionOutput({
      discussions: [{
        id: "train-delay",
        summary: " The group is tracking a train delay. ",
        participantSpeakers: ["target-speaker", "participant-1"],
        relevantToTarget: true,
      }],
    })).toEqual([{
      id: "train-delay",
      summary: "The group is tracking a train delay.",
      participantSpeakers: ["target-speaker", "participant-1"],
      relevantToTarget: true,
    }]);
  });

  it("creates a separate compacted branch and retains a recent tail", async () => {
    const context = await buildDiscussionCompactionContext(
      recentContext,
      "Of course it is.",
      async () => ({
        discussions: [
          {
            id: "dinner",
            summary: "The group is deciding whether they can still get dinner.",
            participantSpeakers: ["target-speaker", "participant-1"],
            relevantToTarget: false,
          },
          {
            id: "train-delay",
            summary: "The group is tracking a recurring train delay.",
            participantSpeakers: ["target-speaker", "participant-1"],
            relevantToTarget: true,
          },
        ],
      }),
    );

    expect(context.strategy).toBe("discussion-compaction");
    expect(context.discussions).toHaveLength(2);
    expect(context.recentTurns).toEqual(recentContext.recentTurns.slice(-4));
  });

  it("falls back to recent context when compaction is invalid", async () => {
    await expect(buildDiscussionCompactionContext(
      recentContext,
      "Of course it is.",
      async () => ({ discussions: [] }),
    )).resolves.toBe(recentContext);
  });
});
