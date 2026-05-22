"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Room = {
  id: string;
  name: string;
  entryVerb: string;
  accentColor: string;
  washColor: string;
  description: string;
  mood: string;
  detail: string;
  theme: string;
  motif: string;
};

type Avatar = {
  id: string;
  name: string;
  mark: string;
  description: string;
};

type ChatMessage = {
  id: string;
  roomId: string;
  author: string;
  text: string;
  tone: MessageTone;
  time: string;
  mine?: boolean;
};

type MessageTone =
  | "plain"
  | "whisper"
  | "shout"
  | "scribble"
  | "mutter"
  | "exclaim"
  | "announce"
  | "sad"
  | "grandiose";

type AppStep = "login" | "avatar" | "scene" | "chat";

type BubbleTemplateMetrics = {
  safeLeft: number;
  safeTop: number;
  safeWidth: number;
  safeHeight: number;
  badgeRight: number;
  badgeBottom: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  lineChars: number;
  charPx: number;
};

const sendTonePool: MessageTone[] = [
  "plain",
  "whisper",
  "shout",
  "scribble",
  "mutter",
  "exclaim",
  "announce",
  "sad",
  "grandiose",
];

const bubbleTemplateMetrics: Record<MessageTone, BubbleTemplateMetrics> = {
  plain: {
    safeLeft: 21,
    safeTop: 24,
    safeWidth: 58,
    safeHeight: 47,
    badgeRight: 17,
    badgeBottom: 14,
    minWidth: 340,
    maxWidth: 700,
    minHeight: 130,
    maxHeight: 230,
    lineChars: 30,
    charPx: 10.8,
  },
  whisper: {
    safeLeft: 18,
    safeTop: 27,
    safeWidth: 58,
    safeHeight: 42,
    badgeRight: 14,
    badgeBottom: 16,
    minWidth: 360,
    maxWidth: 720,
    minHeight: 138,
    maxHeight: 240,
    lineChars: 28,
    charPx: 12.5,
  },
  shout: {
    safeLeft: 22,
    safeTop: 29,
    safeWidth: 50,
    safeHeight: 36,
    badgeRight: 13,
    badgeBottom: 14,
    minWidth: 390,
    maxWidth: 760,
    minHeight: 150,
    maxHeight: 260,
    lineChars: 24,
    charPx: 13.2,
  },
  scribble: {
    safeLeft: 34,
    safeTop: 38,
    safeWidth: 26,
    safeHeight: 24,
    badgeRight: 12,
    badgeBottom: 12,
    minWidth: 380,
    maxWidth: 740,
    minHeight: 190,
    maxHeight: 300,
    lineChars: 14,
    charPx: 13,
  },
  mutter: {
    safeLeft: 31,
    safeTop: 36,
    safeWidth: 32,
    safeHeight: 28,
    badgeRight: 13,
    badgeBottom: 13,
    minWidth: 330,
    maxWidth: 650,
    minHeight: 180,
    maxHeight: 290,
    lineChars: 14,
    charPx: 12,
  },
  exclaim: {
    safeLeft: 28,
    safeTop: 28,
    safeWidth: 42,
    safeHeight: 42,
    badgeRight: 12,
    badgeBottom: 12,
    minWidth: 360,
    maxWidth: 700,
    minHeight: 148,
    maxHeight: 245,
    lineChars: 18,
    charPx: 12.5,
  },
  announce: {
    safeLeft: 22,
    safeTop: 30,
    safeWidth: 56,
    safeHeight: 36,
    badgeRight: 14,
    badgeBottom: 12,
    minWidth: 410,
    maxWidth: 780,
    minHeight: 145,
    maxHeight: 235,
    lineChars: 30,
    charPx: 11.4,
  },
  sad: {
    safeLeft: 20,
    safeTop: 30,
    safeWidth: 55,
    safeHeight: 36,
    badgeRight: 14,
    badgeBottom: 13,
    minWidth: 370,
    maxWidth: 720,
    minHeight: 145,
    maxHeight: 240,
    lineChars: 28,
    charPx: 11.8,
  },
  grandiose: {
    safeLeft: 18,
    safeTop: 28,
    safeWidth: 64,
    safeHeight: 34,
    badgeRight: 14,
    badgeBottom: 12,
    minWidth: 500,
    maxWidth: 880,
    minHeight: 150,
    maxHeight: 250,
    lineChars: 34,
    charPx: 11.8,
  },
};

