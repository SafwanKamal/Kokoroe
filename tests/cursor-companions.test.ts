import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  applyCursorPosition,
  canonicalCursorActionLayers,
  cursorIntents,
  cursorPrototypeAssets,
  getCursorArtworkHotspot,
  getCursorGuidePlacement,
  getCursorTargetDistanceSquared,
  getClampedArtworkOffset,
  getCursorPrototypeAssetPaths,
  getCursorPrototypeId,
  getCursorPoseOrientation,
  getCursorTransitionDuration,
  resolveCursorIntent,
  shouldUseNativePrecisionCursor,
  supportsChibiCursor,
  teardownCursorOverlay,
} from "../app/cursor-companions";

describe("resolveCursorIntent", () => {
  it("keeps disabled targets blocked ahead of all other intents", () => {
    expect(resolveCursorIntent({
      disabled: true,
      explicitIntent: "action",
      precision: true,
      pressed: true,
      semanticTag: "button",
    })).toBe("blocked");
  });

  it("keeps precision controls native and uses the write stand-in", () => {
    expect(resolveCursorIntent({
      explicitIntent: "action",
      precision: true,
      semanticTag: "textarea",
    })).toBe("write");
  });

  it("prefers explicit intents over semantic fallbacks", () => {
    expect(resolveCursorIntent({ explicitIntent: "inspect", semanticTag: "button" })).toBe("inspect");
    expect(resolveCursorIntent({ explicitIntent: "not-allowed", semanticTag: "button" })).toBe("action");
  });

  it("uses press only while an enabled action is pressed", () => {
    expect(resolveCursorIntent({ explicitIntent: "action", pressed: true })).toBe("press");
    expect(resolveCursorIntent({ explicitIntent: "inspect", pressed: true })).toBe("inspect");
  });

  it("treats checkbox and radio inputs as actions rather than write surfaces", () => {
    expect(resolveCursorIntent({ semanticTag: "input", semanticType: "checkbox" })).toBe("action");
    expect(resolveCursorIntent({ semanticTag: "input", semanticType: "radio" })).toBe("action");
    expect(resolveCursorIntent({ semanticTag: "input", semanticType: "text" })).toBe("write");
  });
});

describe("cursor capability and motion policy", () => {
  it("mounts only for hover-capable fine pointers", () => {
    expect(supportsChibiCursor(true, true)).toBe(true);
    expect(supportsChibiCursor(true, false)).toBe(false);
    expect(supportsChibiCursor(false, true)).toBe(false);
  });

  it("removes pose interpolation for reduced motion", () => {
    expect(getCursorTransitionDuration(false)).toBe(100);
    expect(getCursorTransitionDuration(true)).toBe(0);
  });

  it("uses one custom marker for text entry while retaining native non-text precision cursors", () => {
    expect(shouldUseNativePrecisionCursor(true, true)).toBe(false);
    expect(shouldUseNativePrecisionCursor(true, false)).toBe(true);
    expect(shouldUseNativePrecisionCursor(false, false)).toBe(false);
  });
});

describe("cursor prototype selection", () => {
  it("uses the canonical page-sleeve poses by default and preserves explicit comparison fallbacks", () => {
    expect(getCursorPrototypeId("")).toBe("page-sleeve-spirit");
    expect(getCursorPrototypeId("?cursorConcept=page-sleeve-spirit")).toBe("page-sleeve-spirit");
    expect(getCursorPrototypeId("?cursorConcept=ink-page-sprite")).toBe("ink-page-sprite");
    expect(getCursorPrototypeId("?cursorConcept=folded-panel-rabbit")).toBe("folded-panel-rabbit");
    expect(getCursorPrototypeId("?cursorConcept=geometry")).toBe("geometry");
    expect(getCursorPrototypeId("?cursorConcept=unreviewed-pack")).toBe("page-sleeve-spirit");
  });

  it("provides one ordered asset for every intent in each complete test pack", () => {
    for (const prototypeId of ["page-sleeve-spirit", "ink-page-sprite", "folded-panel-rabbit"] as const) {
      const paths = getCursorPrototypeAssetPaths(prototypeId);
      expect(paths).toHaveLength(cursorIntents.length);
      expect(paths).toEqual(cursorIntents.map((intent) => cursorPrototypeAssets[prototypeId][intent]));
      expect(new Set(paths).size).toBe(cursorIntents.length);
      expect(paths.every((assetPath) => existsSync(path.join(process.cwd(), "public", assetPath)))).toBe(true);
    }
    expect(getCursorPrototypeAssetPaths("geometry")).toEqual([]);
    expect(existsSync(path.join(process.cwd(), "public", canonicalCursorActionLayers.arm))).toBe(true);
    expect(existsSync(path.join(process.cwd(), "public", canonicalCursorActionLayers.body))).toBe(true);
  });

  it("registers the canonical generated finger and open-palm hotspot without moving comparison packs", () => {
    expect(getCursorArtworkHotspot("page-sleeve-spirit")).toEqual({ x: 10, y: 21 });
    expect(getCursorArtworkHotspot("ink-page-sprite")).toEqual({ x: -2, y: -2 });
    expect(getCursorArtworkHotspot("geometry")).toEqual({ x: -2, y: -2 });
  });

  it("keeps the body upright while rotating the shoulder layer toward the target", () => {
    expect(getCursorPoseOrientation(180)).toEqual({
      hotspot: { x: 5.25, y: 32.375 },
      mirrored: false,
      rotation: 0,
    });
    expect(getCursorPoseOrientation(0)).toEqual({
      hotspot: { x: 50.75, y: 32.375 },
      mirrored: true,
      rotation: 0,
    });
    const upperRight = getCursorPoseOrientation(315);
    expect(upperRight.mirrored).toBe(true);
    expect(upperRight.rotation).toBe(45);
    expect(upperRight.hotspot.x).toBeGreaterThan(35);
    expect(upperRight.hotspot.y).toBeLessThan(32.375);
  });
});

