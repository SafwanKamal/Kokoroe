"use client";

import { FormEvent, KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type TargetAndTransition, type Transition, useReducedMotion } from "motion/react";
import {
  avatarsByRoom as catalogAvatarsByRoom,
  initialAvatarSelections,
  loginSceneArts,
  rooms as catalogRooms,
  type ChatMessage,
} from "./chat-data";
import {
  createAccountSession,
  createLoginSession,
  fetchCurrentSession,
  fetchMessageClassifierPolicy,
  fetchProfile,
  fetchRoomMessages,
  fetchRooms,
  logoutSession,
  patchProfile,
  postRoomJoin,
  postRoomMember,
  postRoomMessage,
  searchRoomMemberAccounts,
  type MessageClassifierPolicy,
} from "./kokoroe-api";
import {
  getBubbleFrameStyle,
  getDebugPresentationId,
  getRandomPresentationId,
  MESSAGE_CHARACTER_LIMIT,
  messagePresentations,
  resolvePresentationId,
  shouldAutoRunPresentationEffect,
  type MessagePresentationId,
} from "./message-presentations";
import { subscribeToRoomMessages } from "./realtime";
import { CLOUD_STYLE_CONSENT_STORAGE_KEY, PRIVACY_POLICY_VERSION } from "./privacy-policy";
import type { KokoroePublicUser } from "./kokoroe-store";
import { getWorldCopy, getWorldCopyAriaLabel } from "./world-language";

type AppStep = "login" | "scene" | "chat";
type AuthMode = "login" | "create";

const disabledClassifierPolicy: MessageClassifierPolicy = {
  canaryRoomIds: [],
  contextStrategy: "recent-messages",
  discussionSourceMessageLimit: 40,
  discussionTailMessageLimit: 4,
  enabled: false,
  recentMessageLimit: 8,
};

const transitionFrameIndexes = [1, 2, 3, 4, 5, 6];
const crimsonPetals = [
  { id: "petal-1", x: "6%", drift: "8rem", fall: "44rem", size: "0.5rem", rotate: "-18deg", delay: "-900ms", duration: "11800ms", flutter: "3100ms" },
  { id: "petal-2", x: "14%", drift: "-5rem", fall: "51rem", size: "0.58rem", rotate: "24deg", delay: "-8200ms", duration: "13200ms", flutter: "3600ms" },
  { id: "petal-3", x: "22%", drift: "10rem", fall: "47rem", size: "0.42rem", rotate: "52deg", delay: "-4400ms", duration: "12400ms", flutter: "2800ms" },
  { id: "petal-4", x: "31%", drift: "-8rem", fall: "56rem", size: "0.64rem", rotate: "-38deg", delay: "-10100ms", duration: "14200ms", flutter: "3900ms" },
  { id: "petal-5", x: "40%", drift: "6rem", fall: "45rem", size: "0.46rem", rotate: "14deg", delay: "-6300ms", duration: "12000ms", flutter: "3300ms" },
  { id: "petal-6", x: "49%", drift: "-11rem", fall: "54rem", size: "0.56rem", rotate: "68deg", delay: "-11600ms", duration: "13800ms", flutter: "4200ms" },
  { id: "petal-7", x: "58%", drift: "8rem", fall: "50rem", size: "0.5rem", rotate: "-54deg", delay: "-7100ms", duration: "12900ms", flutter: "3500ms" },
  { id: "petal-8", x: "67%", drift: "-6rem", fall: "43rem", size: "0.4rem", rotate: "34deg", delay: "-2600ms", duration: "11600ms", flutter: "3000ms" },
  { id: "petal-9", x: "76%", drift: "12rem", fall: "55rem", size: "0.62rem", rotate: "-72deg", delay: "-12400ms", duration: "14600ms", flutter: "4300ms" },
  { id: "petal-10", x: "84%", drift: "-7rem", fall: "48rem", size: "0.44rem", rotate: "82deg", delay: "-7600ms", duration: "12600ms", flutter: "3200ms" },
  { id: "petal-11", x: "91%", drift: "5rem", fall: "52rem", size: "0.52rem", rotate: "-28deg", delay: "-4900ms", duration: "13400ms", flutter: "3800ms" },
  { id: "petal-12", x: "97%", drift: "-12rem", fall: "46rem", size: "0.38rem", rotate: "42deg", delay: "-2200ms", duration: "11900ms", flutter: "2900ms" },
];
const sadRainDrops = [
  { id: "rain-1", x: "3%", y: "4%", length: "2.2rem", delay: "-120ms", duration: "1080ms", opacity: "0.7" },
  { id: "rain-2", x: "11%", y: "34%", length: "2.8rem", delay: "-720ms", duration: "1260ms", opacity: "0.54" },
  { id: "rain-3", x: "19%", y: "12%", length: "1.8rem", delay: "-360ms", duration: "960ms", opacity: "0.62" },
  { id: "rain-4", x: "30%", y: "58%", length: "2.7rem", delay: "-980ms", duration: "1320ms", opacity: "0.48" },
  { id: "rain-5", x: "40%", y: "45%", length: "2.1rem", delay: "-240ms", duration: "1120ms", opacity: "0.6" },
  { id: "rain-6", x: "51%", y: "64%", length: "3rem", delay: "-820ms", duration: "1280ms", opacity: "0.5" },
  { id: "rain-7", x: "62%", y: "49%", length: "1.9rem", delay: "-500ms", duration: "1000ms", opacity: "0.66" },
  { id: "rain-8", x: "72%", y: "60%", length: "2.6rem", delay: "-1120ms", duration: "1220ms", opacity: "0.52" },
  { id: "rain-9", x: "82%", y: "38%", length: "2.2rem", delay: "-600ms", duration: "1100ms", opacity: "0.58" },
  { id: "rain-10", x: "90%", y: "10%", length: "2.8rem", delay: "-300ms", duration: "1180ms", opacity: "0.64" },
  { id: "rain-11", x: "97%", y: "48%", length: "1.9rem", delay: "-1040ms", duration: "1020ms", opacity: "0.56" },
  { id: "rain-12", x: "24%", y: "72%", length: "1.6rem", delay: "-780ms", duration: "1140ms", opacity: "0.44" },
];

type AnimatedBubblePresentationId = Exclude<MessagePresentationId, "plain" | "sad">;

const bubbleEffectViewBoxes: Record<AnimatedBubblePresentationId, [number, number]> = {
  whisper: [365, 190],
  mutter: [280, 190],
  exclaim: [310, 210],
  shout: [370, 210],
  scribble: [300, 210],
  announce: [390, 210],
  grandiose: [560, 220],
};

const whisperMotes = [
  { x: 48, y: 47, r: 6.2 },
  { x: 112, y: 22, r: 4.8 },
  { x: 252, y: 22, r: 5.4 },
  { x: 321, y: 63, r: 4.6 },
  { x: 307, y: 143, r: 5.8 },
  { x: 92, y: 157, r: 4.9 },
];

const whisperContourSegments = [
  "M61 38 C116 19 246 20 304 37",
  "M312 43 C331 74 330 122 309 146",
  "M292 151 C241 161 173 159 119 152",
  "M103 151 C91 164 77 173 61 178",
];

const scribbleBuildStrokes = [
  { d: "M30 56 C76 31 126 37 164 43 C204 31 247 42 263 61", width: 29 },
  { d: "M259 76 C221 57 180 67 145 72 C102 58 56 66 28 88", width: 31 },
  { d: "M27 101 C66 78 111 88 150 95 C194 79 238 88 264 108", width: 32 },
  { d: "M258 121 C220 102 181 112 147 119 C103 104 55 114 31 134", width: 31 },
  { d: "M39 145 C73 126 112 136 151 144 C189 132 226 136 249 151", width: 28 },
  { d: "M48 151 L34 174 L61 157 C91 166 118 160 143 166 C174 171 205 159 241 150", width: 17 },
];

