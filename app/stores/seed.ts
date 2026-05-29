import { startingMessages } from "../chat-data";
import type { StoreState } from "./types";

export function createSeedStore(): StoreState {
  return {
    version: 1,
    counter: 0,
    users: [],
    sessions: [],
    messages: [...startingMessages],
  };
}