const rooms: Room[] = [
  {
    id: "after-school",
    name: "Skybell Academy",
    entryVerb: "Enter",
    accentColor: "#176BB3",
    washColor: "#BFD9E8",
    description: "A sunlit campus realm of notes, rivals, rumors, and after-class secrets.",
    mood: "academy sky",
    detail: "bell chime",
    theme: "School sky saga",
    motif: "window light, class notes, bell marks",
  },
  {
    id: "quiet-alley",
    name: "Mizukage Library",
    entryVerb: "Enter",
    accentColor: "#2F7D3B",
    washColor: "#D8E8D5",
    description: "A rain-soft archive where whispers, study vows, and hidden lore gather.",
    mood: "quiet lore",
    detail: "rain note",
    theme: "Rainlit archive",
    motif: "rain lines, sign glow, narrow panels",
  },
  {
    id: "ramen-stand",
    name: "Yoru Ramen Yokocho",
    entryVerb: "Enter",
    accentColor: "#C58A16",
    washColor: "#F1C94C",
    description: "A lantern alley of midnight cravings, noodle debates, and tiny miracles.",
    mood: "lantern steam",
    detail: "noodle steam",
    theme: "Midnight food quest",
    motif: "steam curls, counter panels, gold hatching",
  },
  {
    id: "battle-rooftop",
    name: "Crimson Paradox Roof",
    entryVerb: "Enter",
    accentColor: "#C94E3B",
    washColor: "#F0B0A5",
    description: "A rooftop threshold for secret prophecies, betrayals, and loud reveals.",
    mood: "fate coral",
    detail: "speed lines",
    theme: "Rooftop fate break",
    motif: "speed lines, skyline slashes, red cuts",
  },
];

const avatars: Avatar[] = [
  {
    id: "spark",
    name: "Spark",
    mark: "SP",
    description: "Bright and direct",
  },
  {
    id: "ink",
    name: "Ink",
    mark: "IN",
    description: "Quiet and observant",
  },
  {
    id: "bolt",
    name: "Bolt",
    mark: "BO",
    description: "Loud and decisive",
  },
  {
    id: "mika",
    name: "Mika",
    mark: "MI",
    description: "Soft and playful",
  },
  {
    id: "ren",
    name: "Ren",
    mark: "RE",
    description: "Panel-ready",
  },
];

const loginSceneArts = [
  {
    id: "bedroom-desk",
    name: "Bedroom Desk",
    src: "/login-scene-current/login-scene-01-bedroom-desk.png",
  },
  {
    id: "train-platform",
    name: "Train Platform",
    src: "/login-scene-current/login-scene-02-train-platform.png",
  },
  {
    id: "ramen-window",
    name: "Ramen Window",
    src: "/login-scene-current/login-scene-03-ramen-window.png",
  },
  {
    id: "rooftop-dusk",
    name: "Rooftop Dusk",
    src: "/login-scene-current/login-scene-04-rooftop-dusk.png",
  },
  {
    id: "cafe-morning",
    name: "Cafe Morning",
    src: "/login-scene-current/login-scene-05-cafe-morning.png",
  },
];