function ScribbleBubbleShell({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const clipPathId = `scribble-clip-${useId().replaceAll(":", "")}`;

  return (
    <>
      <svg
        aria-hidden="true"
        className="scribble-builder"
        data-animate={shouldReduceMotion ? "false" : "true"}
        preserveAspectRatio="none"
        viewBox="0 0 300 210"
      >
        <defs>
          <clipPath id={clipPathId}>
            <path d="M46 48C62 28 94 23 122 26C139 16 167 19 182 25C207 19 239 29 251 48C266 58 267 84 259 98C270 117 259 141 244 148C228 166 194 168 174 164C154 175 120 170 104 163C87 169 62 159 55 148L32 166L40 139C25 125 23 99 32 85C25 67 34 54 46 48Z" />
          </clipPath>
        </defs>

        <path
          className="scribble-builder-paper"
          d="M46 48C62 28 94 23 122 26C139 16 167 19 182 25C207 19 239 29 251 48C266 58 267 84 259 98C270 117 259 141 244 148C228 166 194 168 174 164C154 175 120 170 104 163C87 169 62 159 55 148L32 166L40 139C25 125 23 99 32 85C25 67 34 54 46 48Z"
          fill="#F6EEDC"
        />
        <path
          className="scribble-builder-shell"
          d="M46 48C62 28 94 23 122 26C139 16 167 19 182 25C207 19 239 29 251 48C266 58 267 84 259 98C270 117 259 141 244 148C228 166 194 168 174 164C154 175 120 170 104 163C87 169 62 159 55 148L32 166L40 139C25 125 23 99 32 85C25 67 34 54 46 48Z"
          fill="#171312"
          pathLength="1"
          stroke="#12110F"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="7"
        />
        <g clipPath={`url(#${clipPathId})`}>
          {scribbleBuildStrokes.map((stroke) => (
            <path
              className="scribble-builder-fill-stroke"
              d={stroke.d}
              fill="none"
              key={stroke.d}
              pathLength="1"
              stroke="#171312"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={stroke.width}
            />
          ))}
        </g>
        <g
          className="scribble-builder-details"
          clipPath={`url(#${clipPathId})`}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M25 69C55 33 109 33 153 38C198 27 255 43 271 68C245 52 198 52 157 59C103 47 52 53 20 88C53 57 109 59 157 67C204 54 256 69 274 91C239 71 191 74 150 80C91 66 48 80 22 106C62 76 107 84 154 91C207 76 253 90 272 112C235 94 195 97 151 104C102 91 54 100 22 125C59 100 105 105 157 116C203 101 247 110 266 132C229 117 191 120 151 128C96 112 51 124 30 145C63 120 102 128 149 139C191 124 235 131 258 151" stroke="#3D3533" strokeWidth="5.2" />
          <path d="M34 50C67 78 102 103 145 138C178 158 218 154 263 130M29 76C65 99 100 124 137 150C169 168 216 160 258 145M38 40C65 62 110 92 151 120C192 144 232 139 267 116M63 29C89 51 118 68 158 92C198 116 232 110 267 92M94 24C110 42 140 58 174 74C210 93 242 84 263 72" stroke="#312B29" strokeWidth="4.5" />
          <path d="M29 58C60 42 96 47 127 41C161 31 200 40 228 51C258 64 262 83 249 93C232 108 197 106 167 114C128 122 90 112 56 123C30 132 26 112 38 100C58 81 99 87 133 76C172 63 212 68 246 79C270 89 266 112 243 122C214 135 181 128 149 140C116 151 73 145 46 137" stroke="#4A403D" strokeWidth="3.2" />
        </g>
        <g className="scribble-builder-finishing" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M43 43C65 21 95 25 120 20C142 14 163 23 182 20C210 18 237 28 257 48M32 65C19 83 30 99 24 114C22 130 37 143 45 149L34 178L60 157M84 164C102 176 124 168 140 176C159 180 175 166 190 170C212 173 233 161 247 153M258 64C270 77 259 91 269 105C274 122 259 138 250 145" stroke="#12110F" strokeWidth="3.5" />
          <path d="M48 54C63 35 93 32 116 34C139 26 159 31 179 33C205 27 229 38 243 52C258 69 252 87 256 101C261 120 248 134 236 143C217 156 192 154 174 157C152 166 129 159 108 157C88 163 68 151 60 141L47 150L51 132C38 120 37 99 43 84C36 72 40 60 48 54Z" stroke="#524745" strokeDasharray="19 6 8 5" strokeWidth="3" />
          <path d="M27 50L17 42M30 42L25 29M268 50L281 39M271 60L286 56M26 139L15 146M30 149L18 160M257 144L274 153M253 153L264 165" stroke="#12110F" strokeWidth="3.4" />
        </g>
      </svg>
      {!shouldReduceMotion && (
        <span aria-hidden="true" className="scribble-pen-track">
          <svg className="scribble-pen" viewBox="0 0 34 48">
            <path d="M17 2L29 14L14 38L4 44L8 33L17 2Z" fill="#F1C94C" stroke="#12110F" strokeLinejoin="round" strokeWidth="3" />
            <path d="M8 33L14 38L4 44L8 33Z" fill="#12110F" />
            <path d="M15 8L25 18" fill="none" stroke="#F9F4E8" strokeLinecap="round" strokeWidth="2.2" />
          </svg>
        </span>
      )}
    </>
  );
}

const exclaimSpeedLines = [
  "M52 57 L14 29",
  "M38 105 L4 105",
  "M52 153 L14 181",
  "M258 57 L296 29",
  "M272 105 L306 105",
  "M258 153 L296 181",
];

const grandioseGlints = [
  { x: 100, y: 48, size: 18, delay: 0, color: "#F1C94C" },
  { x: 180, y: 30, size: 12, delay: 0.2, color: "#FFF3A6" },
  { x: 280, y: 18, size: 17, delay: 0.4, color: "#F1C94C" },
  { x: 380, y: 30, size: 12, delay: 0.6, color: "#FFE275" },
  { x: 460, y: 48, size: 18, delay: 0.8, color: "#F1C94C" },
  { x: 476, y: 110, size: 13, delay: 1, color: "#FFF3A6" },
  { x: 452, y: 174, size: 16, delay: 1.2, color: "#F1C94C" },
  { x: 366, y: 194, size: 11, delay: 1.4, color: "#FFE275" },
  { x: 280, y: 202, size: 18, delay: 1.6, color: "#F1C94C" },
  { x: 194, y: 194, size: 11, delay: 1.8, color: "#FFF3A6" },
  { x: 108, y: 174, size: 16, delay: 2, color: "#F1C94C" },
  { x: 84, y: 110, size: 13, delay: 2.2, color: "#FFE275" },
];

const grandioseGoldDust = [
  { x: 132, y: 55, r: 3.6, delay: 0.1 },
  { x: 220, y: 35, r: 2.7, delay: 0.5 },
  { x: 326, y: 31, r: 3.1, delay: 0.9 },
  { x: 428, y: 58, r: 2.5, delay: 1.3 },
  { x: 468, y: 88, r: 3.3, delay: 1.7 },
  { x: 438, y: 150, r: 2.8, delay: 2.1 },
  { x: 344, y: 184, r: 3.5, delay: 2.5 },
  { x: 236, y: 188, r: 2.6, delay: 2.9 },
  { x: 132, y: 158, r: 3.2, delay: 3.3 },
  { x: 92, y: 86, r: 2.7, delay: 3.7 },
];

function BubbleEffectRig({
  isActive,
  isOwnMessage,
  presentationId,
  shouldReduceMotion,
}: {
  isActive: boolean;
  isOwnMessage: boolean;
  presentationId: MessagePresentationId;
  shouldReduceMotion: boolean;
}) {
  if (!isActive || presentationId === "plain" || presentationId === "sad" || presentationId === "shout" || presentationId === "scribble" || shouldReduceMotion) {
    return null;
  }

  const [viewBoxWidth, viewBoxHeight] = bubbleEffectViewBoxes[presentationId];
  const mirrorTransform = isOwnMessage ? `translate(${viewBoxWidth} 0) scale(-1 1)` : undefined;
  const pathTransition = (delay: number, repeatDelay = 3.8) => ({
    delay,
    duration: 0.72,
    ease: "easeOut" as const,
    repeat: Infinity,
    repeatDelay,
  });

  return (
    <svg
      aria-hidden="true"
      className="bubble-effect-rig"
      preserveAspectRatio="none"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
    >
      <g transform={mirrorTransform}>
        {presentationId === "whisper" && whisperMotes.map((mote) => (
          <circle
            className="bubble-effect-mote"
            cx={mote.x}
            cy={mote.y}
            fill="rgba(227, 242, 248, 0.74)"
            key={`${mote.x}-${mote.y}`}
            r={mote.r}
            stroke="rgba(137, 183, 207, 0.64)"
            strokeWidth="1"
          />
        ))}
        {presentationId === "whisper" && whisperContourSegments.map((path) => (
          <path
            className="bubble-effect-whisper-trace"
            d={path}
            fill="none"
            key={path}
            pathLength="1"
            stroke="rgba(103, 165, 198, 0.88)"
            strokeDasharray="0.08 0.08"
            strokeLinecap="round"
            strokeWidth="3"
          />
        ))}

        {presentationId === "mutter" && [
          "M46 43 L58 28",
          "M43 151 L58 163",
          "M226 38 L239 52",
        ].map((path) => (
          <path
            className="bubble-effect-ink"
            d={path}
            fill="none"
            key={path}
            pathLength="1"
            stroke="#2F7D3B"
            strokeDasharray="0.24 0.1"
            strokeLinecap="round"
            strokeWidth="5"
          />
        ))}
        {presentationId === "mutter" && [207, 224, 241].map((x, index) => (
          <circle
            className="bubble-effect-mutter-dot"
            cx={x}
            cy={151 - index * 2}
            fill="#2F7D3B"
            key={x}
            r={5.6 - index * 0.4}
            stroke="#F1C94C"
            strokeWidth="1.8"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        ))}

        {presentationId === "exclaim" && exclaimSpeedLines.map((path, index) => (
          <motion.path
            animate={{ opacity: [0, 0.82, 0.82, 0], pathLength: [0, 1, 1, 0] }}
            className="bubble-effect-speed-line"
            d={path}
            fill="none"
            key={path}
            stroke="#C94E3B"
            strokeLinecap="square"
            strokeWidth="5"
            transition={pathTransition(index * 0.045, 3.2)}
          />
        ))}

        {presentationId === "announce" && [
          "M112 78 Q138 105 112 132",
          "M123 63 Q164 105 123 147",
          "M135 48 Q190 105 135 162",
        ].map((path, index) => (
          <motion.path
            animate={{ opacity: [0, 0.74, 0.52, 0], pathLength: [0, 1, 1, 1] }}
            className="bubble-effect-broadcast"
            d={path}
            fill="none"
            key={path}
            stroke="#C58A16"
            strokeLinecap="round"
            strokeWidth="4"
            transition={{ delay: index * 0.18, duration: 1.05, ease: "easeOut", repeat: Infinity, repeatDelay: 3.5 }}
          />
        ))}

        {presentationId === "grandiose" && (
          <>
            {grandioseGoldDust.map((particle) => (
              <motion.circle
                animate={{
                  cx: [particle.x, particle.x + 4, particle.x - 2],
                  cy: [particle.y + 4, particle.y - 5, particle.y - 11],
                  opacity: [0.16, 0.82, 0.38, 0.16],
                  r: [particle.r * 0.62, particle.r, particle.r * 0.72],
                }}
                className="bubble-effect-gold-dust"
                cx={particle.x}
                cy={particle.y}
                fill="#F1C94C"
                key={`${particle.x}-${particle.y}`}
                r={particle.r}
                transition={{ delay: particle.delay, duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.35 }}
              />
            ))}
            {grandioseGlints.map((glint) => (
              <motion.path
                animate={{ opacity: [0.28, 1, 0.56, 0.28], rotate: [0, 45, 90, 135], scale: [0.62, 1.24, 0.82, 0.62] }}
                className="bubble-effect-glint"
                d={`M ${glint.x} ${glint.y - glint.size} L ${glint.x + glint.size * 0.28} ${glint.y - glint.size * 0.28} L ${glint.x + glint.size} ${glint.y} L ${glint.x + glint.size * 0.28} ${glint.y + glint.size * 0.28} L ${glint.x} ${glint.y + glint.size} L ${glint.x - glint.size * 0.28} ${glint.y + glint.size * 0.28} L ${glint.x - glint.size} ${glint.y} L ${glint.x - glint.size * 0.28} ${glint.y - glint.size * 0.28} Z`}
                fill={glint.color}
                key={`${glint.x}-${glint.y}`}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                transition={{ delay: glint.delay, duration: 1.05, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.55 }}
              />
            ))}
          </>
        )}
      </g>
    </svg>
  );
}

const screenMotion = {
  initial: { opacity: 0, y: 22, scale: 0.985, rotate: -0.35 },
  animate: { opacity: 1, y: 0, scale: 1, rotate: 0 },
  exit: { opacity: 0, y: -18, scale: 0.985, rotate: 0.35 },
  transition: { duration: 0.34, ease: "easeOut" },
} as const;

const cardTap = { scale: 0.975, rotate: -0.4 };
const cardHover = { y: -3, rotate: 0.15 };
const roomSendVerbs: Record<string, string> = {
  "after-school": "Send",
  "battle-rooftop": "Reveal",
  "quiet-alley": "Whisper",
  "ramen-stand": "Serve",
};
const timestampGapMinutes = 5;
const messageTemplateAssetVersion = "2026-06-20-profile-dot-cleanup";

type MessageEntryMotion = {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  transition: Transition;
};

function getMessageEntryMotion(shouldReduceMotion: boolean, isOwnMessage: boolean): MessageEntryMotion {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.18, ease: "easeOut" },
    };
  }

  return {
    initial: { opacity: 0, x: isOwnMessage ? 7 : -7, y: 4 },
    animate: { opacity: 1, x: 0, y: 0 },
    transition: { duration: 0.22, ease: "easeOut" },
  };
}

