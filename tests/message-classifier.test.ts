import { describe, expect, it } from "vitest";
import { messageClassificationEvaluationSet } from "../app/message-classification-evaluation";
import {
  classifyMessage,
  DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD,
  normalizeMessageClassification,
} from "../app/message-classifier";
import {
  isMessagePresentationId,
  messagePresentations,
} from "../app/message-presentations";

describe("message classification evaluation set", () => {
  it("contains contextual, contrastive, bounded labels for every presentation", () => {
    const ids = new Set<string>();
    const coveredPresentations = new Set<string>();
    const contrastGroups = new Map<string, Set<string>>();

    for (const evaluationCase of messageClassificationEvaluationSet) {
      expect(evaluationCase.id).not.toBe("");
      expect(ids.has(evaluationCase.id)).toBe(false);
      expect(evaluationCase.text).not.toBe("");
      expect(evaluationCase.context.length).toBeGreaterThan(0);
      expect(evaluationCase.speaker).toBe("target-speaker");
      expect(evaluationCase.notes).not.toBe("");
      expect(isMessagePresentationId(evaluationCase.expectedPresentationId)).toBe(true);
      expect(evaluationCase.text.length).toBeLessThanOrEqual(
        messagePresentations[evaluationCase.expectedPresentationId].maxCharacters,
      );

      ids.add(evaluationCase.id);
      coveredPresentations.add(evaluationCase.expectedPresentationId);

      if (evaluationCase.contrastGroup) {
        const labels = contrastGroups.get(evaluationCase.contrastGroup) ?? new Set<string>();
        labels.add(evaluationCase.expectedPresentationId);
        contrastGroups.set(evaluationCase.contrastGroup, labels);
      }
    }

    expect(coveredPresentations).toEqual(new Set(Object.keys(messagePresentations)));
    expect([...contrastGroups.values()].some((labels) => labels.size > 1)).toBe(true);
  });
});

describe("normalizeMessageClassification", () => {
  it.each(messageClassificationEvaluationSet)(
    "accepts the allow-listed $expectedPresentationId label for $id",
    (evaluationCase) => {
      const result = normalizeMessageClassification(evaluationCase.text, {
        presentationId: evaluationCase.expectedPresentationId,
        confidence: 0.9,
      });

      expect(result.presentationId).toBe(evaluationCase.expectedPresentationId);
      expect(result.originalText).toBe(evaluationCase.text);
      expect(result.fallbackReason).toBeUndefined();
    },
  );

  it("accepts an allow-listed presentation at the confidence threshold", () => {
    const originalText = "Keep this between us, okay?";
    const result = normalizeMessageClassification(originalText, {
      presentationId: "whisper",
      confidence: DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD,
      reason: "Private and cautious.",
    });

    expect(result).toEqual({
      originalText,
      presentationId: "whisper",
      confidence: DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD,
      reason: "Private and cautious.",
    });
  });

  it("falls back to plain below the confidence threshold", () => {
    const originalText = "Maybe tomorrow.";

    expect(normalizeMessageClassification(originalText, {
      presentationId: "sad",
      confidence: DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD - 0.01,
    })).toEqual({
      originalText,
      presentationId: "plain",
      confidence: DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD - 0.01,
      fallbackReason: "low-confidence",
    });
  });

  it.each([
    null,
    {},
    { presentationId: "rage", confidence: 0.99 },
    { presentationId: "shout", confidence: "high" },
    { presentationId: "shout", confidence: 1.1 },
    { presentationId: "shout", confidence: 0.9, reason: "" },
  ])("falls back to plain for malformed or non-allow-listed output", (output) => {
    const originalText = "Do not change this text.";

    expect(normalizeMessageClassification(originalText, output)).toEqual({
      originalText,
      presentationId: "plain",
      confidence: 0,
      fallbackReason: "invalid-output",
    });
  });

  it("falls back when a compact presentation cannot hold the original text", () => {
    const originalText = "This urgent message is deliberately longer than the shout shell allows.";

    expect(normalizeMessageClassification(originalText, {
      presentationId: "shout",
      confidence: 0.95,
    })).toEqual({
      originalText,
      presentationId: "plain",
      confidence: 0.95,
      fallbackReason: "presentation-limit",
    });
  });

  it("rejects an invalid configured threshold", () => {
    expect(() => normalizeMessageClassification("Hello", {
      presentationId: "plain",
      confidence: 1,
    }, 1.01)).toThrow(RangeError);
  });
});

describe("classifyMessage", () => {
  function contextualInput(text: string) {
    return {
      context: {
        strategy: "recent-messages" as const,
        recentTurns: [{ speaker: "participant-1", text: "Context before the target." }],
      },
      speaker: "target-speaker",
      text,
    };
  }

  it("passes exact text and context to the classifier and preserves the text", async () => {
    const originalText = "  Please keep my spacing.  ";
    let observedText = "";

    const result = await classifyMessage(contextualInput(originalText), async (input) => {
      observedText = input.text;
      expect(input.context.recentTurns).toHaveLength(1);
      return {
        presentationId: "whisper",
        confidence: 0.92,
        rewrittenText: "This extra field must be ignored.",
      };
    });

    expect(observedText).toBe(originalText);
    expect(result.originalText).toBe(originalText);
    expect(result.presentationId).toBe("whisper");
  });

  it("returns a plain fallback when the classifier fails", async () => {
    const originalText = "The provider never gets to rewrite this.";
    const result = await classifyMessage(contextualInput(originalText), async () => {
      throw new Error("provider unavailable");
    });

    expect(result).toEqual({
      originalText,
      presentationId: "plain",
      confidence: 0,
      fallbackReason: "provider-failure",
    });
  });

  it("does not call a provider when no surrounding context exists", async () => {
    const originalText = "A first message has no conversational evidence yet.";
    let called = false;
    const result = await classifyMessage({
      context: { strategy: "recent-messages", recentTurns: [] },
      speaker: "target-speaker",
      text: originalText,
    }, async () => {
      called = true;
      return { presentationId: "shout", confidence: 1 };
    });

    expect(called).toBe(false);
    expect(result).toEqual({
      originalText,
      presentationId: "plain",
      confidence: 0,
      fallbackReason: "insufficient-context",
    });
  });

  it("does not disguise an invalid threshold as a provider failure", async () => {
    await expect(classifyMessage(
      contextualInput("Hello"),
      async () => ({ presentationId: "plain", confidence: 1 }),
      -0.1,
    )).rejects.toThrow(RangeError);
  });
});
