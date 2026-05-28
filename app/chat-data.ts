import avatarCatalog from "../content/avatars/catalog.json";
import type { MessagePresentationId } from "./message-presentations";

export type Room = {
  id: string;
  name: string;
  accentColor: string;
  washColor: string;
  description: string;
  mood: string;
  theme: string;
  motif: string;
  sceneImage: string;
  previewImage: string;
  scenePosition: string;
};

export type Avatar = {
  id: string;
  name: string;
  mark: string;
  description: string;
  signature: string;
  accentColor: string;
  imageSrc: string;
  thumbnail: {
    x: number;
    y: number;
    scale: number;
  };
};

export type ChatMessage = {
  id: string;
  roomId: string;
  avatarId?: string;
  author: string;
  text: string;
  tone: MessagePresentationId;
  time: string;
  mine?: boolean;
};

export const rooms: Room[] = [
  {
    id: "after-school",
    name: "Skybell Academy",
    accentColor: "#176BB3",
    washColor: "#BFD9E8",
    description: "A sunlit campus realm of notes, rivals, rumors, and after-class secrets.",
    mood: "academy sky",
    theme: "School sky saga",
    motif: "window light, class notes, bell marks",
    sceneImage: "/rooms/after-school/scene.jpg",
    previewImage: "/rooms/after-school/preview.jpg",
    scenePosition: "center center",
  },
  {
    id: "quiet-alley",
    name: "Mizukage Library",
    accentColor: "#2F7D3B",
    washColor: "#D8E8D5",
    description: "A rain-soft archive where whispers, study vows, and hidden lore gather.",
    mood: "quiet lore",
    theme: "Rainlit archive",
    motif: "rain lines, sign glow, narrow panels",
    sceneImage: "/rooms/quiet-alley/scene.jpg",
    previewImage: "/rooms/quiet-alley/preview.jpg",
    scenePosition: "center center",
  },
  {
    id: "ramen-stand",
    name: "Yoru Ramen Yokocho",
    accentColor: "#C58A16",
    washColor: "#F1C94C",
    description: "A lantern alley of midnight cravings, noodle debates, and tiny miracles.",
    mood: "lantern steam",
    theme: "Midnight food quest",
    motif: "steam curls, counter panels, gold hatching",
    sceneImage: "/rooms/ramen-stand/scene.jpg",
    previewImage: "/rooms/ramen-stand/preview.jpg",
    scenePosition: "center center",
  },
  {
    id: "battle-rooftop",
    name: "Crimson Plotroom",
    accentColor: "#C94E3B",
    washColor: "#F0B0A5",
    description: "A red-thread storyboard room of clues, betrayals, and sudden reveals.",
    mood: "fate coral",
    theme: "Plot twist bureau",
    motif: "red thread, evidence panels, reveal bursts",
    sceneImage: "/rooms/battle-rooftop/scene.jpg",
    previewImage: "/rooms/battle-rooftop/preview.jpg",
    scenePosition: "center center",
  },
];

export const avatarsByRoom: Record<string, Avatar[]> = avatarCatalog;

export const initialAvatarSelections = Object.fromEntries(
  rooms.map((room) => [room.id, avatarsByRoom[room.id][0].id]),
);

export const loginSceneArts = [
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

export const startingMessages: ChatMessage[] = [
  {
    id: "m1",
    roomId: "after-school",
    avatarId: "skybell-hina",
    author: "Hina",
    text: "Did you see that last page?!",
    tone: "plain",
    time: "3:15 PM",
  },
  {
    id: "m2",
    roomId: "after-school",
    avatarId: "skybell-hina",
    author: "Hina",
    text: "My heart cannot take it!",
    tone: "exclaim",
    time: "3:16 PM",
  },
  {
    id: "m3",
    roomId: "quiet-alley",
    avatarId: "library-ink",
    author: "Ink",
    text: "The sign flickered twice. The alley is trying to speak.",
    tone: "whisper",
    time: "11:42 PM",
  },
  {
    id: "m4",
    roomId: "quiet-alley",
    avatarId: "library-ame",
    author: "Ame",
    text: "Bring the blue umbrella. Quietly.",
    tone: "mutter",
    time: "11:43 PM",
  },
  {
    id: "m5",
    roomId: "ramen-stand",
    avatarId: "ramen-yuto",
    author: "Yuto",
    text: "SPICY MISO! REVIVED!",
    tone: "shout",
    time: "12:04 AM",
  },
  {
    id: "m6",
    roomId: "ramen-stand",
    avatarId: "ramen-yuto",
    author: "Yuto",
    text: "Addicted to that chili oil tho. Tears and happiness.",
    tone: "mutter",
    time: "12:05 AM",
  },
  {
    id: "m6b",
    roomId: "ramen-stand",
    avatarId: "ramen-yuto",
    author: "Yuto",
    text: "TEAM EXTRA GARLIC?",
    tone: "announce",
    time: "12:06 AM",
  },
  {
    id: "m6c",
    roomId: "ramen-stand",
    avatarId: "ramen-yuto",
    author: "Yuto",
    text: "I like mine quiet and simple. Shio ramen is comfort.",
    tone: "whisper",
    time: "12:07 AM",
  },
  {
    id: "m7",
    roomId: "battle-rooftop",
    avatarId: "roof-rei",
    author: "Rei",
    text: "PLOT TWIST INCOMING!",
    tone: "shout",
    time: "8:30 PM",
  },
  {
    id: "m8",
    roomId: "battle-rooftop",
    avatarId: "roof-rei",
    author: "Rei",
    text: "DESTINY TAKES THE STAGE!",
    tone: "grandiose",
    time: "8:31 PM",
  },
];