function getTimeMinutes(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  if (!meridiem) {
    return hour * 60 + minute;
  }

  const hour24 = (hour % 12) + (meridiem === "PM" ? 12 : 0);
  return hour24 * 60 + minute;
}

function shouldShowTimestamp(message: ChatMessage, previousMessage?: ChatMessage) {
  if (!previousMessage) {
    return true;
  }

  const currentMinutes = getTimeMinutes(message.time);
  const previousMinutes = getTimeMinutes(previousMessage.time);

  if (currentMinutes === null || previousMinutes === null) {
    return message.time !== previousMessage.time;
  }

  const sameDayGap = Math.abs(currentMinutes - previousMinutes);
  const wrappedGap = 24 * 60 - sameDayGap;
  return Math.min(sameDayGap, wrappedGap) >= timestampGapMinutes;
}

function mergeRoomMessages(currentMessages: ChatMessage[], roomId: string, roomMessages: ChatMessage[]) {
  return [...currentMessages.filter((message) => message.roomId !== roomId), ...roomMessages];
}

function appendMessageIfNew(currentMessages: ChatMessage[], message: ChatMessage) {
  if (currentMessages.some((currentMessage) => currentMessage.id === message.id)) {
    return currentMessages;
  }

  return [...currentMessages, message];
}

