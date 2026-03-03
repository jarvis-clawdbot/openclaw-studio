import { create } from "zustand";

export interface ReplayEvent {
  id: string;
  timestamp: number;
  type: "user_message" | "assistant_message" | "tool_call" | "tool_result" | "error";
  content: string;
  agentId: string;
  metadata?: Record<string, unknown>;
}

export interface ReplaySession {
  id: string;
  agentId: string;
  agentName: string;
  startedAt: number;
  endedAt: number | null;
  events: ReplayEvent[];
}

interface ReplayState {
  sessions: ReplaySession[];
  selectedSession: ReplaySession | null;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  setSessions: (sessions: ReplaySession[]) => void;
  selectSession: (session: ReplaySession | null) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
}

export const useReplayStore = create<ReplayState>((set) => ({
  sessions: [],
  selectedSession: null,
  currentTime: 0,
  isPlaying: false,
  playbackSpeed: 1,
  setSessions: (sessions) => set({ sessions }),
  selectSession: (session) => set({ selectedSession: session, currentTime: 0 }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed: number) => set({ playbackSpeed: speed }),
}));
