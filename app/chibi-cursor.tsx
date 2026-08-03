"use client";

import { useEffect, useRef, useState } from "react";
import {
  applyCursorPosition,
  canonicalCursorActionLayers,
  cursorPrototypeAssets,
  cursorIntents,
  getClampedArtworkOffset,
  getCursorArtworkHotspot,
  getCursorGuidePlacement,
  getCursorPoseOrientation,
  getCursorPrototypeId,
  getCursorTargetDistanceSquared,
  getCursorTransitionDuration,
  isCursorIntent,
  resolveCursorIntent,
  shouldUseNativePrecisionCursor,
  supportsChibiCursor,
  teardownCursorOverlay,
  type CursorIntent,
  type CursorPrototypeId,
} from "./cursor-companions";

const supportQuery = "(hover: hover) and (pointer: fine)";
const precisionCursorValues = new Set([
  "cell",
  "col-resize",
  "copy",
  "crosshair",
  "grab",
  "grabbing",
  "move",
  "row-resize",
  "text",
  "vertical-text",
  "ew-resize",
  "ns-resize",
  "nesw-resize",
  "nwse-resize",
  "zoom-in",
  "zoom-out",
]);
const cursorActionTargetSelector = [
  '[data-cursor-intent="action"]',
  '[data-cursor-intent="write"]',
  '[data-cursor-intent="inspect"]',
  "button:not([disabled]):not([aria-disabled='true'])",
  "a[href]",
  "input:not([type='hidden']):not([disabled]):not([aria-disabled='true'])",
  "textarea:not([disabled]):not([aria-disabled='true'])",
  "select:not([disabled]):not([aria-disabled='true'])",
  "[contenteditable='true']",
  "[role='button']:not([aria-disabled='true'])",
].join(", ");

function findNearestActionTarget(root: Element, pointerX: number, pointerY: number) {
  let nearestTarget: HTMLElement | null = null;
  let nearestRect: DOMRect | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestCenterDistance = Number.POSITIVE_INFINITY;

  for (const candidate of root.querySelectorAll<HTMLElement>(cursorActionTargetSelector)) {
    const rect = candidate.getBoundingClientRect();
    const outsideViewport = rect.right <= 0
      || rect.bottom <= 0
      || rect.left >= window.innerWidth
      || rect.top >= window.innerHeight;
    if (
      rect.width === 0
      || rect.height === 0
      || outsideViewport
      || candidate.closest("[hidden], [inert], [aria-hidden='true']")
      || candidate.matches("[disabled], [aria-disabled='true']")
    ) {
      continue;
    }

    const distance = getCursorTargetDistanceSquared(pointerX, pointerY, rect);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const centerDistance = (centerX - pointerX) ** 2 + (centerY - pointerY) ** 2;
    if (distance < nearestDistance || (distance === nearestDistance && centerDistance < nearestCenterDistance)) {
      const computedStyle = window.getComputedStyle(candidate);
      if (computedStyle.visibility === "hidden" || computedStyle.pointerEvents === "none") {
        continue;
      }
      nearestTarget = candidate;
      nearestRect = rect;
      nearestDistance = distance;
      nearestCenterDistance = centerDistance;
    }
  }

  return nearestTarget && nearestRect ? { rect: nearestRect, target: nearestTarget } : null;
}

function StandInPoses() {
  return (
    <svg aria-hidden="true" className="chibi-cursor-poses" viewBox="0 0 56 56">
      <g data-pose="default">
        <circle cx="28" cy="17" r="10" />
        <path d="M17 47V35c0-7 5-11 11-11s11 4 11 11v12z" />
        <circle className="pose-accent" cx="25" cy="16" r="1.6" />
        <circle className="pose-accent" cx="31" cy="16" r="1.6" />
      </g>
      <g data-pose="action">
        <circle cx="25" cy="18" r="9" />
        <path d="M15 47V35c0-6 4-10 10-10 5 0 9 3 10 8l13-9 3 5-17 13v5z" />
        <path className="pose-accent" d="m45 18 7 2-4 6z" />
      </g>
      <g data-pose="write">
        <circle cx="24" cy="17" r="9" />
        <path d="M13 47V34c0-6 5-10 11-10 5 0 9 3 10 8l-4 15z" />
        <path className="pose-accent" d="m34 38 14-20 4 3-15 20-5 3z" />
      </g>
      <g data-pose="inspect">
        <circle cx="23" cy="19" r="9" />
        <path d="M12 47V36c0-7 5-11 11-11 5 0 9 3 10 8l-2 14z" />
        <circle className="pose-accent pose-outline" cx="40" cy="22" r="8" />
        <path className="pose-accent pose-stroke" d="m45 28 7 8" />
      </g>
      <g data-pose="blocked">
        <circle cx="28" cy="16" r="9" />
        <path d="M16 47V35c0-7 5-11 12-11s12 4 12 11v12z" />
        <path className="pose-accent pose-stroke" d="m18 31 20 10m0-10L18 41" />
      </g>
      <g data-pose="press">
        <circle cx="28" cy="22" r="8" />
        <path d="M15 47v-8c0-6 6-10 13-10s13 4 13 10v8z" />
        <path className="pose-accent" d="m21 9 3-7 4 7 5-6 2 8z" />
      </g>
    </svg>
  );
}

