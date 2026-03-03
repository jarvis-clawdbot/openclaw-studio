"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type LiveAgent = {
  id: string;
  name: string;
  status: "active" | "idle" | "stuck" | "offline";
  model: string | null;
  role: string;
  avatarColor: string;
  session_key: string | null;
  last_active_seconds: number | null;
  total_tokens: number | null;
};

type AgentStat = { agent: string; tokens: number; cost: number };

const statusBadge: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  idle: "bg-slate-500/20 text-slate-400 border border-slate-500/30",
  stuck: "bg-red-500/20 text-red-400 border border-red-500/30",
  offline: "bg-gray-500/20 text-gray-500 border border-gray-500/30",
};

function formatAge(secs: number | null): string {
  if (secs === null) return "—";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [liveRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/agents/live`),
        fetch(`${BACKEND_URL}/api/analytics/by-agent`),
      ]);
      if (liveRes.ok) setAgents(await liveRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {
      console.error("[Agents] fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStats = (name: string) =>
    stats.find((s) => s.agent.toLowerCase() === name.toLowerCase());

  return (
    <div className="h-screen bg-slate-900 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agents</h1>
          <p className="text-sm text-white/40 mt-1">Live status and usage for all OpenClaw agents</p>
        </div>
        <Link
          href="/agents/create"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium"
        >
          + New Agent
        </Link>
      </div>

      {loading && <div className="text-slate-400 text-sm">Loading agents…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {agents.map((agent) => {
          const stat = getStats(agent.name);
          return (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="block bg-slate-800 border border-white/10 rounded-xl p-5 hover:border-blue-500/50 hover:bg-slate-700/60 transition-all"
            >
              {/* Avatar + name */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: agent.avatarColor }}
                >
                  {agent.name[0]}
                </div>
                <div>
                  <div className="text-white font-semibold">{agent.name}</div>
                  <div className="text-white/40 text-xs">{agent.role}</div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[agent.status] ?? statusBadge.idle}`}>
                  {agent.status}
                </span>
                <span className="text-white/30 text-xs">{formatAge(agent.last_active_seconds)}</span>
              </div>

              {/* Model */}
              <div className="text-white/40 text-xs mb-3 truncate">
                {agent.model ? agent.model.split("/").pop() : "No active session"}
              </div>

              {/* Token stats */}
              <div className="border-t border-white/10 pt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-white/40 text-xs">Session</div>
                  <div className="text-white text-sm font-semibold">
                    {agent.total_tokens?.toLocaleString() ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-white/40 text-xs">All-time</div>
                  <div className="text-white text-sm font-semibold">
                    {stat?.tokens?.toLocaleString() ?? "—"}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {!loading && agents.length === 0 && (
          <div className="col-span-4 text-slate-500 text-center py-12">
            No agents found. Make sure the backend is running.
          </div>
        )}
      </div>
    </div>
  );
}
