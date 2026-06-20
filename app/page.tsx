"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
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
  fetchProfile,
  fetchRoomMessages,
  fetchRooms,
  logoutSession,
  patchProfile,
  postRoomJoin,
  postRoomMember,
  postRoomMessage,
  searchRoomMemberAccounts,
} from "./kokoroe-api";
import {
  getBubbleFrameStyle,
  getRandomPresentationId,
  MESSAGE_CHARACTER_LIMIT,
  messagePresentations,
  resolvePresentationId,
  type MessagePresentationId,
} from "./message-presentations";
import { subscribeToRoomMessages } from "./realtime";
import type { KokoroePublicUser } from "./kokoroe-store";

type AppStep = "login" | "scene" | "chat";
type AuthMode = "login" | "create";

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
  { id: "rain-1", x: "18%", y: "8%", length: "2.5rem", delay: "-120ms", duration: "980ms", opacity: "0.42" },
  { id: "rain-2", x: "26%", y: "20%", length: "3.2rem", delay: "-620ms", duration: "1180ms", opacity: "0.34" },
  { id: "rain-3", x: "34%", y: "4%", length: "2.2rem", delay: "-340ms", duration: "920ms", opacity: "0.5" },
  { id: "rain-4", x: "42%", y: "12%", length: "3.7rem", delay: "-860ms", duration: "1240ms", opacity: "0.3" },
  { id: "rain-5", x: "54%", y: "2%", length: "2.7rem", delay: "-180ms", duration: "1020ms", opacity: "0.42" },
  { id: "rain-6", x: "62%", y: "14%", length: "3.5rem", delay: "-760ms", duration: "1120ms", opacity: "0.36" },
  { id: "rain-7", x: "70%", y: "6%", length: "2.35rem", delay: "-460ms", duration: "900ms", opacity: "0.52" },
  { id: "rain-8", x: "78%", y: "20%", length: "3rem", delay: "-1040ms", duration: "1160ms", opacity: "0.32" },
  { id: "rain-9", x: "22%", y: "48%", length: "2.9rem", delay: "-520ms", duration: "1040ms", opacity: "0.28" },
  { id: "rain-10", x: "74%", y: "50%", length: "2.6rem", delay: "-260ms", duration: "960ms", opacity: "0.38" },
  { id: "rain-11", x: "32%", y: "62%", length: "2.2rem", delay: "-940ms", duration: "1080ms", opacity: "0.27" },
  { id: "rain-12", x: "66%", y: "68%", length: "2.4rem", delay: "-700ms", duration: "1010ms", opacity: "0.31" },
];

const screenMotion = {
  initial: { opacity: 0, y: 22, scale: 0.985, rotate: -0.35 },
  animate: { opacity: 1, y: 0, scale: 1, rotate: 0 },
  exit: { opacity: 0, y: -18, scale: 0.985, rotate: 0.35 },
  transition: { duration: 0.34, ease: "easeOut" },
} as const;

const cardTap = { scale: 0.975, rotate: -0.4 };
const cardHover = { y: -3, rotate: 0.15 };
const timestampGapMinutes = 5;

type MessageEntryMotion = {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  transition: Transition;
};

