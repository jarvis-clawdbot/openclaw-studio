import { create } from "zustand";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Agent = {
  id: string;
  name: string;
  status: string;
  model: string;
  role: string;
  avatarColor: string;
  session_key?: string | null;
  last_active_seconds?: number | null;
  total_tokens?: number | null;
};

type TopologyState = {
  agentsList: Agent[];
  selectedAgent: Agent | null;
  isLoading: boolean;
  loadAgents: () => Promise<void>;
  setSelectedAgent: (agent: Agent | null) => void;
};

// Role map based on agent name
const ROLE_MAP: Record<string, string> = {
  jarvis: "Orchestrator",
  wolff: "Researcher",
  dobby: "Builder",
  claudy: "Reviewer",
};

const COLOR_MAP: Record<string, string> = {
  jarvis: "#8b5cf6",
  wolff: "#3b82f6",
  dobby: "#10b981",
  claudy: "#f59e0b",
};

export const useTopologyStore = create<TopologyState>((set) => ({
  agentsList: [],
  selectedAgent: null,
  isLoading: false,

  loadAgents: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents/live`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const agents: Agent[] = data.map((a: any) => ({
        id: a.id,
        name: a.name,
        status: a.status,  // Use status from live API (active/idle)
        model: a.model || "unknown",
        role: ROLE_MAP[a.id] || "Agent",
        avatarColor: COLOR_MAP[a.id] || "#6b7280",
        session_key: a.session_key,
        last_active_seconds: a.last_active_seconds,
        total_tokens: a.total_tokens,
      }));

      set({ agentsList: agents, isLoading: false });
    } catch (error) {
      console.error("Failed to load agents:", error);
      set({ isLoading: false });
    }
  },

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
}));

// Auto-refresh every 5 seconds
let intervalId: NodeJS.Timeout | null = null;

export function startTopologySync() {
  if (intervalId) return;
  const store = useTopologyStore.getState();
  store.loadAgents(); // Initial load
  intervalId = setInterval(() => {
    store.loadAgents();
  }, 5000);
}

export function stopTopologySync() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
