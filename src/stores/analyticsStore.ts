import { create } from "zustand";
import { backendApi } from "@/lib/backend-api";

export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  agents: {
    id: string;
    name: string;
    inputTokens: number;
    outputTokens: number;
    requests: number;
  }[];
  models: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    requests: number;
  }[];
}

interface AnalyticsState {
  stats: UsageStats | null;
  range: "24h" | "7d" | "30d";
  isLoading: boolean;
  error: string | null;
  loadStats: (range?: "24h" | "7d" | "30d") => Promise<void>;
  setRange: (range: "24h" | "7d" | "30d") => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  stats: null,
  range: "24h",
  isLoading: false,
  error: null,

  loadStats: async (range) => {
    const r = range || get().range;
    set({ isLoading: true, error: null, range: r });
    try {
      const data = await backendApi.getUsageStats(r);
      set({
        stats: {
          totalInputTokens: data.total_input_tokens,
          totalOutputTokens: data.total_output_tokens,
          totalRequests: data.total_requests,
          agents: data.agents.map((a: any) => ({
            id: a.id,
            name: a.name,
            inputTokens: a.input_tokens,
            outputTokens: a.output_tokens,
            requests: a.requests,
          })),
          models: data.models.map((m: any) => ({
            model: m.model,
            inputTokens: m.input_tokens,
            outputTokens: m.output_tokens,
            requests: m.requests,
          })),
        },
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setRange: (range) => {
    set({ range });
    get().loadStats(range);
  },
}));
