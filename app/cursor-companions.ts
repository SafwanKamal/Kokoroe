export const cursorIntents = ["default", "action", "write", "inspect", "blocked", "press"] as const;
export const cursorPrototypeIds = [
  "geometry",
  "page-sleeve-spirit",
  "ink-page-sprite",
  "folded-panel-rabbit",
] as const;

export type CursorIntent = (typeof cursorIntents)[number];
export type CursorPrototypeId = (typeof cursorPrototypeIds)[number];

type CursorAssetPrototypeId = Exclude<CursorPrototypeId, "geometry">;

export const cursorPrototypeAssets: Record<CursorAssetPrototypeId, Record<CursorIntent, string>> = {
  "page-sleeve-spirit": Object.fromEntries(
    cursorIntents.map((intent) => [intent, `/cursor-companions/page-sleeve-spirit/${intent}.webp`]),
  ) as Record<CursorIntent, string>,
  "ink-page-sprite": Object.fromEntries(
    cursorIntents.map((intent) => [intent, `/cursor-companions/prototypes/ink-page-sprite/${intent}.webp`]),
  ) as Record<CursorIntent, string>,
  "folded-panel-rabbit": Object.fromEntries(
    cursorIntents.map((intent) => [intent, `/cursor-companions/prototypes/folded-panel-rabbit/${intent}.webp`]),
  ) as Record<CursorIntent, string>,
};

export const canonicalCursorActionLayers = {
  arm: "/cursor-companions/page-sleeve-spirit/action-arm.webp",
  body: "/cursor-companions/page-sleeve-spirit/action-body.webp",
} as const;

type CursorIntentFacts = {
  disabled?: boolean;
  explicitIntent?: string | null;
  precision?: boolean;
  pressed?: boolean;
  semanticTag?: string | null;
  semanticType?: string | null;
};

export type CursorTargetRect = Pick<DOMRect, "bottom" | "height" | "left" | "right" | "top" | "width">;

type CursorPositionStyle = {
  getPropertyValue?(name: string): string;
  setProperty(name: string, value: string): void;
};

export type CursorPoseOrientation = {
  hotspot: { x: number; y: number };
  mirrored: boolean;
  rotation: number;
};