function PrototypeAssetPoses({ prototypeId }: { prototypeId: Exclude<CursorPrototypeId, "geometry"> }) {
  return (
    <>
      <span className="chibi-cursor-pose-images">
        {cursorIntents.map((intent) => (
          <img
            alt=""
            aria-hidden="true"
            data-pose={intent}
            draggable="false"
            key={intent}
            src={cursorPrototypeAssets[prototypeId][intent]}
          />
        ))}
      </span>
      {prototypeId === "page-sleeve-spirit" ? (
        <span className="chibi-cursor-pointing-layers">
          <img
            alt=""
            aria-hidden="true"
            className="chibi-cursor-pointing-arm"
            draggable="false"
            src={canonicalCursorActionLayers.arm}
          />
          <img
            alt=""
            aria-hidden="true"
            className="chibi-cursor-pointing-body"
            draggable="false"
            src={canonicalCursorActionLayers.body}
          />
        </span>
      ) : null}
    </>
  );
}

function CursorMarker({ prototypeId }: { prototypeId: CursorPrototypeId }) {
  if (prototypeId === "page-sleeve-spirit") {
    return null;
  }

  return (
    <span className="chibi-cursor-marker">
      <svg aria-hidden="true" data-cursor-marker="pointer" viewBox="0 0 34 23">
        <path className="cursor-marker-sleeve" d="M1 9h9v12H1Z" />
        <path className="cursor-marker-hand" d="M8 9V5.8c0-1.4 1.1-2.5 2.5-2.5S13 4.4 13 5.8V8h15.2c2.1 0 3.8 1.6 3.8 3.5S30.3 15 28.2 15h-6.4l-3.6 5H9.5L7 16H5V9Z" />
        <path className="cursor-marker-hand-detail" d="M21.8 15 19 11.5M17.5 18.8 15 14.5" />
        <path className="cursor-marker-cuff" d="M9 9v11" />
      </svg>
      <svg aria-hidden="true" data-cursor-marker="text" viewBox="0 0 18 26">
        <path className="cursor-marker-ink" d="M4 3h10M9 3v20M4 23h10" />
        <path className="cursor-marker-paper-line" d="M4 3h10M9 3v20M4 23h10" />
        <path className="cursor-marker-accent" d="M6.5 13h5" />
      </svg>
    </span>
  );
}

function getTargetFacts(target: Element, pressed: boolean) {
  const explicitTarget = target.closest<HTMLElement>("[data-cursor-intent]");
  const semanticTarget = target.closest<HTMLElement>(
    "button, a[href], input, textarea, select, [contenteditable='true'], [role='button']",
  );
  const disabledTarget = target.closest<HTMLElement>("[disabled], [aria-disabled='true']");
  const precisionTarget = target.closest<HTMLElement>(
    "textarea, select, [contenteditable='true'], input:not([type='button']):not([type='checkbox']):not([type='hidden']):not([type='image']):not([type='radio']):not([type='reset']):not([type='submit']), [data-cursor-precision='true']",
  );
  const textEntryTarget = target.closest<HTMLElement>(
    "textarea, [contenteditable='true'], input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']):not([type='file']):not([type='button']):not([type='submit']):not([type='reset'])",
  );
  const computedCursor = window.getComputedStyle(target).cursor;
  const precision = Boolean(precisionTarget) || precisionCursorValues.has(computedCursor);

  return {
    disabled: Boolean(disabledTarget),
    explicitIntent: explicitTarget?.dataset.cursorIntent,
    precision,
    pressed,
    semanticTag: semanticTarget?.tagName,
    semanticType: semanticTarget instanceof HTMLInputElement ? semanticTarget.type : null,
    textEntry: Boolean(textEntryTarget),
  };
}

