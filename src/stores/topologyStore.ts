import { create } from "zustand";
import { BACKEND_URL } from "@/lib/config";


export type Agent = {
  id: string;
  name: string;
  status: string;
  model: string;
  role: string;
  avatarColor: string;
  agent_type: "local" | "fleet";
  host?: string;
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

export const useTopologyStore = create<TopologyState>((set) => ({
  agentsList: [],
  selectedAgent: null,
  isLoading: false,

  loadAgents: async () => {
    set({ isLoading: true });
    try {
      // Use /api/agents (DB) as primary source - includes all 6 agents (local + fleet)
      const res = await fetch(`${BACKEND_URL}/api/agents`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const agents: Agent[] = data.map((a: any) => {
        // Derive agent_type from role for now
        const isFleet = a.role?.toLowerCase().includes("worker");
        return {
          id: a.name.toLowerCase(),
          name: a.name,
          status: a.status || "idle",
          model: a.model || "unknown",
          role: a.role || "Agent",
          avatarColor: a.avatar_color || a.avatarColor || "#6b7280",
          agent_type: isFleet ? "fleet" : "local",
          host: isFleet ? (a.name === "ClawdBot" ? "Azure VM" : "Android") : "Mac",
          session_key: a.session_key ?? null,
          last_active_seconds: a.last_active_seconds ?? null,
          total_tokens: a.total_tokens ?? null,
        };
      });

      set({ agentsList: agents, isLoading: false });
    } catch (error) {
      console.error("Failed to load agents:", error);
      set({ isLoading: false });
    }
  },

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
}));

// Auto-refresh every 10 seconds
let intervalId: NodeJS.Timeout | null = null;

export function startTopologySync() {
  if (intervalId) return;
  const store = useTopologyStore.getState();
  store.loadAgents();
  intervalId = setInterval(() => {
    useTopologyStore.getState().loadAgents();
  }, 10_000);
}

export function stopTopologySync() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
