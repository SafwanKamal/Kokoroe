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
  mirrorPadding?: boolean;
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
const bubbleLineHeight = 1.35;

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function estimateWordWidth(word: string, fontPx: number) {
  const wideCharacters = (word.match(/[MW@#%&]/g) ?? []).length;
  const narrowCharacters = (word.match(/[fijlrtI.,!']/g) ?? []).length;
  const ordinaryCharacters = Math.max(0, word.length - wideCharacters - narrowCharacters);

  return ordinaryCharacters * fontPx * 0.58 +
    wideCharacters * fontPx * 0.82 +
    narrowCharacters * fontPx * 0.34;
}

function wrapEstimatedLines(words: string[], width: number, fontPx: number) {
  const spaceWidth = fontPx * 0.36;
  const lines: number[] = [];
  let currentLineWidth = 0;

  for (const word of words) {
    const wordWidth = estimateWordWidth(word, fontPx);
    const nextWidth = currentLineWidth === 0 ? wordWidth : currentLineWidth + spaceWidth + wordWidth;

    if (currentLineWidth > 0 && nextWidth > width) {
      lines.push(currentLineWidth);
      currentLineWidth = wordWidth;
    } else {
      currentLineWidth = nextWidth;
    }
  }

  if (currentLineWidth > 0) {
    lines.push(currentLineWidth);
  }

  return lines.length > 0 ? lines : [0];
}

function getBalancedTextBox(text: string, metrics: BubbleTemplateMetrics) {
  const maxTextWidth = Math.min(standardTextStage.maxWidth, metrics.maxTextWidth ?? metrics.textWidth);
  const normalizedText = text.trim().replace(/\s+/g, " ");

  if (!normalizedText) {
    return {
      lineCount: 1,
      minHeight: standardTextStage.minHeight,
      width: Math.min(standardTextStage.maxWidth, metrics.textWidth),
    };
  }

  const fontPx = metrics.fontSize * 16;
  const words = normalizedText.split(" ");
  const longestWordWidth = Math.max(...words.map((word) => estimateWordWidth(word, fontPx)));
  const minTextWidth = clamp(Math.ceil(longestWordWidth + fontPx * 0.8), metrics.textWidth, maxTextWidth);
  const targetLineCount = clamp(Math.round(Math.sqrt(normalizedText.length / 8)), 1, 4);
  const targetShellAspect = 2.45;
  let bestCandidate = {
    lineCount: 1,
    minHeight: standardTextStage.minHeight,
    score: Number.POSITIVE_INFINITY,
    width: maxTextWidth,
  };

  for (let candidateWidth = minTextWidth; candidateWidth <= maxTextWidth; candidateWidth += 8) {
    const lineWidths = wrapEstimatedLines(words, candidateWidth, fontPx);
    const lineCount = lineWidths.length;
    const widestLine = Math.max(...lineWidths);
    const textHeight = Math.max(standardTextStage.minHeight, Math.ceil(lineCount * fontPx * bubbleLineHeight));
    const shellWidth = candidateWidth + metrics.frameLeft + metrics.frameRight;
    const shellHeight = textHeight + metrics.frameTop + metrics.frameBottom;
    const shellAspect = shellWidth / shellHeight;
    const raggedness = lineWidths.reduce((total, lineWidth) => total + ((candidateWidth - lineWidth) / candidateWidth) ** 2, 0) / lineCount;
    const unusedWidth = candidateWidth - widestLine;
    const score =
      Math.abs(lineCount - targetLineCount) * 140 +
      Math.abs(shellAspect - targetShellAspect) * 32 +
      raggedness * 72 +
      unusedWidth * 0.55 +
      candidateWidth * 0.05;

    if (score < bestCandidate.score) {
      bestCandidate = {
        lineCount,
        minHeight: textHeight,
        score,
        width: Math.ceil(candidateWidth),
      };
    }
  }

  return bestCandidate;
}

export function getBubbleFrameStyle(presentationId: MessagePresentationId, text = "") {
  const metrics = messagePresentations[presentationId].metrics;
  const textBox = getBalancedTextBox(text, metrics);
  const outgoingFrameLeft = metrics.mirrorPadding ? metrics.frameRight : metrics.frameLeft;
  const outgoingFrameRight = metrics.mirrorPadding ? metrics.frameLeft : metrics.frameRight;

  return {
    "--bubble-text-width": `${textBox.width}px`,
    "--bubble-text-max-width": `${Math.min(standardTextStage.maxWidth, metrics.maxTextWidth ?? metrics.textWidth)}px`,
    "--bubble-text-min-height": `${textBox.minHeight}px`,
    "--bubble-frame-left": `${metrics.frameLeft}px`,
    "--bubble-frame-right": `${metrics.frameRight}px`,
    "--bubble-outgoing-frame-left": `${outgoingFrameLeft}px`,
    "--bubble-outgoing-frame-right": `${outgoingFrameRight}px`,
    "--bubble-frame-top": `${metrics.frameTop}px`,
    "--bubble-frame-bottom": `${metrics.frameBottom}px`,
    "--bubble-font-size": `${metrics.fontSize}rem`,
  } as CSSProperties;
}
