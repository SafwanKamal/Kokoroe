import { describe, expect, it } from "vitest";
import {
  getWorldCopy,
  getWorldCopyAriaLabel,
  getWorldCopyEntry,
  type WorldLanguageKey,
} from "../app/world-language";

const integratedKeys: WorldLanguageKey[] = [
  "auth.login.eyebrow",
  "auth.login.title",
  "auth.login.body",
  "auth.create.eyebrow",
  "auth.create.title",
  "auth.create.body",
  "auth.login.submit",
  "auth.create.submit",
  "auth.switch.toCreate.prompt",
  "auth.switch.toCreate.action",
  "auth.switch.toLogin.prompt",
  "auth.switch.toLogin.action",
  "navigation.setup.return",
  "navigation.bubbleStyle.toggle",
  "navigation.story.leave",
];

describe("world language catalog", () => {
  it.each(integratedKeys)("keeps %s approved with a plain-language meaning", (key) => {
    const entry = getWorldCopyEntry(key);

    expect(entry.status).toBe("approved");
    expect(entry.plainMeaning.trim().length).toBeGreaterThan(0);
    expect(getWorldCopy(key).trim().length).toBeGreaterThan(0);
  });

  it("uses operation-specific activity language", () => {
    expect(getWorldCopy("auth.login.submit", { variant: "busy" })).toBe("Turning to your story…");
    expect(getWorldCopy("auth.create.submit", { variant: "busy" })).toBe("Inking your place…");
  });

  it("falls back to the default variant when a named variant is unavailable", () => {
    expect(getWorldCopy("auth.create.title", { variant: "compact" })).toBe("Your role starts here.");
  });

  it("keeps expressive actions accessible through literal labels", () => {
    expect(getWorldCopyAriaLabel("auth.create.submit")).toBe("Create a Kokoroe account");
    expect(getWorldCopyAriaLabel("auth.login.submit")).toBe("Sign in to Kokoroe");
    expect(getWorldCopyAriaLabel("navigation.setup.return")).toBe("Return to world and character selection");
    expect(getWorldCopyAriaLabel("navigation.bubbleStyle.toggle")).toBe("AI bubble styling");
    expect(getWorldCopyAriaLabel("navigation.story.leave")).toBe("Sign out of Kokoroe");
  });

  it("describes the bubble-style toggle through explicit AI states", () => {
    expect(getWorldCopy("navigation.bubbleStyle.toggle")).toBe("AI Bubble Styling · Off");
    expect(getWorldCopy("navigation.bubbleStyle.toggle", { variant: "on" })).toBe("AI Bubble Styling · On");
  });

  it("keeps the accepted story-language sign-out label", () => {
    expect(getWorldCopy("navigation.story.leave")).toBe("Leave the Story");
  });
});
