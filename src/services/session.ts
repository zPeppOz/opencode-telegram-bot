import { config } from "../config.js";

interface UserState {
  activeSessionId: string | null;
  activeDirectory: string;
  selectedModel: { providerID: string; modelID: string } | null;
  selectedAgent: string | null;
  lastMessageId: number | null;
  isBusy: boolean;
}

const states = new Map<number, UserState>();

function createDefault(): UserState {
  return {
    activeSessionId: null,
    activeDirectory: config.opencode.defaultDir,
    selectedModel: null,
    selectedAgent: null,
    lastMessageId: null,
    isBusy: false,
  };
}

export function getState(userId: number): UserState {
  if (!states.has(userId)) {
    states.set(userId, createDefault());
  }
  return states.get(userId)!;
}

export function setState(userId: number, patch: Partial<UserState>): UserState {
  const current = getState(userId);
  const updated = { ...current, ...patch };
  states.set(userId, updated);
  return updated;
}

export function clearState(userId: number): void {
  states.delete(userId);
}