const startingMessages: ChatMessage[] = [
  {
    id: "m1",
    roomId: "after-school",
    author: "Ren",
    text: "Did you see that last page?!",
    tone: "plain",
    time: "3:15 PM",
  },
  {
    id: "m2",
    roomId: "after-school",
    author: "Hina",
    text: "So good. My heart is not okay...",
    tone: "exclaim",
    time: "3:16 PM",
  },
  {
    id: "m2b",
    roomId: "after-school",
    author: "Kaito",
    text: "I had to put the book down for a sec. Too many feels.",
    tone: "mutter",
    time: "3:16 PM",
  },
  {
    id: "m2c",
    roomId: "after-school",
    author: "Sora",
    text: "Theory time: what if THAT character is...",
    tone: "scribble",
    time: "3:18 PM",
  },
  {
    id: "m3",
    roomId: "quiet-alley",
    author: "Ink",
    text: "The sign flickered twice. I think the alley is trying to say something.",
    tone: "whisper",
    time: "11:42 PM",
  },
  {
    id: "m4",
    roomId: "quiet-alley",
    author: "Ren",
    text: "Bring the blue umbrella. Quietly.",
    tone: "mutter",
    time: "11:43 PM",
  },
  {
    id: "m5",
    roomId: "ramen-stand",
    author: "Ren",
    text: "Just finished a spicy miso ramen... my soul has been revived.",
    tone: "shout",
    time: "12:04 AM",
  },
  {
    id: "m6",
    roomId: "ramen-stand",
    author: "Mika",
    text: "Addicted to that chili oil tho. Tears and happiness.",
    tone: "mutter",
    time: "12:05 AM",
  },
  {
    id: "m6b",
    roomId: "ramen-stand",
    author: "Yuto",
    text: "Anyone else team extra garlic?",
    tone: "announce",
    time: "12:06 AM",
  },
  {
    id: "m6c",
    roomId: "ramen-stand",
    author: "Hana",
    text: "I like mine quiet and simple. Shio ramen is comfort.",
    tone: "whisper",
    time: "12:07 AM",
  },
  {
    id: "m7",
    roomId: "battle-rooftop",
    author: "Bolt",
    text: "ROOFTOP MEETING IN FIVE. BRING DRAMA.",
    tone: "shout",
    time: "8:30 PM",
  },
  {
    id: "m8",
    roomId: "battle-rooftop",
    author: "Mika",
    text: "I have a scarf and one heroic announcement prepared.",
    tone: "grandiose",
    time: "8:31 PM",
  },
];

function getRandomTone(): MessageTone {
  return sendTonePool[Math.floor(Math.random() * sendTonePool.length)];
}

function estimateBubbleFrame(text: string, tone: MessageTone) {
  const metrics = bubbleTemplateMetrics[tone];
  const characters = text.length;
  const lineEstimate = Math.max(1, Math.ceil(characters / metrics.lineChars));
  const safeWidthRatio = metrics.safeWidth / 100;
  const safeHeightRatio = metrics.safeHeight / 100;
  const estimatedTextWidth = characters * metrics.charPx + 60;
  const estimatedTextHeight = 48 + lineEstimate * 30;
  const width = Math.round(
    Math.min(metrics.maxWidth, Math.max(metrics.minWidth, estimatedTextWidth / safeWidthRatio)),
  );
  const height = Math.round(
    Math.min(metrics.maxHeight, Math.max(metrics.minHeight, estimatedTextHeight / safeHeightRatio)),
  );

  return {
    "--bubble-width": `${width}px`,
    "--bubble-height": `${height}px`,
    "--bubble-safe-left": `${metrics.safeLeft}%`,
    "--bubble-safe-top": `${metrics.safeTop}%`,
    "--bubble-safe-width": `${metrics.safeWidth}%`,
    "--bubble-safe-height": `${metrics.safeHeight}%`,
    "--bubble-badge-right": `${metrics.badgeRight}%`,
    "--bubble-badge-bottom": `${metrics.badgeBottom}%`,
  } as React.CSSProperties;
}