describe("cursor positioning and failure teardown", () => {
  it("measures the nearest actionable rectangle and orbits the pointing hand toward its center", () => {
    const rect = { left: 20, right: 60, top: 30, bottom: 50, width: 40, height: 20 };
    expect(getCursorTargetDistanceSquared(10, 40, rect)).toBe(100);
    expect(getCursorTargetDistanceSquared(30, 40, rect)).toBe(0);
    const placement = getCursorGuidePlacement(10, 40, rect, { x: 2, y: 2 }, 800, 600);
    expect(placement.x).toBe(30);
    expect(placement.y).toBe(-12);
    expect(placement.rotation).toBe(270);
  });

  it("keeps the pointing hand visible near viewport edges and resolves a target at the chibi center", () => {
    const edgePlacement = getCursorGuidePlacement(
      798,
      598,
      { left: 790, right: 800, top: 590, bottom: 600, width: 10, height: 10 },
      { x: -58, y: -58 },
      800,
      600,
    );
    expect(edgePlacement.x).toBe(-26);
    expect(edgePlacement.y).toBe(-26);

    const centeredPlacement = getCursorGuidePlacement(
      100,
      100,
      { left: 120, right: 140, top: 120, bottom: 140, width: 20, height: 20 },
      { x: 2, y: 2 },
      800,
      600,
    );
    expect(Number.isFinite(centeredPlacement.rotation)).toBe(true);
    expect(Number.isFinite(centeredPlacement.x)).toBe(true);
    expect(Number.isFinite(centeredPlacement.y)).toBe(true);
  });

  it("clamps artwork while leaving the hotspot at the pointer coordinate", () => {
    expect(getClampedArtworkOffset(1438, 898, 1440, 900)).toEqual({ x: -58, y: -58 });
    expect(getClampedArtworkOffset(2, 2, 1440, 900)).toEqual({ x: 2, y: 2 });
    expect(getClampedArtworkOffset(200, 200, 1440, 900, 56, { x: 10, y: 21 })).toEqual({
      x: -10,
      y: -21,
    });
    expect(getClampedArtworkOffset(2, 2, 1440, 900, 56, { x: 10, y: 21 })).toEqual({ x: 2, y: 2 });
    const layeredHotspot = getCursorPoseOrientation(315).hotspot;
    const layeredEdge = getClampedArtworkOffset(1438, 898, 1440, 900, 56, layeredHotspot);
    expect(layeredEdge.x).toBeLessThan(-layeredHotspot.x);
    expect(layeredEdge.y).toBeLessThan(-layeredHotspot.y);
  });

  it("updates CSS properties directly without a React state path", () => {
    const setProperty = vi.fn();
    applyCursorPosition({ setProperty }, 120, 80, 800, 600);
    expect(setProperty.mock.calls).toEqual([
      ["--cursor-x", "120px"],
      ["--cursor-y", "80px"],
      ["--cursor-art-x", "2px"],
      ["--cursor-art-y", "2px"],
    ]);
  });

  it("does not invalidate stable cursor offsets on every pointer frame", () => {
    const values = new Map([
      ["--cursor-x", "120px"],
      ["--cursor-y", "80px"],
      ["--cursor-art-x", "2px"],
      ["--cursor-art-y", "2px"],
    ]);
    const setProperty = vi.fn();
    applyCursorPosition({
      getPropertyValue: (name) => values.get(name) ?? "",
      setProperty,
    }, 120, 80, 800, 600);
    expect(setProperty).not.toHaveBeenCalled();
  });

  it("restores the native cursor and hides the overlay on failure or teardown", () => {
    const removeAttribute = vi.fn();
    const overlay = { hidden: false };
    teardownCursorOverlay({ removeAttribute } as unknown as HTMLElement, overlay as HTMLElement);
    expect(overlay.hidden).toBe(true);
    expect(removeAttribute.mock.calls).toEqual([
      ["data-chibi-cursor-active"],
      ["data-chibi-cursor-native"],
    ]);
  });
});
