import { describe, expect, it } from "vitest";
import {
  getDebugPresentationId,
  shouldAutoRunPresentationEffect,
} from "../app/message-presentations";

describe("getDebugPresentationId", () => {
  it.each([
    "plain",
    "whisper",
    "mutter",
    "exclaim",
    "shout",
    "scribble",
    "announce",
    "sad",
    "grandiose",
  ])("forces the %s presentation for an exact single-word message", (presentationId) => {
    expect(getDebugPresentationId(presentationId)).toBe(presentationId);
  });

  it("matches presentation names case-insensitively", () => {
    expect(getDebugPresentationId("  GRANDIOSE  ")).toBe("grandiose");
  });

  it("does not override normal conversation", () => {
    expect(getDebugPresentationId("I feel sad")).toBeUndefined();
    expect(getDebugPresentationId("sad!")).toBeUndefined();
  });
});

describe("shouldAutoRunPresentationEffect", () => {
  it("auto-runs recent sad rain and Scribble construction", () => {
    expect(shouldAutoRunPresentationEffect("sad", 4, 6)).toBe(true);
    expect(shouldAutoRunPresentationEffect("scribble", 5, 6)).toBe(true);
  });

  it("keeps other presentation effects interaction-driven", () => {
    expect(shouldAutoRunPresentationEffect("whisper", 5, 6)).toBe(false);
    expect(shouldAutoRunPresentationEffect("shout", 5, 6)).toBe(false);
  });

  it("does not auto-run historical sad or Scribble effects", () => {
    expect(shouldAutoRunPresentationEffect("sad", 2, 6)).toBe(false);
    expect(shouldAutoRunPresentationEffect("scribble", 1, 6)).toBe(false);
  });
});
