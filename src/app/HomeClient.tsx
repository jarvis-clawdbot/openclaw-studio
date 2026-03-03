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
  total_tokens: number | null;
};

type Analytics = { total_tokens: number; total_cost: number; total_requests: number };
type ActivityEvent = { id: number; event_type: string; description: string; created_at: string };

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500",
  idle: "bg-slate-500",
  stuck: "bg-amber-500",
  offline: "bg-red-500",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function HomeClient() {
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [agentsRes, analyticsRes, activityRes, tasksRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/agents/live`),
          fetch(`${BACKEND_URL}/api/analytics/summary`),
          fetch(`${BACKEND_URL}/api/activity?limit=8`),
          fetch(`${BACKEND_URL}/api/tasks`),
        ]);
        if (agentsRes.ok) setAgents(await agentsRes.json());
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
        if (activityRes.ok) setActivity(await activityRes.json());
        if (tasksRes.ok) {
          const tasks = await tasksRes.json();
          setTaskCount(Array.isArray(tasks) ? tasks.length : 0);
        }
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = agents.filter((a) => a.status === "active").length;

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white/40">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 p-6 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-white/40 mt-1">OpenClaw Agent Fleet Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl bg-gradient-to-br from-blue-600/20 to-blue-900/20 border border-blue-500/20 p-4">
          <div className="text-xs text-blue-300/60 uppercase tracking-wide">Active Agents</div>
          <div className="text-3xl font-bold text-blue-400 mt-1">{activeCount}<span className="text-lg text-blue-400/50">/{agents.length}</span></div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 border border-emerald-500/20 p-4">
          <div className="text-xs text-emerald-300/60 uppercase tracking-wide">Total Tokens</div>
          <div className="text-3xl font-bold text-emerald-400 mt-1">{analytics ? formatTokens(analytics.total_tokens) : "—"}</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-600/20 to-purple-900/20 border border-purple-500/20 p-4">
          <div className="text-xs text-purple-300/60 uppercase tracking-wide">API Requests</div>
          <div className="text-3xl font-bold text-purple-400 mt-1">{analytics?.total_requests ?? "—"}</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-600/20 to-amber-900/20 border border-amber-500/20 p-4">
          <div className="text-xs text-amber-300/60 uppercase tracking-wide">Tasks</div>
          <div className="text-3xl font-bold text-amber-400 mt-1">{taskCount}</div>
        </div>
      </div>

      {/* Main Content: Agents + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Cards */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Agent Fleet</h2>
            <Link href="/agents" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.map((agent) => (
              <Link key={agent.id} href={`/agents/${agent.id}`} className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-white/20 hover:bg-white/[0.07] transition-all group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: agent.avatarColor }}>
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold truncate">{agent.name}</h3>
                      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status] || "bg-slate-500"} ${agent.status === "active" ? "animate-pulse" : ""}`} />
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{agent.role}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-white/30 font-mono">{agent.model || "—"}</span>
                      {agent.total_tokens != null && (
                        <span className="text-xs text-white/30">{formatTokens(agent.total_tokens)} tokens</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
            <Link href="/audit" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
            {activity.length === 0 ? (
              <div className="p-6 text-center text-white/30 text-sm">No recent activity</div>
            ) : (
              <div className="divide-y divide-white/5">
                {activity.map((evt) => (
                  <div key={evt.id} className="p-3 hover:bg-white/5 transition-colors">
                    <p className="text-sm text-white/80 line-clamp-2">{evt.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-white/30 uppercase tracking-wide">{evt.event_type}</span>
                      <span className="text-[10px] text-white/20">•</span>
                      <span className="text-[10px] text-white/30">{timeAgo(evt.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-white/50 mb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/command-center" className="rounded-lg bg-blue-600/20 border border-blue-500/20 p-3 text-center hover:bg-blue-600/30 transition-colors">
                <span className="text-lg">🎛️</span>
                <p className="text-xs text-blue-300 mt-1">Command</p>
              </Link>
              <Link href="/topology" className="rounded-lg bg-purple-600/20 border border-purple-500/20 p-3 text-center hover:bg-purple-600/30 transition-colors">
                <span className="text-lg">🗺️</span>
                <p className="text-xs text-purple-300 mt-1">Topology</p>
              </Link>
              <Link href="/boards" className="rounded-lg bg-emerald-600/20 border border-emerald-500/20 p-3 text-center hover:bg-emerald-600/30 transition-colors">
                <span className="text-lg">🗂️</span>
                <p className="text-xs text-emerald-300 mt-1">Boards</p>
              </Link>
              <Link href="/logs" className="rounded-lg bg-amber-600/20 border border-amber-500/20 p-3 text-center hover:bg-amber-600/30 transition-colors">
                <span className="text-lg">📄</span>
                <p className="text-xs text-amber-300 mt-1">Logs</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
