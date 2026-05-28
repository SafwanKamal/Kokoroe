import type { CSSProperties } from "react";
import presentationCatalog from "../content/message-presentations/catalog.json";

export type MessagePresentationId =
  | "plain"
  | "whisper"
  | "mutter"
  | "exclaim"
  | "shout"
  | "scribble"
  | "announce"
  | "sad"
  | "grandiose";

type BubbleTemplateMetrics = {
  textWidth: number;
  maxTextWidth?: number;
  frameLeft: number;
  frameRight: number;
  frameTop: number;
  frameBottom: number;
  fontSize: number;
};

type MessagePresentation = {
  label: string;
  shell: MessagePresentationId;
  fontRole: "dialogue" | "impact" | "action" | "lively";
  ink: "ink" | "inverse" | "soft-blue" | "quiet-green" | "coral" | "gold" | "theatrical";
  motion: "steady" | "soft" | "tilt" | "lift" | "jolt" | "restless" | "radiant";
  maxCharacters: number;
  intensity: number;
  emotionTags: string[];
  classifierHint: string;
  metrics: BubbleTemplateMetrics;
};

export const messagePresentations = presentationCatalog as Record<MessagePresentationId, MessagePresentation>;

export const MESSAGE_CHARACTER_LIMIT = 120;

const standardTextStage = {
  maxWidth: 420,
  minHeight: 48,
};

const prototypePresentationIds = Object.keys(messagePresentations) as MessagePresentationId[];

export function resolvePresentationId(text: string, requestedId: MessagePresentationId) {
  const maxCharacters = Math.min(MESSAGE_CHARACTER_LIMIT, messagePresentations[requestedId].maxCharacters);

  return text.length <= maxCharacters ? requestedId : "plain";
}

export function getRandomPresentationId(text: string) {
  const suitableIds = prototypePresentationIds.filter(
    (presentationId) => text.length <= messagePresentations[presentationId].maxCharacters,
  );

  return suitableIds[Math.floor(Math.random() * suitableIds.length)] ?? "plain";
}

export function getBubbleFrameStyle(presentationId: MessagePresentationId) {
  const metrics = messagePresentations[presentationId].metrics;

  return {
    "--bubble-text-width": `${Math.min(standardTextStage.maxWidth, metrics.textWidth)}px`,
    "--bubble-text-max-width": `${Math.min(standardTextStage.maxWidth, metrics.maxTextWidth ?? metrics.textWidth)}px`,
    "--bubble-text-min-height": `${standardTextStage.minHeight}px`,
    "--bubble-frame-left": `${metrics.frameLeft}px`,
    "--bubble-frame-right": `${metrics.frameRight}px`,
    "--bubble-frame-top": `${metrics.frameTop}px`,
    "--bubble-frame-bottom": `${metrics.frameBottom}px`,
    "--bubble-font-size": `${metrics.fontSize}rem`,
  } as CSSProperties;
}