export default function Home() {
  const shouldReduceMotion = useReducedMotion();
  const [appStep, setAppStep] = useState<AppStep>("login");
  const [rooms, setRooms] = useState(catalogRooms);
  const [avatarsByRoom, setAvatarsByRoom] = useState(catalogAvatarsByRoom);
  const [membersByRoom, setMembersByRoom] = useState<Record<string, KokoroePublicUser[]>>({});
  const [selectedRoomId, setSelectedRoomId] = useState(catalogRooms[0].id);
  const [selectedAvatarIds, setSelectedAvatarIds] = useState<Record<string, string>>(initialAvatarSelections);
  const [loginArtIndex, setLoginArtIndex] = useState(0);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [privacyAgreementAccepted, setPrivacyAgreementAccepted] = useState(false);
  const [draft, setDraft] = useState("");
  const [memberAccountIdentifier, setMemberAccountIdentifier] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<KokoroePublicUser[]>([]);
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [classifierPolicy, setClassifierPolicy] = useState<MessageClassifierPolicy>(disabledClassifierPolicy);
  const [cloudClassificationConsent, setCloudClassificationConsent] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [apiError, setApiError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [revealedProfileMessageId, setRevealedProfileMessageId] = useState<string | null>(null);
  const [hoveredEffectMessageId, setHoveredEffectMessageId] = useState<string | null>(null);
  const [transitionBurst, setTransitionBurst] = useState<{ id: number; to: AppStep } | null>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef<AppStep>(appStep);
  const previousAutoScrollRoomRef = useRef(selectedRoomId);
  const shouldStickToBottomRef = useRef(true);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? rooms[0],
    [rooms, selectedRoomId],
  );

  const roomAvatars = avatarsByRoom[selectedRoom.id] ?? catalogAvatarsByRoom[selectedRoom.id] ?? [];
  const selectedAvatarId = selectedAvatarIds[selectedRoom.id] ?? roomAvatars[0].id;

  const selectedAvatar = useMemo(
    () => roomAvatars.find((avatar) => avatar.id === selectedAvatarId) ?? roomAvatars[0],
    [roomAvatars, selectedAvatarId],
  );

  const joinedRoomIds = useMemo(() => {
    if (!currentUserId) {
      return new Set<string>();
    }

    return new Set(
      Object.entries(membersByRoom)
        .filter(([, accounts]) => accounts.some((account) => account.id === currentUserId))
        .map(([roomId]) => roomId),
    );
  }, [currentUserId, membersByRoom]);

  const accessibleRooms = useMemo(
    () => rooms.filter((room) => joinedRoomIds.has(room.id)),
    [joinedRoomIds, rooms],
  );

  const publicRoomSearchResults = useMemo(() => {
    const query = roomSearchQuery.trim().toLowerCase();

    if (query.length < 2) {
      return [];
    }

    return rooms
      .filter((room) => room.visibility === "public" && !joinedRoomIds.has(room.id))
      .filter((room) => (
        room.name.toLowerCase().includes(query) ||
        room.description.toLowerCase().includes(query) ||
        room.theme.toLowerCase().includes(query) ||
        room.mood.toLowerCase().includes(query)
      ));
  }, [joinedRoomIds, roomSearchQuery, rooms]);

  const isSelectedRoomJoined = joinedRoomIds.has(selectedRoom.id);
  const isClassifierCanaryRoom = classifierPolicy.enabled && classifierPolicy.canaryRoomIds.includes(selectedRoom.id);
  const activeLoginArt = loginSceneArts[loginArtIndex];
  const activeScreenMotion = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.01 },
      }
    : screenMotion;
  const sendVerb = roomSendVerbs[selectedRoom.id] ?? "Send";

  function updateCloudClassificationConsent(consented: boolean) {
    setCloudClassificationConsent(consented);
    window.sessionStorage.setItem(CLOUD_STYLE_CONSENT_STORAGE_KEY, consented ? "enabled" : "disabled");
  }

  function applyProfile(profile: { currentRoomId: string; selectedAvatarIds: Record<string, string> }) {
    setSelectedRoomId(profile.currentRoomId);
    setSelectedAvatarIds((currentSelections) => ({
      ...currentSelections,
      ...profile.selectedAvatarIds,
    }));
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError("");

    if (!privacyAgreementAccepted) {
      setApiError("Read and accept the Privacy Policy before entering Kokoroe.");
      return;
    }

    setIsLoggingIn(true);

    try {
      const name = displayName.trim();
      const authenticate = authMode === "create" ? createAccountSession : createLoginSession;
      const result = await authenticate({
        displayName: name || undefined,
        password,
        usernameOrEmail: name || undefined,
      });

      setDisplayName(result.user.displayName);
      setCurrentUserId(result.user.id);
      setSessionId(result.session.id);
      window.sessionStorage.setItem(
        CLOUD_STYLE_CONSENT_STORAGE_KEY,
        cloudClassificationConsent ? "enabled" : "disabled",
      );
      applyProfile(result.user.profile);
      await refreshRooms();
      setAppStep("scene");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function chooseRoom(roomId: string) {
    setIsMembersOpen(false);
    setIsMemberFormOpen(false);
    setMemberError("");
    setMemberSearchResults([]);
    setRevealedProfileMessageId(null);
    setRoomSearchQuery("");
    setSelectedRoomId(roomId);
  }

  function chooseRoomFromChat(roomId: string) {
    if (!joinedRoomIds.has(roomId)) {
      setApiError("Join that room before entering it.");
      setAppStep("scene");
      return;
    }

    setIsMembersOpen(false);
    setIsMemberFormOpen(false);
    setMemberError("");
    setMemberSearchResults([]);
    setRevealedProfileMessageId(null);
    setSelectedRoomId(roomId);
    void saveProfile({ currentRoomId: roomId });
  }

  function chooseAvatar(avatarId: string) {
    setSelectedAvatarIds((currentSelections) => ({
      ...currentSelections,
      [selectedRoom.id]: avatarId,
    }));
    void saveProfile({ selectedAvatarIds: { [selectedRoom.id]: avatarId } });
  }

  async function refreshRooms() {
    const [roomPayload, policy] = await Promise.all([
      fetchRooms(),
      fetchMessageClassifierPolicy().catch(() => disabledClassifierPolicy),
    ]);
    setRooms(roomPayload.rooms);
    setAvatarsByRoom(roomPayload.avatarsByRoom);
    setMembersByRoom(roomPayload.membersByRoom);
    setClassifierPolicy(policy);
  }

  async function saveProfile(update: { currentRoomId?: string; selectedAvatarIds?: Record<string, string> }) {
    if (!sessionId) {
      return;
    }

    try {
      const profile = await patchProfile({ sessionId, ...update });
      applyProfile(profile);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Profile failed to save.");
    }
  }

  function enterChatWithAvatar() {
    if (!isSelectedRoomJoined) {
      setApiError(`Join ${selectedRoom.name} before entering it.`);
      return;
    }

    void saveProfile({ currentRoomId: selectedRoom.id });
    setAppStep("chat");
  }

  async function joinSelectedRoom() {
    if (!sessionId || isJoiningRoom) {
      return;
    }

    setApiError("");
    setIsJoiningRoom(true);

    try {
      const result = await postRoomJoin({
        roomId: selectedRoom.id,
        sessionId,
      });

      setMembersByRoom(result.membersByRoom);
      applyProfile(result.profile);
      setRoomSearchQuery("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Room join failed.");
    } finally {
      setIsJoiningRoom(false);
    }
  }

  function returnToLogin() {
    setApiError("");
    setAuthMode("login");
    setAppStep("login");
  }

  async function logout() {
    setApiError("");

    try {
      await logoutSession();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Logout failed.");
    } finally {
      setSessionId(undefined);
      setCurrentUserId(undefined);
      setPassword("");
      setPrivacyAgreementAccepted(false);
      setDraft("");
      setMemberAccountIdentifier("");
      setMemberSearchResults([]);
      setRoomSearchQuery("");
      setMessages([]);
      setCloudClassificationConsent(false);
      window.sessionStorage.removeItem(CLOUD_STYLE_CONSENT_STORAGE_KEY);
      setClassifierPolicy(disabledClassifierPolicy);
      setIsMemberFormOpen(false);
      setMemberError("");
      setRevealedProfileMessageId(null);
      setSelectedRoomId(catalogRooms[0].id);
      setSelectedAvatarIds(initialAvatarSelections);
      returnToLogin();
    }
  }

  async function submitDraftLine() {
    const text = draft.trim();

    if (!text || isSending) {
      return;
    }

    setApiError("");
    setIsSending(true);
    shouldStickToBottomRef.current = true;

    try {
      const message = await postRoomMessage({
        sessionId,
        roomId: selectedRoom.id,
        avatarId: selectedAvatar.id,
        cloudClassificationConsent: isClassifierCanaryRoom && cloudClassificationConsent,
        text,
        tone: getDebugPresentationId(text) ?? getRandomPresentationId(text),
      });

      setMessages((currentMessages) => [...currentMessages, message]);
      setDraft("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Message failed to send.");
    } finally {
      setIsSending(false);
    }
  }

  async function sendLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitDraftLine();
  }

  function sendLineOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    event.preventDefault();
    void submitDraftLine();
  }

  async function addRoomMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accountIdentifier = memberAccountIdentifier.trim();

    if (!accountIdentifier || isAddingMember) {
      return;
    }

    setMemberError("");
    setApiError("");
    setIsAddingMember(true);

    try {
      const result = await postRoomMember({
        accountIdentifier,
        roomId: selectedRoom.id,
        sessionId,
      });

      setMembersByRoom(result.membersByRoom);
      setMemberAccountIdentifier("");
      setMemberSearchResults([]);
      setIsMemberFormOpen(false);
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : "Member could not be added.");
    } finally {
      setIsAddingMember(false);
    }
  }

  const roomMessages = messages.filter((message) => message.roomId === selectedRoom.id);

  const accountMessageCounts = useMemo(
    () =>
      roomMessages.reduce<Record<string, number>>((messageCounts, message) => {
        if (message.userId) {
          messageCounts[message.userId] = (messageCounts[message.userId] ?? 0) + 1;
        }

        return messageCounts;
      }, {}),
    [roomMessages],
  );

  const roomAccounts = membersByRoom[selectedRoom.id] ?? [];

  useEffect(() => {
    const query = memberAccountIdentifier.trim();

    if (!isMemberFormOpen || query.length < 2 || !sessionId) {
      setMemberSearchResults([]);
      setIsSearchingMembers(false);
      return;
    }

    let isCurrent = true;
    setIsSearchingMembers(true);

    const searchTimer = window.setTimeout(() => {
      searchRoomMemberAccounts({
        query,
        roomId: selectedRoom.id,
        sessionId,
      })
        .then((accounts) => {
          if (isCurrent) {
            setMemberSearchResults(accounts);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setMemberSearchResults([]);
          }
        })
        .finally(() => {
          if (isCurrent) {
            setIsSearchingMembers(false);
          }
        });
    }, 180);

    return () => {
      isCurrent = false;
      window.clearTimeout(searchTimer);
    };
  }, [isMemberFormOpen, memberAccountIdentifier, selectedRoom.id, sessionId]);

  function getMessageAvatar(message: ChatMessage) {
    return roomAvatars.find((avatar) => avatar.id === message.avatarId || avatar.name === message.author);
  }

  function getMessageAccount(message: ChatMessage) {
    return message.userId ? roomAccounts.find((account) => account.id === message.userId) : undefined;
  }

  function getAvatarStyle(avatar: typeof selectedAvatar) {
    return {
      "--avatar-accent": avatar.accentColor,
      "--thumbnail-crop": `translate(${avatar.thumbnail.x}%, ${avatar.thumbnail.y}%) scale(${avatar.thumbnail.scale})`,
    } as React.CSSProperties;
  }

  function getAccountAvatar(account: KokoroePublicUser) {
    const avatarId = account.profile.selectedAvatarIds[selectedRoom.id];
    return roomAvatars.find((avatar) => avatar.id === avatarId) ?? roomAvatars[0];
  }

  function getAccountIdentifier(account: KokoroePublicUser) {
    return account.email ?? account.username ?? account.displayName;
  }

  function toggleMessageProfile(messageId: string) {
    setRevealedProfileMessageId((currentMessageId) => (currentMessageId === messageId ? null : messageId));
  }

  useEffect(() => {
    if (appStep !== "login") {
      requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
    }
  }, [appStep]);

  useEffect(() => {
    if (isRestoringSession || shouldReduceMotion) {
      previousStepRef.current = appStep;
      return;
    }

    if (previousStepRef.current === appStep) {
      return;
    }

    previousStepRef.current = appStep;
    const burst = { id: Date.now(), to: appStep };
    setTransitionBurst(burst);

    const timer = window.setTimeout(() => {
      setTransitionBurst((currentBurst) => (currentBurst?.id === burst.id ? null : currentBurst));
    }, 1750);

    return () => window.clearTimeout(timer);
  }, [appStep, isRestoringSession, shouldReduceMotion]);

  useEffect(() => {
    let isCurrent = true;

    refreshRooms().catch((error) => {
      if (isCurrent) {
        setApiError(error instanceof Error ? error.message : "Could not load rooms.");
      }
    });

    fetchCurrentSession()
      .then((result) => {
        if (!isCurrent || !result) {
          return;
        }

        setDisplayName(result.user.displayName);
        setCurrentUserId(result.user.id);
        setSessionId(result.session.id);
        setCloudClassificationConsent(
          window.sessionStorage.getItem(CLOUD_STYLE_CONSENT_STORAGE_KEY) === "enabled",
        );
        applyProfile(result.user.profile);
        setAppStep("scene");
      })
      .catch(() => {
        if (isCurrent) {
          setSessionId(undefined);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsRestoringSession(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (appStep !== "chat") {
      return;
    }

    if (!isSelectedRoomJoined) {
      setApiError(`Join ${selectedRoom.name} before entering it.`);
      setAppStep("scene");
    }
  }, [appStep, isSelectedRoomJoined, selectedRoom.name]);

  useEffect(() => {
    if (appStep !== "chat" || !sessionId || !isSelectedRoomJoined) {
      return;
    }

    const roomChanged = previousAutoScrollRoomRef.current !== selectedRoomId;
    previousAutoScrollRoomRef.current = selectedRoomId;

    if (roomChanged) {
      shouldStickToBottomRef.current = true;
    }

    if (!shouldStickToBottomRef.current) {
      return;
    }

    const scrollFrame = window.requestAnimationFrame(() => {
      const messageScroll = messageScrollRef.current;

      if (messageScroll) {
        messageScroll.scrollTop = messageScroll.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(scrollFrame);
  }, [appStep, isSelectedRoomJoined, roomMessages.length, selectedRoomId, sessionId]);

  useEffect(() => {
    if (!sessionId || !isSelectedRoomJoined) {
      setIsLoadingMessages(false);
      return;
    }

    let isCurrent = true;

    setApiError("");
    setIsLoadingMessages(true);

    fetchRoomMessages(selectedRoom.id, sessionId)
      .then((roomMessagePayload) => {
        if (!isCurrent) {
          return;
        }

        setMessages((currentMessages) => mergeRoomMessages(currentMessages, selectedRoom.id, roomMessagePayload));
      })
      .catch((error) => {
        if (isCurrent) {
          setApiError(error instanceof Error ? error.message : "Could not load room messages.");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingMessages(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isSelectedRoomJoined, selectedRoom.id, sessionId]);

  useEffect(() => {
    if (appStep !== "chat") {
      return;
    }

    const channel = subscribeToRoomMessages(selectedRoom.id, (message) => {
      setMessages((currentMessages) => appendMessageIfNew(currentMessages, message));
    });

    return () => {
      void channel?.unsubscribe();
    };
  }, [appStep, selectedRoom.id]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let isCurrent = true;

    fetchProfile(sessionId)
      .then((profile) => {
        if (isCurrent) {
          applyProfile(profile);
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setApiError(error instanceof Error ? error.message : "Could not load profile.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (appStep !== "login") {
      return;
    }

    const artTimer = window.setInterval(() => {
      setLoginArtIndex((currentIndex) => (currentIndex + 1) % loginSceneArts.length);
    }, 4500);

    return () => window.clearInterval(artTimer);
  }, [appStep]);

  const worldJumpTransition = (
    <AnimatePresence>
      {transitionBurst ? (
        <motion.div
          aria-hidden="true"
          className="world-jump-transition"
          data-step={transitionBurst.to}
          exit={{ opacity: 0 }}
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 1, 1, 0] }}
          key={transitionBurst.id}
          transition={{ duration: 1.58, times: [0, 0.76, 0.9, 1], ease: "easeOut" }}
        >
          <span className="isekai-scene-sequence">
            {transitionFrameIndexes.map((frameIndex) => (
              <span className="isekai-scene-frame" key={frameIndex} />
            ))}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (appStep === "chat") {
    return (
      <main className="kokoroe-shell chat-shell">
        <div className="paper-grain" aria-hidden="true" />
        {worldJumpTransition}
        <motion.section
          {...activeScreenMotion}
          className="chat-stage"
          aria-label={`${selectedRoom.name} chat scene`}
          key="chat"
        >
          <motion.aside
            key="chat-navigation"
            className="scene-nav ink-panel"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.08, duration: shouldReduceMotion ? 0.01 : 0.32 }}
          >
            <div key="chat-brand">
              <div className="nav-brand-row">
                <h1>Kokoroe</h1>
              </div>
              <span className="panel-kicker">Worlds</span>
            </div>

            <div className="scene-buttons" key="chat-rooms">
              {accessibleRooms.map((room) => (
                <motion.button
                  aria-current={room.id === selectedRoomId ? "true" : undefined}
                  className="scene-button"
                  data-selected={room.id === selectedRoomId}
                  key={room.id}
                  layout={!shouldReduceMotion}
                  onClick={() => chooseRoomFromChat(room.id)}
                  whileHover={shouldReduceMotion ? undefined : cardHover}
                  whileTap={shouldReduceMotion ? undefined : cardTap}
                  style={
                    {
                      "--accent": room.accentColor,
                      "--room-wash": room.washColor,
                    } as React.CSSProperties
                  }
                  type="button"
                >
                  <img alt="" aria-hidden="true" className="scene-button-image" key="room-image" src={room.previewImage} />
                  <strong key="room-name">{room.name}</strong>
                  <span key="room-theme">{room.theme}</span>
                </motion.button>
              ))}
            </div>

            <div className="nav-actions">
              <button
                aria-label={getWorldCopyAriaLabel("navigation.setup.return")}
                className="portal-return"
                data-cursor-intent="action"
                key="chat-back"
                onClick={() => setAppStep("scene")}
                type="button"
              >
                {getWorldCopy("navigation.setup.return")}
              </button>
              {classifierPolicy.enabled ? (
                <button
                  aria-label={getWorldCopyAriaLabel("navigation.bubbleStyle.toggle")}
                  aria-pressed={cloudClassificationConsent}
                  className="ai-style-toggle"
                  data-enabled={cloudClassificationConsent}
                  key="chat-ai-style"
                  onClick={() => updateCloudClassificationConsent(!cloudClassificationConsent)}
                  type="button"
                >
                  {getWorldCopy("navigation.bubbleStyle.toggle", {
                    variant: cloudClassificationConsent ? "on" : "default",
                  })}
                </button>
              ) : null}
              <button
                aria-label={getWorldCopyAriaLabel("navigation.story.leave")}
                className="portal-return"
                key="chat-logout"
                onClick={logout}
                type="button"
              >
                {getWorldCopy("navigation.story.leave")}
              </button>
            </div>
          </motion.aside>

          <motion.div
            key="chat-panel"
            className="chat-panel ink-panel"
            data-room={selectedRoom.id}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.12, duration: shouldReduceMotion ? 0.01 : 0.34 }}
            style={
              {
                "--accent": selectedRoom.accentColor,
                "--room-wash": selectedRoom.washColor,
                "--avatar-accent": selectedAvatar.accentColor,
                "--thumbnail-crop": `translate(${selectedAvatar.thumbnail.x}%, ${selectedAvatar.thumbnail.y}%) scale(${selectedAvatar.thumbnail.scale})`,
              } as React.CSSProperties
            }
          >
            <span className="room-atmosphere" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {selectedRoom.id === "battle-rooftop" && (
              <span className="crimson-petal-field" aria-hidden="true">
                {crimsonPetals.map((petal) => (
                  <i
                    key={petal.id}
                    style={
                      {
                        "--petal-delay": petal.delay,
                        "--petal-drift": petal.drift,
                        "--petal-duration": petal.duration,
                        "--petal-flutter": petal.flutter,
                        "--petal-fall": petal.fall,
                        "--petal-rotate": petal.rotate,
                        "--petal-size": petal.size,
                        "--petal-x": petal.x,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
            )}
            <header className="chat-heading" key="chat-heading">
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="scene-hero"
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.55, scale: 1.025 }}
                key={`${selectedRoom.id}-scene-hero`}
                transition={{ duration: shouldReduceMotion ? 0.01 : 0.28, ease: "easeOut" }}
                aria-hidden="true"
              >
                <img
                  alt=""
                  className="scene-hero-image"
                  src={selectedRoom.sceneImage}
                  style={{ objectPosition: selectedRoom.scenePosition }}
                />
              </motion.div>
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="chat-heading-copy"
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
                key={`${selectedRoom.id}-heading-copy`}
                transition={{ duration: shouldReduceMotion ? 0.01 : 0.24, ease: "easeOut" }}
              >
                <span>{selectedRoom.theme}</span>
                <h2>{selectedRoom.name}</h2>
              </motion.div>
              <p>
                {selectedRoom.description} <strong>{selectedRoom.motif}</strong>
              </p>
              <button
                aria-controls="room-cast-panel"
                aria-expanded={isMembersOpen}
                className="members-toggle"
                onClick={() => setIsMembersOpen((currentState) => !currentState)}
                type="button"
              >
                Members
                <span>{roomAccounts.length}</span>
              </button>
            </header>

            <AnimatePresence>
              {isMembersOpen ? (
                <motion.aside
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  className="members-window"
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, rotate: 0.4 }}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, rotate: -0.4 }}
                  key="members-window"
                  id="room-cast-panel"
                  transition={{ duration: shouldReduceMotion ? 0.01 : 0.2, ease: "easeOut" }}
                >
                  <div className="members-window-heading">
                    <span>Room Cast</span>
                    <strong>{selectedRoom.name}</strong>
                  </div>
                  <button
                    className="member-add-toggle"
                    onClick={() => {
                      setMemberError("");
                      setIsMemberFormOpen((currentState) => !currentState);
                    }}
                    type="button"
                  >
                    {isMemberFormOpen ? "Close Add Panel" : "Add Member"}
                  </button>
                  <AnimatePresence initial={false}>
                    {isMemberFormOpen ? (
                      <motion.form
                        animate={{ opacity: 1, y: 0 }}
                        className="member-add-form"
                        exit={{ opacity: 0, y: -6 }}
                        initial={{ opacity: 0, y: -6 }}
                        key="member-add-form"
                        onSubmit={addRoomMember}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      >
                        <label>
                          Account
                          <input
                            aria-describedby={memberError ? "member-add-error" : undefined}
                            aria-invalid={memberError ? true : undefined}
                            maxLength={80}
                            onChange={(event) => {
                              setMemberError("");
                              setMemberAccountIdentifier(event.target.value);
                            }}
                            placeholder="username or email"
                            value={memberAccountIdentifier}
                          />
                        </label>
                        <div className="member-search-results" aria-live="polite">
                          {isSearchingMembers ? <span className="member-search-note">Searching accounts...</span> : null}
                          {!isSearchingMembers && memberAccountIdentifier.trim().length >= 2 && memberSearchResults.length === 0 ? (
                            <span className="member-search-note">No matching account yet.</span>
                          ) : null}
                          {memberSearchResults.map((account) => {
                            const accountAvatar = getAccountAvatar(account);
                            const accountIdentifier = getAccountIdentifier(account);

                            return (
                              <button
                                className="member-search-hit"
                                key={account.id}
                                onClick={() => {
                                  setMemberError("");
                                  setMemberAccountIdentifier(accountIdentifier);
                                  setMemberSearchResults([]);
                                }}
                                style={accountAvatar ? getAvatarStyle(accountAvatar) : { "--avatar-accent": selectedRoom.accentColor } as React.CSSProperties}
                                type="button"
                              >
                                <span className="member-search-portrait">
                                  {accountAvatar ? <img alt="" src={accountAvatar.imageSrc} /> : account.displayName.slice(0, 1)}
                                </span>
                                <span>
                                  <strong>{account.displayName}</strong>
                                  <small>{account.username ? `@${account.username}` : account.email}</small>
                                  {account.email ? <em>{account.email}</em> : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {memberError ? <div className="member-error" id="member-add-error" role="alert">{memberError}</div> : null}
                        <button disabled={isAddingMember || !memberAccountIdentifier.trim()} type="submit">
                          {isAddingMember ? "Adding" : "Add Account"}
                        </button>
                      </motion.form>
                    ) : null}
                  </AnimatePresence>
                  <div className="member-list">
                    {roomAccounts.map((account) => {
                      const accountAvatar = getAccountAvatar(account);

                      return (
                      <div
                        className="member-card"
                        data-selected={account.id === currentUserId}
                        key={account.id}
                        style={accountAvatar ? getAvatarStyle(accountAvatar) : { "--avatar-accent": selectedRoom.accentColor } as React.CSSProperties}
                      >
                        <span className="member-portrait">
                          {accountAvatar ? <img alt="" src={accountAvatar.imageSrc} /> : account.displayName.slice(0, 1)}
                        </span>
                        <span className="member-copy">
                          <strong>{account.displayName}</strong>
                          <small>Account</small>
                          <em>{accountAvatar ? `as ${accountAvatar.name}` : "avatar not selected"}</em>
                        </span>
                        <span className="member-stat">
                          {accountMessageCounts[account.id] ?? 0}
                          <small>lines</small>
                        </span>
                      </div>
                      );
                    })}
                  </div>
                </motion.aside>
              ) : null}
            </AnimatePresence>

            <div
              aria-live="polite"
              aria-relevant="additions text"
              className="message-scroll"
              key="chat-messages"
              onScroll={(event) => {
                const messageScroll = event.currentTarget;
                const distanceFromBottom = messageScroll.scrollHeight - messageScroll.scrollTop - messageScroll.clientHeight;
                shouldStickToBottomRef.current = distanceFromBottom < 80;
              }}
              ref={messageScrollRef}
              role="log"
            >
              <img
                alt=""
                aria-hidden="true"
                className="message-scene-wash"
                src={selectedRoom.sceneImage}
                style={{ objectPosition: selectedRoom.scenePosition }}
              />
              {isLoadingMessages ? <div className="api-status">Loading panels...</div> : null}
              {apiError ? <div className="api-status" data-tone="error" role="alert">{apiError}</div> : null}
              <AnimatePresence initial={false}>
                {roomMessages.flatMap((message, index) => {
                  const isOwnMessage = message.userId
                    ? Boolean(currentUserId && message.userId === currentUserId)
                    : message.mine === true;
                  const messageAccount = getMessageAccount(message);
                  const messageAvatar = getMessageAvatar(message);
                  const presentationId = resolvePresentationId(message.text, message.tone);
                  const presentation = messagePresentations[presentationId];
                  const messageEntryMotion = getMessageEntryMotion(!!shouldReduceMotion, isOwnMessage);
                  const keepsEffectActive = shouldAutoRunPresentationEffect(
                    presentationId,
                    index,
                    roomMessages.length,
                  );
                  const isPresentationEffectActive = keepsEffectActive || hoveredEffectMessageId === message.id;
                  const messageNodes = [];

                  if (shouldShowTimestamp(message, roomMessages[index - 1])) {
                    messageNodes.push(
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className="message-time-divider"
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                        key={`${message.id}-time`}
                        transition={{ duration: shouldReduceMotion ? 0.01 : 0.22, ease: "easeOut" }}
                      >
                        <time>{message.time}</time>
                      </motion.div>,
                    );
                  }

                  messageNodes.push(
                    <motion.article
                      className="message-row"
                      data-mine={isOwnMessage ? "true" : "false"}
                      data-presentation={presentationId}
                      data-effect-mode={keepsEffectActive ? "ambient" : "hover"}
                      key={message.id}
                      initial={messageEntryMotion.initial}
                      animate={messageEntryMotion.animate}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                      onBlurCapture={() => setHoveredEffectMessageId(null)}
                      onFocusCapture={() => setHoveredEffectMessageId(message.id)}
                      onPointerEnter={() => setHoveredEffectMessageId(message.id)}
                      onPointerLeave={() => setHoveredEffectMessageId(null)}
                      transition={messageEntryMotion.transition}
                    >
                      <div
                        key="message-bubble"
                        className="message-stack"
                        style={
                          {
                            ...getBubbleFrameStyle(presentationId, message.text),
                          } as React.CSSProperties
                        }
                      >
                        <div
                          className="message-bubble"
                          data-mine={isOwnMessage ? "true" : "false"}
                          data-font-role={presentation.fontRole}
                          data-ink={presentation.ink}
                          data-motion={presentation.motion}
                          data-presentation={presentationId}
                          data-effect-active={isPresentationEffectActive && !shouldReduceMotion ? "true" : "false"}
                          data-scribble-motion={presentationId === "scribble" && !shouldReduceMotion ? "enabled" : "static"}
                        >
                          {presentationId === "sad" && !shouldReduceMotion && (
                            <span aria-hidden="true" className="sad-rain-rig">
                              {sadRainDrops.map((drop) => (
                                <i
                                  key={drop.id}
                                  style={
                                    {
                                      "--rain-delay": drop.delay,
                                      "--rain-duration": drop.duration,
                                      "--rain-length": drop.length,
                                      "--rain-opacity": drop.opacity,
                                      "--rain-x": drop.x,
                                      "--rain-y": drop.y,
                                    } as React.CSSProperties
                                  }
                                />
                              ))}
                            </span>
                          )}
                          <BubbleEffectRig
                            isActive={!shouldReduceMotion}
                            isOwnMessage={isOwnMessage}
                            presentationId={presentationId}
                            shouldReduceMotion={!!shouldReduceMotion}
                          />
                          {presentationId === "scribble" ? (
                            <>
                              <ScribbleBubbleShell shouldReduceMotion={!!shouldReduceMotion} />
                              <img
                                alt=""
                                aria-hidden="true"
                                className="bubble-template scribble-final-template"
                                src={`/message-templates/message-template-${presentation.shell}.svg?v=${messageTemplateAssetVersion}`}
                              />
                            </>
                          ) : (
                            <img
                              alt=""
                              aria-hidden="true"
                              className="bubble-template"
                              src={`/message-templates/message-template-${presentation.shell}.svg?v=${messageTemplateAssetVersion}`}
                            />
                          )}
                          <p key="message-text"><span>{message.text}</span></p>
                        </div>
                        <div className="speaker-anchor">
                          <button
                            aria-expanded={revealedProfileMessageId === message.id}
                            aria-label={`View profile for ${messageAccount?.displayName ?? message.author}`}
                            className="message-avatar"
                            data-cursor-intent="inspect"
                            key="message-avatar"
                            onClick={() => toggleMessageProfile(message.id)}
                            style={messageAvatar ? getAvatarStyle(messageAvatar) : { "--avatar-accent": selectedRoom.accentColor } as React.CSSProperties}
                            type="button"
                          >
                            {messageAvatar ? <img alt="" src={messageAvatar.imageSrc} /> : message.author.slice(0, 1)}
                          </button>
                          <AnimatePresence>
                            {revealedProfileMessageId === message.id && (
                              <motion.div
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="message-profile"
                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -4 }}
                                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -4 }}
                                key="profile-reveal"
                                transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
                              >
                                <strong>{isOwnMessage ? "You" : messageAccount?.displayName ?? message.author}</strong>
                                {messageAccount ? (
                                  <small>{messageAccount.username ? `@${messageAccount.username}` : messageAccount.email ?? "Account"}</small>
                                ) : null}
                                <span>{messageAvatar ? `${messageAvatar.name} - ${messageAvatar.signature}` : message.author}</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.article>,
                  );

                  return messageNodes;
                })}
              </AnimatePresence>
            </div>

            <form className="chat-composer" key="chat-composer" onSubmit={sendLine}>
              <div className="composer-identity" aria-hidden="true">
                <div className="composer-avatar">
                  <img alt="" src={selectedAvatar.imageSrc} />
                </div>
                <b>{selectedAvatar.name}</b>
              </div>
              <div className="composer-status" aria-live="polite">
                <span aria-hidden="true" />
                <strong>Live panel</strong>
                <em>{selectedRoom.name}</em>
              </div>
              <label className="composer-dialogue-frame">
                <span className="composer-label-row">
                  <span><b>{sendVerb}</b> a line</span>
                  <em data-near-limit={draft.length >= 96}>{draft.length}/{MESSAGE_CHARACTER_LIMIT}</em>
                </span>
                <span className="composer-input-shell">
                  <textarea
                    data-cursor-intent="write"
                    maxLength={MESSAGE_CHARACTER_LIMIT}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={sendLineOnEnter}
                    placeholder={`Write something for ${selectedRoom.name}`}
                    rows={3}
                    value={draft}
                  />
                </span>
              </label>
              <button
                className="composer-send-action"
                data-cursor-intent="action"
                disabled={isSending}
                type="submit"
              >
                {isSending ? "Sending" : sendVerb}
              </button>
            </form>
          </motion.div>
        </motion.section>
      </main>
    );
  }

  return (
    <main className="kokoroe-shell">
      <div className="paper-grain" aria-hidden="true" />
      {appStep === "scene" ? (
        <img
          alt=""
          aria-hidden="true"
          className="world-outer-backdrop"
          src={selectedRoom.sceneImage}
          style={{ objectPosition: selectedRoom.scenePosition }}
        />
      ) : null}
      {worldJumpTransition}
      <AnimatePresence mode="wait">
      {isRestoringSession ? null : appStep === "login" ? (
        <motion.section
          {...activeScreenMotion}
          className="login-page ink-panel"
          aria-label="Kokoroe login"
          key="login"
        >
          <div className="login-art-panel" key="login-art" aria-label={`${activeLoginArt.name} preview`}>
            {loginSceneArts.map((art, index) => (
              <img
                alt=""
                aria-hidden={index !== loginArtIndex}
                className="login-cycle-image"
                data-active={index === loginArtIndex}
                key={art.id}
                src={art.src}
              />
            ))}

            <div className="login-hero-logo">
              <img alt="Kokoroe" src="/brand/kokoroe-logo-wordmark.svg" />
            </div>

            <div className="login-scene-meta">
              <span>Current scene</span>
              <strong>{activeLoginArt.name}</strong>
            </div>

            <div className="login-scene-dots" aria-label="Choose a login scene" role="group">
              {loginSceneArts.map((art, index) => (
                <button
                  aria-label={art.name}
                  aria-pressed={index === loginArtIndex}
                  key={art.id}
                  onClick={() => setLoginArtIndex(index)}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className="login-form-panel" key="login-form-panel">
            <form className="entry-form login-form" onSubmit={submitLogin}>
              <header className="login-intro">
                <span>
                  {authMode === "create"
                    ? getWorldCopy("auth.create.eyebrow")
                    : getWorldCopy("auth.login.eyebrow")}
                </span>
                <h1>
                  {authMode === "create"
                    ? getWorldCopy("auth.create.title")
                    : getWorldCopy("auth.login.title")}
                </h1>
                <p>
                  {authMode === "create"
                    ? getWorldCopy("auth.create.body")
                    : getWorldCopy("auth.login.body")}
                </p>
              </header>

              <div className="login-fields">
                <label className="login-field-shell">
                  <span>Username or email</span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoCapitalize="none"
                    autoComplete="username"
                    autoCorrect="off"
                    placeholder="Enter your username or email"
                    spellCheck={false}
                  />
                </label>
                <label className="login-field-shell">
                  <span>Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={authMode === "create" ? "new-password" : "current-password"}
                    placeholder={authMode === "create" ? "At least 8 characters" : "Enter your password"}
                  />
                </label>
              </div>

              {authMode === "login" ? (
                <a className="forgot-link" href="#login">
                  Forgot password?
                </a>
              ) : null}

              <section className="login-consent-panel" aria-labelledby="login-consent-heading">
                <header>
                  <h2 id="login-consent-heading">Before you continue</h2>
                  <span>{classifierPolicy.enabled ? "One required · one optional" : "One required agreement"}</span>
                </header>
                <div className="login-consent-stack">
                  <label className="login-consent-row" data-kind="policy">
                    <input
                      checked={privacyAgreementAccepted}
                      onChange={(event) => setPrivacyAgreementAccepted(event.target.checked)}
                      required
                      type="checkbox"
                    />
                    <span>
                      <strong>Privacy agreement</strong>
                      <small>
                        I have read and agree to the <a href="/privacy" rel="noreferrer" target="_blank">Privacy Policy</a>
                        {` (version ${PRIVACY_POLICY_VERSION}).`}
                      </small>
                    </span>
                    <b>Required</b>
                  </label>
                  {classifierPolicy.enabled ? (
                    <label className="login-consent-row" data-kind="ai">
                      <input
                        checked={cloudClassificationConsent}
                        onChange={(event) => setCloudClassificationConsent(event.target.checked)}
                        type="checkbox"
                      />
                      <span>
                        <strong>AI bubble styling</strong>
                        <small>
                          Send each opted-in line and bounded anonymous room context to OpenRouter to choose a bubble style.
                          Your words are not rewritten. You can switch this off in chat.
                        </small>
                      </span>
                      <b>Optional</b>
                    </label>
                  ) : null}
                </div>
              </section>

              {apiError ? <div className="api-status login-api-status" data-tone="error" role="alert">{apiError}</div> : null}

              <button
                aria-label={getWorldCopyAriaLabel(
                  authMode === "create" ? "auth.create.submit" : "auth.login.submit",
                )}
                className="enter-button login-enter"
                data-cursor-intent="action"
                disabled={isLoggingIn || !privacyAgreementAccepted}
                type="submit"
              >
                {getWorldCopy(
                  authMode === "create" ? "auth.create.submit" : "auth.login.submit",
                  { variant: isLoggingIn ? "busy" : "default" },
                )}
              </button>

              <p className="login-switch-copy">
                {authMode === "login"
                  ? getWorldCopy("auth.switch.toCreate.prompt")
                  : getWorldCopy("auth.switch.toLogin.prompt")}
                <button
                  aria-label={getWorldCopyAriaLabel(
                    authMode === "login"
                      ? "auth.switch.toCreate.action"
                      : "auth.switch.toLogin.action",
                  )}
                  className="create-account-button"
                  onClick={() => {
                    setApiError("");
                    setAuthMode((currentMode) => (currentMode === "login" ? "create" : "login"));
                  }}
                  type="button"
                >
                  {authMode === "login"
                    ? getWorldCopy("auth.switch.toCreate.action")
                    : getWorldCopy("auth.switch.toLogin.action")}
                </button>
              </p>
            </form>
          </div>
        </motion.section>
      ) : null}

      {appStep === "scene" ? (
        <motion.section
          {...activeScreenMotion}
          className="scene-select-page ink-panel"
          aria-label="Choose your dream world and avatar"
          key="scene"
          style={
              {
                "--accent": selectedRoom.accentColor,
                "--room-wash": selectedRoom.washColor,
                "--avatar-accent": selectedAvatar.accentColor,
              } as React.CSSProperties
          }
        >
          <img
            alt=""
            aria-hidden="true"
            className="scene-select-backdrop"
            key="scene-select-backdrop"
            src={selectedRoom.sceneImage}
            style={{ objectPosition: selectedRoom.scenePosition }}
          />
          <div className="scene-select-header" key="scene-header">
            <div>
              <span className="panel-kicker">Scene Setup</span>
              <h1>Choose World + Avatar</h1>
              <p>Choose a dream world, then pick the character identity you&apos;ll carry into it.</p>
            </div>
            <div className="scene-tip" aria-hidden="true">
              <span>{selectedRoom.mood}</span>
            </div>
          </div>

          <div className="scene-setup-grid" key="scene-setup">
            <div className="scene-select-list" aria-label="Joined dream worlds">
              <div className="room-list-heading">
                <span>Joined Worlds</span>
                <small>{accessibleRooms.length} open</small>
              </div>
              {accessibleRooms.length === 0 ? (
                <div className="room-empty-note">Search public rooms to join your first world.</div>
              ) : null}
              {accessibleRooms.map((room, index) => (
                <motion.button
                  aria-pressed={room.id === selectedRoomId}
                  className="wide-scene-card"
                  data-cursor-intent="action"
                  data-selected={room.id === selectedRoomId}
                  key={room.id}
                  layout
                  onClick={() => chooseRoom(room.id)}
                  whileHover={cardHover}
                  whileTap={cardTap}
                  style={
                    {
                      "--accent": room.accentColor,
                      "--room-wash": room.washColor,
                    } as React.CSSProperties
                  }
                  type="button"
                >
                  <span className="scene-icon" key="world-number">0{index + 1}</span>
                  <span className="scene-copy" key="world-copy">
                    <strong>{room.name}</strong>
                    <small>{room.description}</small>
                    <em>{room.mood}</em>
                  </span>
                  <img
                    alt=""
                    aria-hidden="true"
                    className="scene-card-image"
                    key="world-art"
                    src={room.previewImage}
                    style={{ objectPosition: room.scenePosition }}
                  />
                  <span className="scene-arrow" key="world-arrow" aria-hidden="true">
                    →
                  </span>
                </motion.button>
              ))}
              <div className="room-search-panel">
                <label>
                  Find public rooms
                  <input
                    autoComplete="off"
                    onChange={(event) => setRoomSearchQuery(event.target.value)}
                    placeholder="Search by room, mood, or theme"
                    value={roomSearchQuery}
                  />
                </label>
                <div className="room-search-results" aria-live="polite">
                  {roomSearchQuery.trim().length > 0 && roomSearchQuery.trim().length < 2 ? (
                    <span className="room-search-note">Type at least 2 letters.</span>
                  ) : null}
                  {roomSearchQuery.trim().length >= 2 && publicRoomSearchResults.length === 0 ? (
                    <span className="room-search-note">No public room found.</span>
                  ) : null}
                  {publicRoomSearchResults.map((room) => (
                    <button
                      className="room-search-hit"
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      style={
                        {
                          "--accent": room.accentColor,
                          "--room-wash": room.washColor,
                        } as React.CSSProperties
                      }
                      type="button"
                    >
                      <img alt="" aria-hidden="true" src={room.previewImage} style={{ objectPosition: room.scenePosition }} />
                      <span>
                        <strong>{room.name}</strong>
                        <small>{room.theme}</small>
                        <em>{room.mood}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="setup-side-panel">
              <motion.div
                className="setup-world-card"
                key={selectedRoom.id}
                initial={{ opacity: 0, y: 10, rotate: -0.5 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.24 }}
              >
                <img
                  alt=""
                  aria-hidden="true"
                  className="setup-world-image"
                  key="selected-art"
                  src={selectedRoom.sceneImage}
                  style={{ objectPosition: selectedRoom.scenePosition }}
                />
                <span key="selected-theme">{selectedRoom.theme}</span>
                <strong key="selected-name">{selectedRoom.name}</strong>
                <p key="selected-motif">{selectedRoom.motif}</p>
              </motion.div>

              <div className="compact-avatar-panel">
                <h2>Choose Avatar</h2>
                <motion.div
                  className="selected-avatar-feature"
                  key={selectedAvatar.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={getAvatarStyle(selectedAvatar)}
                >
                  <span className="selected-avatar-portrait" key="selected-portrait">
                    <img alt="" src={selectedAvatar.imageSrc} />
                  </span>
                  <div key="selected-copy">
                    <span>Current identity</span>
                    <strong>{selectedAvatar.name}</strong>
                    <small>{selectedAvatar.description}</small>
                    <em>{selectedAvatar.signature}</em>
                  </div>
                </motion.div>
                <div className="compact-avatar-grid">
                  {roomAvatars.map((avatar) => (
                    <motion.button
                      aria-pressed={avatar.id === selectedAvatarId}
                      className="compact-avatar-token"
                      data-selected={avatar.id === selectedAvatarId}
                      key={avatar.id}
                      layout
                      onClick={() => chooseAvatar(avatar.id)}
                      whileHover={cardHover}
                      whileTap={cardTap}
                      style={getAvatarStyle(avatar)}
                      type="button"
                    >
                      <span className="compact-avatar-portrait" key="avatar-portrait">
                        <img alt="" src={avatar.imageSrc} />
                        <b>{avatar.mark}</b>
                      </span>
                      <span className="compact-avatar-copy" key="avatar-copy">
                        <strong>{avatar.name}</strong>
                        <small>{avatar.description}</small>
                        <em>{avatar.signature}</em>
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {apiError ? <div className="api-status scene-api-status" data-tone="error" role="alert">{apiError}</div> : null}

          <div className="scene-select-footer" key="scene-footer">
            <button
              aria-label={getWorldCopyAriaLabel("navigation.story.leave")}
              className="portal-return"
              onClick={logout}
              type="button"
            >
              {getWorldCopy("navigation.story.leave")}
            </button>
            {isSelectedRoomJoined ? (
              <button className="enter-button" onClick={enterChatWithAvatar} type="button">
                Enter {selectedRoom.name} as {selectedAvatar.name}
              </button>
            ) : (
              <button className="enter-button join-room-button" disabled={isJoiningRoom} onClick={joinSelectedRoom} type="button">
                {isJoiningRoom ? "Joining..." : `Join ${selectedRoom.name}`}
              </button>
            )}
          </div>
        </motion.section>
      ) : null}
      </AnimatePresence>
    </main>
  );
}