function normalizeSignedDegrees(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function getCursorPoseOrientation(targetAngle: number): CursorPoseOrientation {
  const normalizedTarget = normalizeSignedDegrees(targetAngle);
  const mirrored = normalizedTarget >= -90 && normalizedTarget <= 90;
  const shoulder = mirrored ? { x: 35, y: 32.375 } : { x: 21, y: 32.375 };
  const armLength = 15.75;
  const radians = normalizedTarget * Math.PI / 180;

  return {
    hotspot: {
      x: shoulder.x + Math.cos(radians) * armLength,
      y: shoulder.y + Math.sin(radians) * armLength,
    },
    mirrored,
    rotation: mirrored
      ? normalizedTarget === 0 ? 0 : -normalizedTarget
      : normalizeSignedDegrees(normalizedTarget - 180),
  };
}

export function isCursorIntent(value: string | null | undefined): value is CursorIntent {
  return cursorIntents.includes(value as CursorIntent);
}

export function getCursorPrototypeId(search: string): CursorPrototypeId {
  const requestedPrototype = new URLSearchParams(search).get("cursorConcept");
  return cursorPrototypeIds.includes(requestedPrototype as CursorPrototypeId)
    ? requestedPrototype as CursorPrototypeId
    : "page-sleeve-spirit";
}

export function getCursorArtworkHotspot(prototypeId: CursorPrototypeId) {
  return prototypeId === "page-sleeve-spirit"
    ? { x: 10, y: 21 }
    : { x: -2, y: -2 };
}

export function getCursorPrototypeAssetPaths(prototypeId: CursorPrototypeId) {
  return prototypeId === "geometry"
    ? []
    : cursorIntents.map((intent) => cursorPrototypeAssets[prototypeId][intent]);
}

export function resolveCursorIntent({
  disabled = false,
  explicitIntent,
  precision = false,
  pressed = false,
  semanticTag,
  semanticType,
}: CursorIntentFacts): CursorIntent {
  if (disabled) {
    return "blocked";
  }

  if (precision) {
    return "write";
  }

  const normalizedTag = semanticTag?.toLowerCase();
  const normalizedType = semanticType?.toLowerCase();
  const inputIsAction = normalizedTag === "input"
    && ["button", "checkbox", "image", "radio", "reset", "submit"].includes(normalizedType ?? "");
  const baseIntent = isCursorIntent(explicitIntent)
    ? explicitIntent
    : normalizedTag === "button" || normalizedTag === "a" || inputIsAction
      ? "action"
      : normalizedTag === "input" || normalizedTag === "textarea"
        ? "write"
        : "default";

  return pressed && baseIntent === "action" ? "press" : baseIntent;
}

export function supportsChibiCursor(hoverMatches: boolean, finePointerMatches: boolean) {
  return hoverMatches && finePointerMatches;
}

export function getCursorTransitionDuration(shouldReduceMotion: boolean) {
  return shouldReduceMotion ? 0 : 100;
}

export function shouldUseNativePrecisionCursor(precision: boolean, textEntry: boolean) {
  return precision && !textEntry;
}

export function getCursorTargetDistanceSquared(
  pointerX: number,
  pointerY: number,
  rect: CursorTargetRect,
) {
  const dx = pointerX < rect.left ? rect.left - pointerX : pointerX > rect.right ? pointerX - rect.right : 0;
  const dy = pointerY < rect.top ? rect.top - pointerY : pointerY > rect.bottom ? pointerY - rect.bottom : 0;
  return dx * dx + dy * dy;
}

export function getClampedArtworkOffset(
  pointerX: number,
  pointerY: number,
  viewportWidth: number,
  viewportHeight: number,
  artworkSize = 56,
  hotspot = { x: -2, y: -2 },
) {
  const viewportMargin = 4;
  const desiredX = pointerX - hotspot.x;
  const desiredY = pointerY - hotspot.y;
  const artworkX = Math.min(
    Math.max(desiredX, viewportMargin),
    Math.max(viewportMargin, viewportWidth - artworkSize - viewportMargin),
  );
  const artworkY = Math.min(
    Math.max(desiredY, viewportMargin),
    Math.max(viewportMargin, viewportHeight - artworkSize - viewportMargin),
  );

  return {
    x: artworkX - pointerX,
    y: artworkY - pointerY,
  };
}

export function getCursorGuidePlacement(
  pointerX: number,
  pointerY: number,
  targetRect: CursorTargetRect,
  artworkOffset: { x: number; y: number },
  viewportWidth: number,
  viewportHeight: number,
  artworkSize = 56,
) {
  const artworkCenterX = pointerX + artworkOffset.x + artworkSize / 2;
  const artworkCenterY = pointerY + artworkOffset.y + artworkSize / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  let directionX = targetCenterX - artworkCenterX;
  let directionY = targetCenterY - artworkCenterY;

  if (Math.hypot(directionX, directionY) < 0.001) {
    directionX = pointerX - artworkCenterX;
    directionY = pointerY - artworkCenterY;
  }
  if (Math.hypot(directionX, directionY) < 0.001) {
    directionY = -1;
  }

  const directionLength = Math.hypot(directionX, directionY);
  const unitX = directionX / directionLength;
  const unitY = directionY / directionLength;
  const orbitRadius = artworkSize / 2 + 16;
  const guideMargin = 28;
  const unclampedGuideX = artworkCenterX + unitX * orbitRadius;
  const unclampedGuideY = artworkCenterY + unitY * orbitRadius;
  const minGuideX = Math.min(guideMargin, viewportWidth / 2);
  const minGuideY = Math.min(guideMargin, viewportHeight / 2);
  const maxGuideX = Math.max(minGuideX, viewportWidth - guideMargin);
  const maxGuideY = Math.max(minGuideY, viewportHeight - guideMargin);
  const guideX = Math.min(Math.max(unclampedGuideX, minGuideX), maxGuideX);
  const guideY = Math.min(Math.max(unclampedGuideY, minGuideY), maxGuideY);
  const direction = Math.atan2(unitY, unitX) * 180 / Math.PI;

  return {
    rotation: (direction + 360) % 360,
    x: guideX - pointerX,
    y: guideY - pointerY,
  };
}

export function applyCursorPosition(
  style: CursorPositionStyle,
  pointerX: number,
  pointerY: number,
  viewportWidth: number,
  viewportHeight: number,
  artworkHotspot = { x: -2, y: -2 },
) {
  const artworkOffset = getClampedArtworkOffset(
    pointerX,
    pointerY,
    viewportWidth,
    viewportHeight,
    56,
    artworkHotspot,
  );
  const properties = [
    ["--cursor-x", `${pointerX}px`],
    ["--cursor-y", `${pointerY}px`],
    ["--cursor-art-x", `${artworkOffset.x}px`],
    ["--cursor-art-y", `${artworkOffset.y}px`],
  ] as const;
  for (const [name, value] of properties) {
    if (!style.getPropertyValue || style.getPropertyValue(name) !== value) {
      style.setProperty(name, value);
    }
  }
  return artworkOffset;
}

export function teardownCursorOverlay(body: Pick<HTMLElement, "removeAttribute">, overlay: Pick<HTMLElement, "hidden">) {
  overlay.hidden = true;
  body.removeAttribute("data-chibi-cursor-active");
  body.removeAttribute("data-chibi-cursor-native");
}
