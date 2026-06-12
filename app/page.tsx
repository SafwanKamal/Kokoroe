"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  avatarsByRoom,
  initialAvatarSelections,
  loginSceneArts,
  rooms,
  type ChatMessage,
} from "./chat-data";
import {
  createAccountSession,
  createLoginSession,
  fetchCurrentSession,
  fetchProfile,
  fetchRoomMessages,
  logoutSession,
  patchProfile,
  postRoomMessage,
} from "./kokoroe-api";
import {
  getBubbleFrameStyle,
  getRandomPresentationId,
  MESSAGE_CHARACTER_LIMIT,
  messagePresentations,
  resolvePresentationId,
} from "./message-presentations";
import { subscribeToRoomMessages } from "./realtime";

type AppStep = "login" | "scene" | "chat";
type AuthMode = "login" | "create";

const screenMotion = {
  initial: { opacity: 0, y: 22, scale: 0.985, rotate: -0.35 },
  animate: { opacity: 1, y: 0, scale: 1, rotate: 0 },
  exit: { opacity: 0, y: -18, scale: 0.985, rotate: 0.35 },
  transition: { duration: 0.34, ease: "easeOut" },
} as const;

const cardTap = { scale: 0.975, rotate: -0.4 };
const cardHover = { y: -3, rotate: 0.15 };
const timestampGapMinutes = 5;

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
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0].id);
  const [selectedAvatarIds, setSelectedAvatarIds] = useState<Record<string, string>>(initialAvatarSelections);
  const [loginArtIndex, setLoginArtIndex] = useState(0);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [apiError, setApiError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [revealedProfileMessageId, setRevealedProfileMessageId] = useState<string | null>(null);
  const [transitionBurst, setTransitionBurst] = useState<{ id: number; to: AppStep } | null>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef<AppStep>(appStep);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? rooms[0],
    [selectedRoomId],
  );

  const roomAvatars = avatarsByRoom[selectedRoom.id];
  const selectedAvatarId = selectedAvatarIds[selectedRoom.id] ?? roomAvatars[0].id;

  const selectedAvatar = useMemo(
    () => roomAvatars.find((avatar) => avatar.id === selectedAvatarId) ?? roomAvatars[0],
    [roomAvatars, selectedAvatarId],
  );

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
      setSessionId(result.session.id);
      applyProfile(result.user.profile);
      setAppStep("scene");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function chooseRoom(roomId: string) {
    setRevealedProfileMessageId(null);
    setSelectedRoomId(roomId);
    void saveProfile({ currentRoomId: roomId });
  }

  function chooseRoomFromChat(roomId: string) {
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
    setAppStep("chat");
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
      setPassword("");
      setDraft("");
      setMessages([]);
      setRevealedProfileMessageId(null);
      setSelectedRoomId(rooms[0].id);
      setSelectedAvatarIds(initialAvatarSelections);
      returnToLogin();
    }
  }

  async function sendLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  const roomMessages = messages.filter((message) => message.roomId === selectedRoom.id);

  function getMessageAvatar(message: ChatMessage) {
    return roomAvatars.find((avatar) => avatar.id === message.avatarId || avatar.name === message.author);
  }

  function getAvatarStyle(avatar: typeof selectedAvatar) {
    return {
      "--avatar-accent": avatar.accentColor,
      "--thumbnail-crop": `translate(${avatar.thumbnail.x}%, ${avatar.thumbnail.y}%) scale(${avatar.thumbnail.scale})`,
    } as React.CSSProperties;
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
    }, 980);

    return () => window.clearTimeout(timer);
  }, [appStep, isRestoringSession, shouldReduceMotion]);

  useEffect(() => {
    let isCurrent = true;

    fetchCurrentSession()
      .then((result) => {
        if (!isCurrent || !result) {
          return;
        }

        setDisplayName(result.user.displayName);
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

    const scrollFrame = window.requestAnimationFrame(() => {
      const messageScroll = messageScrollRef.current;

      if (messageScroll) {
        messageScroll.scrollTop = messageScroll.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(scrollFrame);
  }, [appStep, roomMessages.length, selectedRoomId]);

  useEffect(() => {
    let isCurrent = true;

    setApiError("");
    setIsLoadingMessages(true);

    fetchRoomMessages(selectedRoom.id)
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
  }, [selectedRoom.id]);

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
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          key={transitionBurst.id}
          transition={{ duration: 0.92, times: [0, 0.12, 0.78, 1], ease: "easeOut" }}
        >
          <img alt="" src={selectedRoom.sceneImage} style={{ objectPosition: selectedRoom.scenePosition }} />
          <span className="jump-portal" />
          <span className="jump-figure">
            <i />
          </span>
          <b>Whoosh</b>
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
              {rooms.map((room) => (
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
            </header>

            <div className="message-scroll" aria-live="polite" key="chat-messages" ref={messageScrollRef}>
              {isLoadingMessages ? <div className="api-status">Loading panels...</div> : null}
              {apiError ? <div className="api-status" data-tone="error">{apiError}</div> : null}
              <AnimatePresence initial={false}>
                {roomMessages.flatMap((message, index) => {
                  const messageAvatar = getMessageAvatar(message);
                  const presentationId = resolvePresentationId(message.text, message.tone);
                  const presentation = messagePresentations[presentationId];
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
                      data-mine={message.mine ? "true" : "false"}
                      key={message.id}
                      layout
                      initial={{ opacity: 0, y: 18, rotate: message.mine ? 1.2 : -1.2, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.96 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                    >
                      <div
                        key="message-bubble"
                        className="message-stack"
                        style={
                          {
                            ...getBubbleFrameStyle(presentationId),
                          } as React.CSSProperties
                        }
                      >
                        <div
                          className="message-bubble"
                          data-mine={message.mine ? "true" : "false"}
                          data-font-role={presentation.fontRole}
                          data-ink={presentation.ink}
                          data-motion={presentation.motion}
                          data-presentation={presentationId}
                        >
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
                            aria-label={`View profile for ${message.author}`}
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
                                <strong>{message.author}</strong>
                                {messageAvatar && <span>{messageAvatar.signature}</span>}
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
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={MESSAGE_CHARACTER_LIMIT}
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
                  placeholder="Username or Email"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
            <div className="scene-select-list" aria-label="Dream worlds">
              {rooms.map((room, index) => (
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

          <div className="scene-select-footer" key="scene-footer">
            <button className="portal-return" onClick={logout} type="button">
              Logout
            </button>
            <button className="enter-button" onClick={enterChatWithAvatar} type="button">
              Enter {selectedRoom.name} as {selectedAvatar.name}
            </button>
          </div>
        </motion.section>
      ) : null}
      </AnimatePresence>
    </main>
  );
}
