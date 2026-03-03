import { create } from "zustand";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  level: LogLevel;
  message: string;
  toolCall?: string;
}

const RING_MAX = 50_000;

const AGENT_COLORS: Record<string, string> = {
  jarvis: "text-blue-400",
  wolff: "text-purple-400",
  dobby: "text-green-400",
  claudy: "text-yellow-400",
  system: "text-slate-400",
};

interface LogState {
  entries: LogEntry[];
  filter: {
    agentId: string | null;
    level: LogLevel | null;
    search: string;
  };
  autoScroll: boolean;
  addEntry: (entry: Omit<LogEntry, "id">) => void;
  addEntries: (entries: Omit<LogEntry, "id">[]) => void;
  setFilter: (filter: Partial<LogState["filter"]>) => void;
  setAutoScroll: (v: boolean) => void;
  clear: () => void;
  getFiltered: () => LogEntry[];
  getAgentColor: (agentId: string) => string;
}

let counter = 0;
const nextId = () => `log-${++counter}`;

export const useLogStore = create<LogState>((set, get) => ({
  entries: [],
  filter: { agentId: null, level: null, search: "" },
  autoScroll: true,

  addEntry: (entry) =>
    set((s) => {
      const next = [...s.entries, { ...entry, id: nextId() }];
      return { entries: next.length > RING_MAX ? next.slice(-RING_MAX) : next };
    }),

  addEntries: (newEntries) =>
    set((s) => {
      const tagged = newEntries.map((e) => ({ ...e, id: nextId() }));
      const next = [...s.entries, ...tagged];
      return { entries: next.length > RING_MAX ? next.slice(-RING_MAX) : next };
    }),

  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
  setAutoScroll: (v) => set({ autoScroll: v }),
  clear: () => set({ entries: [] }),

  getFiltered: () => {
    const { entries, filter } = get();
    return entries.filter((e) => {
      if (filter.agentId && e.agentId !== filter.agentId) return false;
      if (filter.level && e.level !== filter.level) return false;
      if (filter.search && !e.message.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  },

  getAgentColor: (agentId) => AGENT_COLORS[agentId.toLowerCase()] ?? "text-slate-300",
}));
