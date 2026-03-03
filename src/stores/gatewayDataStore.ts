import { create } from "zustand";

export interface AgentStatus {
  id: string;
  name: string;
  role: string;
  model: string;
  status: "active" | "idle" | "offline";
  sessionKey: string | null;
  lastActivity: number;
}

export interface SessionInfo {
  sessionKey: string;
  agentId: string;
  created: number;
  messageCount: number;
  lastMessage?: string;
}

export interface UsageMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  byAgent: Record<string, { input: number; output: number; requests: number }>;
  byModel: Record<string, { input: number; output: number; requests: number }>;
}

interface GatewayDataState {
  agents: AgentStatus[];
  sessions: SessionInfo[];
  usage: UsageMetrics | null;
  connected: boolean;
  setAgents: (agents: AgentStatus[]) => void;
  setSessions: (sessions: SessionInfo[]) => void;
  setUsage: (usage: UsageMetrics) => void;
  setConnected: (connected: boolean) => void;
}

export const useGatewayDataStore = create<GatewayDataState>((set) => ({
  agents: [],
  sessions: [],
  usage: null,
  connected: false,
  setAgents: (agents) => set({ agents }),
  setSessions: (sessions) => set({ sessions }),
  setUsage: (usage) => set({ usage }),
  setConnected: (connected) => set({ connected }),
}));