function getMessageEntryMotion(shouldReduceMotion: boolean): MessageEntryMotion {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.18, ease: "easeOut" },
    };
  }

  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
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
  const [draft, setDraft] = useState("");
  const [memberAccountIdentifier, setMemberAccountIdentifier] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<KokoroePublicUser[]>([]);
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
  const [transitionBurst, setTransitionBurst] = useState<{ id: number; to: AppStep } | null>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef<AppStep>(appStep);

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
  const activeLoginArt = loginSceneArts[loginArtIndex];

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
    const roomPayload = await fetchRooms();
    setRooms(roomPayload.rooms);
    setAvatarsByRoom(roomPayload.avatarsByRoom);
    setMembersByRoom(roomPayload.membersByRoom);
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
      setDraft("");
      setMemberAccountIdentifier("");
      setMemberSearchResults([]);
      setRoomSearchQuery("");
      setMessages([]);
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

    try {
      const message = await postRoomMessage({
        sessionId,
        roomId: selectedRoom.id,
        avatarId: selectedAvatar.id,
        text,
        tone: getRandomPresentationId(text),
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
          {...screenMotion}
          className="chat-stage"
          aria-label={`${selectedRoom.name} chat scene`}
          key="chat"
        >
          <motion.aside
            key="chat-navigation"
            className="scene-nav ink-panel"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08, duration: 0.32 }}
          >
            <div key="chat-brand">
              <div className="nav-brand-row">
                <h1>Kokoroe</h1>
                <span>Search</span>
                <span>Inbox</span>
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
                  layout
                  onClick={() => chooseRoomFromChat(room.id)}
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
                  <img alt="" aria-hidden="true" className="scene-button-image" key="room-image" src={room.previewImage} />
                  <strong key="room-name">{room.name}</strong>
                  <span key="room-theme">{room.theme}</span>
                </motion.button>
              ))}
            </div>

            <div className="nav-actions">
              <button className="portal-return" key="chat-back" onClick={() => setAppStep("scene")} type="button">
                Back to Setup
              </button>
              <button className="portal-return" key="chat-logout" onClick={logout} type="button">
                Logout
              </button>
            </div>
          </motion.aside>

          <motion.div
            key="chat-panel"
            className="chat-panel ink-panel"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12, duration: 0.34 }}
            style={
              {
                "--accent": selectedRoom.accentColor,
                "--room-wash": selectedRoom.washColor,
                "--avatar-accent": selectedAvatar.accentColor,
              } as React.CSSProperties
            }
          >
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
              <div className="scene-hero" aria-hidden="true">
                <img
                  alt=""
                  className="scene-hero-image"
                  src={selectedRoom.sceneImage}
                  style={{ objectPosition: selectedRoom.scenePosition }}
                />
                <span />
                <i />
                <b />
              </div>
              <div>
                <span>{selectedRoom.theme}</span>
                <h2>{selectedRoom.name}</h2>
              </div>
              <p>
                {selectedRoom.description} <strong>{selectedRoom.motif}</strong>
              </p>
              <button
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
                  exit={{ opacity: 0, y: -8, rotate: 0.4 }}
                  initial={{ opacity: 0, y: -8, rotate: -0.4 }}
                  key="members-window"
                  transition={{ duration: 0.2, ease: "easeOut" }}
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
                        {memberError ? <div className="member-error">{memberError}</div> : null}
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

            <div className="message-scroll" aria-live="polite" key="chat-messages" ref={messageScrollRef}>
              {isLoadingMessages ? <div className="api-status">Loading panels...</div> : null}
              {apiError ? <div className="api-status" data-tone="error">{apiError}</div> : null}
              <AnimatePresence initial={false}>
                {roomMessages.flatMap((message, index) => {
                  const isOwnMessage = message.userId
                    ? Boolean(currentUserId && message.userId === currentUserId)
                    : message.mine === true;
                  const messageAccount = getMessageAccount(message);
                  const messageAvatar = getMessageAvatar(message);
                  const presentationId = resolvePresentationId(message.text, message.tone);
                  const presentation = messagePresentations[presentationId];
                  const messageEntryMotion = getMessageEntryMotion(!!shouldReduceMotion);
                  const messageNodes = [];

                  if (shouldShowTimestamp(message, roomMessages[index - 1])) {
                    messageNodes.push(
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className="message-time-divider"
                        initial={{ opacity: 0, y: 6 }}
                        key={`${message.id}-time`}
                        layout
                        transition={{ duration: 0.22, ease: "easeOut" }}
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
                      key={message.id}
                      layout
                      initial={messageEntryMotion.initial}
                      animate={messageEntryMotion.animate}
                      exit={{ opacity: 0, y: -10, scale: 0.96 }}
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
                        >
                          {presentationId === "sad" && (
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
                          <img
                            alt=""
                            aria-hidden="true"
                            className="bubble-template"
                            src={`/message-templates/message-template-${presentation.shell}.svg`}
                          />
                          <p key="message-text"><span>{message.text}</span></p>
                        </div>
                        <div className="speaker-anchor">
                          <button
                            aria-expanded={revealedProfileMessageId === message.id}
                            aria-label={`View profile for ${messageAccount?.displayName ?? message.author}`}
                            className="message-avatar"
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
                                exit={{ opacity: 0, scale: 0.94, y: -4 }}
                                initial={{ opacity: 0, scale: 0.94, y: -4 }}
                                key="profile-reveal"
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
              <motion.div
                key="typing-card"
                className="typing-card"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <span key="typing-copy">{selectedAvatar.name} is typing...</span>
                <i key="typing-dot-1" />
                <i key="typing-dot-2" />
                <i key="typing-dot-3" />
              </motion.div>
            </div>

            <form className="chat-composer" key="chat-composer" onSubmit={sendLine}>
              <div className="composer-status" aria-live="polite">
                <span aria-hidden="true" />
                Live in {selectedRoom.name} as {selectedAvatar.name}
              </div>
              <label>
                <span className="composer-label-row">
                  <span>Send a line</span>
                  <em>{draft.length}/{MESSAGE_CHARACTER_LIMIT}</em>
                </span>
                <textarea
                  maxLength={MESSAGE_CHARACTER_LIMIT}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={sendLineOnEnter}
                  placeholder={`Write something for ${selectedRoom.name}`}
                  rows={3}
                  value={draft}
                />
              </label>
              <button disabled={isSending} type="submit">{isSending ? "Sending" : "Send"}</button>
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
          {...screenMotion}
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
          </div>

          <div className="login-form-panel" key="login-form-panel">
            <div className="login-logo">
              <img alt="Kokoroe" src="/brand/kokoroe-logo-wordmark.svg" />
              <span className="login-heart" aria-hidden="true">♥</span>
            </div>

            <form className="entry-form login-form" onSubmit={submitLogin}>
              <div className="login-welcome">
                <strong>{authMode === "create" ? "Start your arc!" : "Welcome back!"}</strong>
              </div>

              <label>
                Display name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoCapitalize="none"
                  autoComplete={authMode === "create" ? "username" : "username"}
                  autoCorrect="off"
                  placeholder="Username or Email"
                  spellCheck={false}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={authMode === "create" ? "new-password" : "current-password"}
                  placeholder={authMode === "create" ? "Password (8+ characters)" : "Password"}
                />
              </label>
              {authMode === "login" ? (
                <a className="forgot-link" href="#login">
                  Forgot password?
                </a>
              ) : null}

              {apiError ? <div className="api-status" data-tone="error">{apiError}</div> : null}

              <button className="enter-button login-enter" disabled={isLoggingIn} type="submit">
                {isLoggingIn
                  ? "Opening portal..."
                  : authMode === "create"
                    ? "Create account →"
                    : "Get Isekaied →"}
              </button>

              <div className="login-divider">
                <span>★</span>
              </div>

              <button
                className="create-account-button"
                onClick={() => {
                  setApiError("");
                  setAuthMode((currentMode) => (currentMode === "login" ? "create" : "login"));
                }}
                type="button"
              >
                {authMode === "login" ? "Create account" : "Back to login"}
              </button>
            </form>
          </div>
        </motion.section>
      ) : null}

      {appStep === "scene" ? (
        <motion.section
          {...screenMotion}
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
              <p>Get isekaied to a world, then pick the character identity you will enter as.</p>
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

          {apiError ? <div className="api-status scene-api-status" data-tone="error">{apiError}</div> : null}

          <div className="scene-select-footer" key="scene-footer">
            <button className="portal-return" onClick={logout} type="button">
              Logout
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
