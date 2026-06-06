import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { ChatMessage } from "./chat-data";

type RealtimeMessageRow = {
  author: string;
  avatar_id: string | null;
  created_at: string | null;
  id: string;
  is_mine: boolean;
  room_id: string;
  text: string;
  time_label: string;
  tone: ChatMessage["tone"];
  user_id: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isRealtimeConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

function toChatMessage(row: RealtimeMessageRow): ChatMessage {
  return {
    id: row.id,
    roomId: row.room_id,
    avatarId: row.avatar_id ?? undefined,
    userId: row.user_id ?? undefined,
    author: row.author,
    text: row.text,
    tone: row.tone,
    time: row.time_label,
    createdAt: row.created_at ?? undefined,
    mine: row.is_mine,
  };
}

export function subscribeToRoomMessages(
  roomId: string,
  onMessage: (message: ChatMessage) => void,
): RealtimeChannel | undefined {
  if (!supabaseUrl || !supabaseKey) {
    return undefined;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  return supabase
    .channel(`room:${roomId}:messages`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => onMessage(toChatMessage(payload.new as RealtimeMessageRow)),
    )
    .subscribe();
}