function CursorOverlay({ prototypeId }: { prototypeId: CursorPrototypeId }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    const body = document.body;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let loadingTimeout = 0;
    let readinessFrame = 0;
    let currentTarget: Element | null = null;
    let failed = false;
    let hasPointerCoordinates = false;
    let listenersAttached = true;
    let pointerInsideApp = false;
    let pointerX = 0;
    let pointerY = 0;
    let pressed = false;
    let ready = false;
    const artworkHotspot = getCursorArtworkHotspot(prototypeId);
    const assetImages = Array.from(overlay.querySelectorAll<HTMLImageElement>("img"));

    const setReducedMotion = () => {
      overlay.dataset.reducedMotion = reducedMotionQuery.matches ? "true" : "false";
      overlay.style.setProperty(
        "--cursor-pose-duration",
        `${getCursorTransitionDuration(reducedMotionQuery.matches)}ms`,
      );
    };

    const deactivate = () => {
      teardownCursorOverlay(body, overlay);
      delete overlay.dataset.guideTarget;
      delete overlay.dataset.pointing;
      delete overlay.dataset.poseMirrored;
      pointerInsideApp = false;
      pressed = false;
    };

    const activate = (useNativeCursor: boolean) => {
      if (!ready || failed || !pointerInsideApp) {
        return;
      }

      overlay.hidden = false;
      overlay.dataset.native = useNativeCursor ? "true" : "false";
      body.dataset.chibiCursorActive = "true";
      body.dataset.chibiCursorNative = useNativeCursor ? "true" : "false";
    };

    const setIntent = (intent: CursorIntent, precision: boolean) => {
      overlay.dataset.intent = intent;
      if (intent !== "default" && intent !== "action") {
        delete overlay.dataset.pointing;
        delete overlay.dataset.poseMirrored;
      }
      activate(precision);
    };

    const resolveTarget = (target: Element | null) => {
      currentTarget = target;
      const appTarget = target?.closest(".kokoroe-shell");
      if (!target || !appTarget) {
        deactivate();
        return;
      }

      pointerInsideApp = true;
      const facts = getTargetFacts(target, pressed);
      setIntent(
        resolveCursorIntent(facts),
        shouldUseNativePrecisionCursor(facts.precision, facts.textEntry),
      );
    };

    const flushPointerFrame = () => {
      animationFrame = 0;
      const artworkOffset = getClampedArtworkOffset(
        pointerX,
        pointerY,
        window.innerWidth,
        window.innerHeight,
        56,
        artworkHotspot,
      );
      const appShell = document.querySelector(".kokoroe-shell");
      const nearestAction = appShell ? findNearestActionTarget(appShell, pointerX, pointerY) : null;
      let activeHotspot = artworkHotspot;
      if (nearestAction) {
        const guidePlacement = getCursorGuidePlacement(
          pointerX,
          pointerY,
          nearestAction.rect,
          artworkOffset,
          window.innerWidth,
          window.innerHeight,
        );
        overlay.style.setProperty("--cursor-guide-angle", `${guidePlacement.rotation}deg`);
        overlay.style.setProperty("--cursor-guide-x", `${guidePlacement.x}px`);
        overlay.style.setProperty("--cursor-guide-y", `${guidePlacement.y}px`);
        overlay.dataset.guideTarget = nearestAction.target.tagName.toLowerCase();
        if (
          prototypeId === "page-sleeve-spirit"
          && (overlay.dataset.intent === "default" || overlay.dataset.intent === "action")
        ) {
          const orientation = getCursorPoseOrientation(guidePlacement.rotation);
          overlay.style.setProperty("--cursor-arm-angle", `${orientation.rotation}deg`);
          activeHotspot = orientation.hotspot;
          overlay.dataset.pointing = "true";
          if (orientation.mirrored) {
            overlay.dataset.poseMirrored = "true";
          } else {
            delete overlay.dataset.poseMirrored;
          }
        }
      } else {
        delete overlay.dataset.guideTarget;
        delete overlay.dataset.pointing;
        delete overlay.dataset.poseMirrored;
      }
      applyCursorPosition(
        overlay.style,
        pointerX,
        pointerY,
        window.innerWidth,
        window.innerHeight,
        activeHotspot,
      );
    };

    const schedulePointerFrame = () => {
      if (!pointerInsideApp || !ready || failed || animationFrame) {
        return;
      }
      animationFrame = window.requestAnimationFrame(flushPointerFrame);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      hasPointerCoordinates = true;
      const hitTarget = document.elementFromPoint(pointerX, pointerY);
      if (hitTarget !== currentTarget) {
        resolveTarget(hitTarget);
      }
      schedulePointerFrame();
    };

    const onPointerOver = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      hasPointerCoordinates = true;
      resolveTarget(event.target instanceof Element ? event.target : null);
      schedulePointerFrame();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !currentTarget) {
        return;
      }
      pressed = true;
      resolveTarget(currentTarget);
    };

    const onPointerUp = () => {
      if (!currentTarget) {
        return;
      }
      pressed = false;
      resolveTarget(currentTarget);
    };

    const onWindowMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget === null) {
        deactivate();
      }
    };

    const onViewportChange = () => {
      if (!hasPointerCoordinates) {
        return;
      }
      resolveTarget(document.elementFromPoint(pointerX, pointerY));
      schedulePointerFrame();
    };

    const removeListeners = () => {
      if (!listenersAttached) {
        return;
      }
      listenersAttached = false;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", deactivate);
      window.removeEventListener("mouseout", onWindowMouseOut);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("kokoroe:cursor-companion-failure", fail);
      reducedMotionQuery.removeEventListener("change", setReducedMotion);
      overlay.removeEventListener("error", fail, true);
      assetImages.forEach((image) => {
        image.removeEventListener("load", checkAssetReadiness);
        image.removeEventListener("error", fail);
      });
    };

    const fail = () => {
      if (failed) {
        return;
      }
      failed = true;
      overlay.dataset.failed = "true";
      deactivate();
      removeListeners();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        deactivate();
      }
    };

    const markReady = () => {
      if (failed || ready) {
        return;
      }
      window.clearTimeout(loadingTimeout);
      ready = true;
      overlay.dataset.ready = "true";
      if (hasPointerCoordinates) {
        resolveTarget(document.elementFromPoint(pointerX, pointerY));
      }
    };

    const checkAssetReadiness = () => {
      if (assetImages.some((image) => image.complete && image.naturalWidth === 0)) {
        fail();
        return;
      }
      if (assetImages.every((image) => image.complete && image.naturalWidth > 0)) {
        markReady();
      }
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", deactivate);
    window.addEventListener("mouseout", onWindowMouseOut);
    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("scroll", onViewportChange, { capture: true, passive: true });
    window.addEventListener("kokoroe:cursor-companion-failure", fail);
    reducedMotionQuery.addEventListener("change", setReducedMotion);
    overlay.addEventListener("error", fail, true);
    setReducedMotion();

    readinessFrame = window.requestAnimationFrame(() => {
      const poseCount = overlay.querySelectorAll("[data-pose]").length;
      if (poseCount !== cursorIntents.length || !cursorIntents.every((intent) => isCursorIntent(intent))) {
        fail();
        return;
      }

      if (assetImages.length === 0) {
        markReady();
        return;
      }

      assetImages.forEach((image) => {
        image.addEventListener("load", checkAssetReadiness);
        image.addEventListener("error", fail);
      });
      loadingTimeout = window.setTimeout(fail, 5000);
      checkAssetReadiness();
    });

    return () => {
      window.cancelAnimationFrame(readinessFrame);
      window.clearTimeout(loadingTimeout);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      removeListeners();
      teardownCursorOverlay(body, overlay);
    };
  }, [prototypeId]);

  return (
    <div
      aria-hidden="true"
      className="chibi-cursor"
      data-intent="default"
      data-native="true"
      data-pack={prototypeId}
      data-phase={prototypeId === "geometry"
        ? "geometric-prototype"
        : prototypeId === "page-sleeve-spirit"
          ? "canonical-pack"
          : "asset-comparison"}
      hidden
      ref={overlayRef}
    >
      <CursorMarker prototypeId={prototypeId} />
      <span className="chibi-cursor-art">
        {prototypeId === "geometry" ? <StandInPoses /> : <PrototypeAssetPoses prototypeId={prototypeId} />}
      </span>
    </div>
  );
}

export function ChibiCursor() {
  const [isSupported, setIsSupported] = useState(false);
  const [prototypeId, setPrototypeId] = useState<CursorPrototypeId>("page-sleeve-spirit");

  useEffect(() => {
    const supportMediaQuery = window.matchMedia(supportQuery);
    const hoverQuery = window.matchMedia("(hover: hover)");
    const finePointerQuery = window.matchMedia("(pointer: fine)");
    const updateSupport = () => setIsSupported(supportsChibiCursor(hoverQuery.matches, finePointerQuery.matches));
    setPrototypeId(getCursorPrototypeId(window.location.search));
    updateSupport();
    supportMediaQuery.addEventListener("change", updateSupport);
    return () => supportMediaQuery.removeEventListener("change", updateSupport);
  }, []);

  return isSupported ? <CursorOverlay prototypeId={prototypeId} /> : null;
}

declare global {
  interface WindowEventMap {
    "kokoroe:cursor-companion-failure": Event;
  }
}
