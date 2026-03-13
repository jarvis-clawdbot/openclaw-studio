"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BACKEND_URL } from "@/lib/config";


type DBAgent = {
  id: number;
  name: string;
  status: string;
  model: string | null;
  role: string;
  avatar_color: string;
  total_tokens?: number;
};

type AgentStat = { agent: string; tokens: number; cost: number };

const statusBadge: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  idle: "bg-slate-500/20 text-slate-400 border border-slate-500/30",
  stuck: "bg-red-500/20 text-red-400 border border-red-500/30",
  offline: "bg-gray-500/20 text-gray-500 border border-gray-500/30",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<DBAgent[]>([]);
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [agentsRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/agents`),
        fetch(`${BACKEND_URL}/api/analytics/by-agent`),
      ]);
      if (agentsRes.ok) setAgents(await agentsRes.json());
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
    <div className="h-screen bg-slate-950 p-6 overflow-auto dashboard-scroll page-enter">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Agents</h1>
          <p className="text-sm text-white/40 mt-1">Live status and usage for all OpenClaw agents</p>
        </div>
        <Link
          href="/agents/create"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition-colors"
        >
          + New Agent
        </Link>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent, i) => {
            const stat = getStats(agent.name);
            const isActive = agent.status === "active";
            const isFleet = agent.role?.toLowerCase().includes("worker");
            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="block glass-card p-5 animate-card-enter"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* Fleet badge */}
                {isFleet && (
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-purple-400 mb-2">
                    {agent.role?.includes("Azure") ? "Azure VM" : "Android"}
                  </div>
                )}
                {/* Avatar + name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
                      style={{ backgroundColor: agent.avatar_color }}
                    >
                      {agent.name[0]}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                      isActive ? "bg-emerald-400 glow-active" :
                      agent.status === "stuck" ? "bg-amber-400" :
                      agent.status === "offline" ? "bg-red-400" : "bg-slate-400"
                    }`} />
                  </div>
                  <div>
                    <div className="text-white font-semibold">{agent.name}</div>
                    <div className="text-white/40 text-xs">{agent.role}</div>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusBadge[agent.status] ?? statusBadge.idle}`}>
                    {agent.status}
                  </span>
                </div>

                {/* Model */}
                <div className="text-white/40 text-xs mb-3 truncate font-mono bg-white/5 px-2 py-1 rounded">
                  {agent.model ? agent.model.split("/").pop() : "No active session"}
                </div>

                {/* Token stats */}
                <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-white/30 text-[10px] uppercase tracking-wider">Session</div>
                    <div className="text-white text-sm font-semibold">
                      {agent.total_tokens?.toLocaleString() ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/30 text-[10px] uppercase tracking-wider">All-time</div>
                    <div className="text-cyan-400 text-sm font-semibold">
                      {stat?.tokens?.toLocaleString() ?? "—"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {!loading && agents.length === 0 && (
            <div className="col-span-4 glass-card text-center py-16">
              <div className="text-4xl mb-3">🤖</div>
              <p className="text-white/40">No agents found</p>
              <p className="text-white/20 text-sm mt-1">Make sure the backend is running</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