export default function Home() {
  const [appStep, setAppStep] = useState<AppStep>("login");
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0].id);
  const [selectedAvatarId, setSelectedAvatarId] = useState(avatars[0].id);
  const [loginArtIndex, setLoginArtIndex] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(startingMessages);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? rooms[0],
    [selectedRoomId],
  );

  const selectedAvatar = useMemo(
    () => avatars.find((avatar) => avatar.id === selectedAvatarId) ?? avatars[0],
    [selectedAvatarId],
  );

  const activeLoginArt = loginSceneArts[loginArtIndex];

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppStep("scene");
  }

  function chooseRoom(roomId: string) {
    setSelectedRoomId(roomId);
    setSelectedAvatarId(avatars[0].id);
  }

  function enterSelectedScene() {
    setAppStep("avatar");
  }

  function enterChatWithAvatar() {
    setAppStep("chat");
  }

  function sendLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();

    if (!text) {
      return;
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `${selectedRoom.id}-${Date.now()}`,
        roomId: selectedRoom.id,
        author: displayName.trim() || selectedAvatar.name,
        text,
        tone: getRandomTone(),
        time: "now",
        mine: true,
      },
    ]);
    setDraft("");
  }

  const roomMessages = messages.filter((message) => message.roomId === selectedRoom.id);

  useEffect(() => {
    if (appStep !== "login") {
      requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
    }
  }, [appStep]);

  useEffect(() => {
    if (appStep !== "login") {
      return;
    }

    const artTimer = window.setInterval(() => {
      setLoginArtIndex((currentIndex) => (currentIndex + 1) % loginSceneArts.length);
    }, 4500);

    return () => window.clearInterval(artTimer);
  }, [appStep]);

  if (appStep === "chat") {
    return (
      <main className="kokoroe-shell chat-shell">
        <div className="paper-grain" aria-hidden="true" />
        <section className="chat-stage" aria-label={`${selectedRoom.name} chat scene`}>
          <aside className="scene-nav ink-panel">
            <div>
              <div className="nav-brand-row">
                <h1>Kokoroe</h1>
                <span>Search</span>
                <span>Inbox</span>
              </div>
              <span className="panel-kicker">Worlds</span>
              <p>
                {displayName.trim() || selectedAvatar.name} entered as {selectedAvatar.name}.
              </p>
            </div>

            <div className="scene-buttons">
              {rooms.map((room) => (
                <button
                  className="scene-button"
                  data-selected={room.id === selectedRoomId}
                  key={room.id}
                  onClick={() => {
                    chooseRoom(room.id);
                    setAppStep("avatar");
                  }}
                  style={
                    {
                      "--accent": room.accentColor,
                      "--room-wash": room.washColor,
                    } as React.CSSProperties
                  }
                  type="button"
                >
                  <strong>{room.name}</strong>
                  <span>{room.theme}</span>
                </button>
              ))}
            </div>

            <button className="portal-return" onClick={() => setAppStep("avatar")} type="button">
              Back to Avatar
            </button>
          </aside>

          <div
            className="chat-panel ink-panel"
            style={
              {
                "--accent": selectedRoom.accentColor,
                "--room-wash": selectedRoom.washColor,
              } as React.CSSProperties
            }
          >
            <header className="chat-heading">
              <div className="scene-hero" aria-hidden="true">
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

            <div className="message-scroll" aria-live="polite">
              {roomMessages.map((message) => (
                <article className="message-row" data-mine={message.mine ? "true" : "false"} key={message.id}>
                  <div className="message-avatar" aria-hidden="true">
                    {message.author.slice(0, 1)}
                  </div>
                  <div
                    className="message-stack"
                    style={
                      {
                        ...estimateBubbleFrame(message.text, message.tone),
                        "--tone-accent": selectedRoom.accentColor,
                      } as React.CSSProperties
                    }
                  >
                    <div className="message-meta">
                      <strong>{message.author}</strong>
                      <span>{message.time}</span>
                    </div>
                    <div className="message-bubble" data-tone={message.tone}>
                      <img
                        alt=""
                        aria-hidden="true"
                        className="bubble-template"
                        src={`/message-templates/message-template-${message.tone}.svg`}
                      />
                      <p>{message.text}</p>
                      <em>{message.tone}</em>
                    </div>
                  </div>
                </article>
              ))}
              <div className="typing-card">
                <span>{selectedAvatar.name} is typing...</span>
                <i />
                <i />
                <i />
              </div>
            </div>

            <form className="chat-composer" onSubmit={sendLine}>
              <label>
                <span>Send a line</span>
                <textarea
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Write something for ${selectedRoom.name}`}
                  rows={3}
                  value={draft}
                />
              </label>
              <button type="submit">Send</button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="kokoroe-shell">
      <div className="paper-grain" aria-hidden="true" />
      {appStep === "login" ? (
        <section className="login-page ink-panel" aria-label="Kokoroe login">
          <div className="login-art-panel" aria-label={`${activeLoginArt.name} preview`}>
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

          <div className="login-form-panel">
            <div className="login-logo">
              <img alt="Kokoroe" src="/brand/kokoroe-logo-wordmark.svg" />
              <span className="login-heart" aria-hidden="true">♥</span>
            </div>

            <form className="entry-form login-form" onSubmit={submitLogin}>
              <div className="login-welcome">
                <strong>Welcome back!</strong>
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
                <input type="password" placeholder="Password" />
              </label>
              <a className="forgot-link" href="#login">
                Forgot password?
              </a>

              <button className="enter-button login-enter" type="submit">
                Get Isekaied →
              </button>

              <div className="login-divider">
                <span>★</span>
              </div>

              <button className="create-account-button" type="button">Create account</button>
            </form>
          </div>
        </section>
      ) : null}

      {appStep === "avatar" ? (
        <section className="avatar-page ink-panel" aria-label="Choose your avatar">
          <div className="avatar-page-heading">
            <span className="panel-kicker">Step 03</span>
            <h1>{selectedRoom.name}</h1>
            <p>Choose a character identity that belongs in this world.</p>
          </div>

          <div className="avatar-picker-panel">
            <h2>Choose Your Avatar</h2>
            <p>{selectedRoom.theme}: {selectedRoom.motif}.</p>
            <div className="avatar-orbit">
              {avatars.map((avatar) => (
                <button
                  className="avatar-token"
                  data-selected={avatar.id === selectedAvatarId}
                  key={avatar.id}
                  onClick={() => setSelectedAvatarId(avatar.id)}
                  type="button"
                >
                  <span>{avatar.mark}</span>
                  <strong>{avatar.name}</strong>
                  <small>{avatar.description}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="avatar-actions">
            <button className="portal-return" onClick={() => setAppStep("scene")} type="button">
              Back to Worlds
            </button>
            <button className="enter-button" onClick={enterChatWithAvatar} type="button">
              Enter as {selectedAvatar.name}
            </button>
          </div>
        </section>
      ) : null}

      {appStep === "scene" ? (
        <section className="scene-select-page ink-panel" aria-label="Choose your dream world">
          <div className="scene-select-header">
            <div>
              <span className="panel-kicker">Step 02</span>
              <h1>Choose Your Dream World</h1>
              <p>Get isekaied to your dream world. Choose the one that calls first.</p>
            </div>
            <div className="scene-tip" aria-hidden="true">
              Scribble something amazing!
            </div>
          </div>

          <div className="scene-select-list">
            {rooms.map((room, index) => (
              <button
                className="wide-scene-card"
                data-selected={room.id === selectedRoomId}
                key={room.id}
                onClick={() => chooseRoom(room.id)}
                style={
                  {
                    "--accent": room.accentColor,
                    "--room-wash": room.washColor,
                  } as React.CSSProperties
                }
                type="button"
              >
                <span className="scene-icon">0{index + 1}</span>
                <span className="scene-copy">
                  <strong>{room.name}</strong>
                  <small>{room.description}</small>
                  <em>{room.mood}</em>
                </span>
                <span className="scene-card-art" aria-hidden="true">
                  <i />
                  <b />
                </span>
                <span className="scene-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>

          <div className="scene-select-footer">
            <button className="portal-return" onClick={() => setAppStep("login")} type="button">
              Back to Login
            </button>
            <button className="enter-button" onClick={enterSelectedScene} type="button">
              Choose Avatar for {selectedRoom.name}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
