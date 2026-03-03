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

const STATUS_META: Record<string, { color: string; glow: string; label: string }> = {
  active: { color: "bg-emerald-400", glow: "glow-active", label: "Active" },
  idle: { color: "bg-slate-400", glow: "", label: "Idle" },
  stuck: { color: "bg-amber-400", glow: "", label: "Stuck" },
  offline: { color: "bg-red-400", glow: "", label: "Offline" },
};

const EVENT_ICONS: Record<string, string> = {
  agent_start: "🚀", agent_stop: "🛑", task_created: "📋", task_completed: "✅",
  message_sent: "💬", error: "⚠️", system: "⚙️", default: "📌",
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

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function StatCard({ label, value, sub, gradient, delay }: { label: string; value: string; sub?: string; gradient: string; delay: number }) {
  return (
    <div
      className={`animate-card-enter glass-card p-5 relative overflow-hidden group`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-0 opacity-20 ${gradient}`} />
      <div className="relative">
        <div className="text-xs text-white/50 uppercase tracking-wider font-medium">{label}</div>
        <div className="text-3xl font-bold text-white mt-2 animate-count">{value}</div>
        {sub && <div className="text-xs text-white/30 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export default function HomeClient() {
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
        setError(false);
      } catch (e) {
        console.error("Dashboard load error:", e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 12000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = agents.filter((a) => a.status === "active").length;

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 p-6 overflow-auto dashboard-scroll">
        <div className="mb-8"><div className="skeleton h-8 w-48 mb-2" /><div className="skeleton h-4 w-72" /></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
          </div>
          <div className="skeleton h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 p-6 overflow-auto dashboard-scroll page-enter">
      {/* Header with gradient accent */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
          <p className="text-sm text-white/40 mt-1">OpenClaw Agent Fleet Overview</p>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
              ⚠ Backend unreachable
            </span>
          )}
          <div className="flex items-center gap-2 text-xs text-white/30">
            <div className={`w-2 h-2 rounded-full ${error ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
            {error ? "Disconnected" : "Live"}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Agents"
          value={`${activeCount}/${agents.length}`}
          sub={activeCount > 0 ? "Processing requests" : "All idle"}
          gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
          delay={0}
        />
        <StatCard
          label="Total Tokens"
          value={analytics ? formatTokens(analytics.total_tokens) : "—"}
          sub={analytics ? `${analytics.total_tokens.toLocaleString()} exact` : undefined}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          delay={80}
        />
        <StatCard
          label="Est. Cost"
          value={analytics ? formatCost(analytics.total_cost) : "—"}
          sub="All-time usage"
          gradient="bg-gradient-to-br from-purple-500 to-violet-600"
          delay={160}
        />
        <StatCard
          label="Tasks"
          value={String(taskCount)}
          sub={`${analytics?.total_requests ?? 0} API requests`}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          delay={240}
        />
      </div>

      {/* Main Content: Agents + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Cards */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              Agent Fleet
              {activeCount > 0 && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {activeCount} active
                </span>
              )}
            </h2>
            <Link href="/agents" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {agents.map((agent, i) => {
              const meta = STATUS_META[agent.status] || STATUS_META.idle;
              return (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="glass-card p-4 group animate-card-enter"
                  style={{ animationDelay: `${300 + i * 80}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
                        style={{ backgroundColor: agent.avatarColor }}
                      >
                        {agent.name[0]}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${meta.color} ${meta.glow}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold truncate group-hover:text-blue-300 transition-colors">{agent.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider
                          ${agent.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                            agent.status === "stuck" ? "bg-amber-500/20 text-amber-400" :
                            "bg-slate-500/20 text-slate-400"}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">{agent.role}</p>
                      <div className="flex items-center gap-3 mt-2.5">
                        <span className="text-[11px] text-white/25 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                          {agent.model?.split("/").pop() || "no model"}
                        </span>
                        {agent.total_tokens != null && (
                          <span className="text-[11px] text-cyan-400/60">{formatTokens(agent.total_tokens)} tokens</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Column: Activity + Quick Actions */}
        <div className="space-y-6">
          {/* Activity Feed */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
              <Link href="/audit" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</Link>
            </div>
            <div className="glass-card overflow-hidden">
              {activity.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-3xl mb-2">📭</div>
                  <p className="text-white/30 text-sm">No recent activity</p>
                  <p className="text-white/15 text-xs mt-1">Events will appear here as agents work</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {activity.map((evt, i) => (
                    <div
                      key={evt.id}
                      className="p-3 hover:bg-white/5 transition-colors animate-card-enter flex items-start gap-3"
                      style={{ animationDelay: `${400 + i * 60}ms` }}
                    >
                      <span className="text-sm mt-0.5 flex-shrink-0">
                        {EVENT_ICONS[evt.event_type] || EVENT_ICONS.default}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 line-clamp-2 leading-snug">{evt.description}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-cyan-400/50 uppercase tracking-wide font-medium">{evt.event_type.replace(/_/g, " ")}</span>
                          <span className="text-[10px] text-white/15">•</span>
                          <span className="text-[10px] text-white/25">{timeAgo(evt.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-medium text-white/40 mb-3 uppercase tracking-wider">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: "/command-center", icon: "🎛️", label: "Command", color: "from-blue-600/20 to-blue-800/10 border-blue-500/20 hover:border-blue-400/40 text-blue-300" },
                { href: "/topology", icon: "🗺️", label: "Topology", color: "from-purple-600/20 to-purple-800/10 border-purple-500/20 hover:border-purple-400/40 text-purple-300" },
                { href: "/boards", icon: "🗂️", label: "Boards", color: "from-emerald-600/20 to-emerald-800/10 border-emerald-500/20 hover:border-emerald-400/40 text-emerald-300" },
                { href: "/analytics", icon: "📊", label: "Analytics", color: "from-amber-600/20 to-amber-800/10 border-amber-500/20 hover:border-amber-400/40 text-amber-300" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`rounded-xl bg-gradient-to-br ${action.color} border p-3.5 text-center transition-all hover:scale-[1.02] active:scale-[0.98]`}
                >
                  <span className="text-xl">{action.icon}</span>
                  <p className="text-xs mt-1.5 font-medium">{action.label}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
