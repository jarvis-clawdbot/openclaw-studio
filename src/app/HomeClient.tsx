"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BACKEND_URL } from "@/lib/config";


type LiveAgent = {
  id: number | string;
  name: string;
  status: "active" | "idle" | "stuck" | "offline";
  model: string | null;
  role: string;
  avatarColor: string;
  avatar_color?: string;
  agent_type?: "local" | "fleet";
  host?: string;
  total_tokens: number | null;
  last_active_seconds: number | null;
};

type Analytics = { total_tokens: number; total_cost: number; total_requests: number };
type DailyRecord = { date: string; tokens: number; cost: number; requests: number };
type ActivityEvent = { id: number; event_type: string; description: string; created_at: string };

const STATUS_META: Record<string, { color: string; glow: string; label: string; ring: string }> = {
  active: { color: "bg-emerald-400", glow: "glow-active", label: "Active", ring: "ring-pulse" },
  idle:   { color: "bg-slate-500",   glow: "",            label: "Idle",   ring: "" },
  stuck:  { color: "bg-amber-400",   glow: "",            label: "Stuck",  ring: "" },
  offline:{ color: "bg-red-400",     glow: "",            label: "Offline",ring: "" },
};

const EVENT_ICONS: Record<string, string> = {
  agent_start: "🚀", agent_stop: "🛑", task_created: "📋", task_completed: "✅",
  message_sent: "💬", error: "⚠️", system: "⚙️", default: "📌",
};

const STAT_ACCENTS = [
  { top: "stat-accent-top stat-accent-blue",   neon: "neon-border-blue"   },
  { top: "stat-accent-top stat-accent-green",  neon: "neon-border-green"  },
  { top: "stat-accent-top stat-accent-purple", neon: "neon-border-purple" },
  { top: "stat-accent-top stat-accent-amber",  neon: "neon-border-amber"  },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function lastActiveFmt(secs: number | null): string {
  if (secs == null) return "Never";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function TrendBadge({ today, prev }: { today: number; prev: number }) {
  if (prev === 0) return null;
  const pct = ((today - prev) / prev) * 100;
  const up = pct > 0;
  return (
    <span className={`text-[10px] font-semibold ${up ? "trend-up" : "trend-down"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accentIdx: number;
  delay: number;
  trend?: { today: number; prev: number };
};

function StatCard({ label, value, sub, icon, accentIdx, delay, trend }: StatCardProps) {
  const acc = STAT_ACCENTS[accentIdx % STAT_ACCENTS.length];
  return (
    <div
      className={`animate-card-enter glass-card p-5 relative overflow-hidden ${acc.top} ${acc.neon}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-2">{label}</div>
          <div className="text-3xl font-bold text-white tabular-nums animate-count">{value}</div>
          {sub && <div className="text-xs text-white/25 mt-1">{sub}</div>}
          {trend && (
            <div className="mt-2 flex items-center gap-1.5">
              <TrendBadge today={trend.today} prev={trend.prev} />
              <span className="text-[10px] text-white/20">vs prev day</span>
            </div>
          )}
        </div>
        <div className="text-2xl opacity-40 ml-3 flex-shrink-0">{icon}</div>
      </div>
    </div>
  );
}

export default function HomeClient() {
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [daily, setDaily] = useState<DailyRecord[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [agentsRes, analyticsRes, dailyRes, activityRes, tasksRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/agents`),
          fetch(`${BACKEND_URL}/api/analytics/summary`),
          fetch(`${BACKEND_URL}/api/analytics/daily?days=7`),
          fetch(`${BACKEND_URL}/api/activity?limit=8`),
          fetch(`${BACKEND_URL}/api/tasks`),
        ]);
        if (agentsRes.ok) {
          const raw = await agentsRes.json();
          // Normalize DB response to match LiveAgent shape
          setAgents(raw.map((a: any) => ({
            ...a,
            avatarColor: a.avatar_color || a.avatarColor || "#6b7280",
            agent_type: a.role?.toLowerCase().includes("worker") ? "fleet" : "local",
            host: a.name === "ClawdBot" ? "Azure VM" : a.name === "Cathy" ? "Android" : "Mac",
          })));
        }
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
        if (dailyRes.ok) setDaily(await dailyRes.json());
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

  // Today vs yesterday from daily data
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayData = daily.find((d) => d.date === todayStr);
  const prevData = daily.filter((d) => d.date < todayStr).at(-1);

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 bg-grid p-6 overflow-auto dashboard-scroll">
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
    <div className="h-screen bg-slate-950 bg-grid p-6 overflow-auto dashboard-scroll page-enter">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
          <p className="text-sm text-white/30 mt-1">OpenClaw Agent Fleet · real-time</p>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
              ⚠ Backend unreachable
            </span>
          )}
          <div className="flex items-center gap-2 text-xs text-white/30 bg-white/5 border border-white/8 px-3 py-1.5 rounded-full">
            <div className={`w-2 h-2 rounded-full ${error ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
            {error ? "Disconnected" : "Live"}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Agents"
          value={`${activeCount} / ${agents.length}`}
          sub={activeCount > 0 ? "Processing requests" : "All idle"}
          icon="🤖"
          accentIdx={0}
          delay={0}
        />
        <StatCard
          label="Today's Tokens"
          value={todayData ? formatTokens(todayData.tokens) : analytics ? formatTokens(analytics.total_tokens) : "—"}
          sub={analytics ? `${formatTokens(analytics.total_tokens)} total` : undefined}
          icon="🔢"
          accentIdx={1}
          delay={80}
          trend={todayData && prevData ? { today: todayData.tokens, prev: prevData.tokens } : undefined}
        />
        <StatCard
          label="Today's Cost"
          value={todayData ? formatCost(todayData.cost) : analytics ? formatCost(analytics.total_cost) : "—"}
          sub={analytics ? `${formatCost(analytics.total_cost)} all-time` : undefined}
          icon="💰"
          accentIdx={2}
          delay={160}
          trend={todayData && prevData ? { today: todayData.cost, prev: prevData.cost } : undefined}
        />
        <StatCard
          label="Tasks"
          value={String(taskCount)}
          sub={`${analytics?.total_requests ?? 0} API calls`}
          icon="📋"
          accentIdx={3}
          delay={240}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Fleet */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              Agent Fleet
              {activeCount > 0 && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                  {activeCount} active
                </span>
              )}
            </h2>
            <Link href="/agents" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {agents.map((agent, i) => {
              const meta = STATUS_META[agent.status] || STATUS_META.idle;
              const isActive = agent.status === "active";
              return (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className={`glass-card p-4 group animate-card-enter transition-all ${isActive ? "neon-border-green" : ""}`}
                  style={{ animationDelay: `${300 + i * 80}ms` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar with pulse ring for active agents */}
                    <div className={`relative ${isActive ? meta.ring : ""}`}>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                        style={{ backgroundColor: agent.avatarColor }}
                      >
                        {agent.name[0]}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${meta.color} ${meta.glow}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          {agent.agent_type === "fleet" && (
                            <div className="text-[9px] font-semibold uppercase tracking-widest text-purple-400 mb-0.5">
                              {agent.host}
                            </div>
                          )}
                          <h3 className="text-white font-semibold truncate group-hover:text-blue-300 transition-colors">{agent.name}</h3>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider flex-shrink-0
                          ${isActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                            agent.status === "stuck" ? "bg-amber-500/20 text-amber-400" :
                            "bg-white/5 text-white/30"}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-white/35 mt-0.5">{agent.role}</p>

                      {/* Model + last active */}
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-[11px] text-white/20 font-mono bg-white/5 px-1.5 py-0.5 rounded truncate max-w-[110px]">
                          {agent.model?.split("/").pop()?.replace("claude-", "").replace("-latest", "") || "—"}
                        </span>
                        <span className={`text-[10px] ${isActive ? "text-emerald-400/70" : "text-white/20"}`}>
                          {isActive ? "⚡ " : ""}
                          {lastActiveFmt(agent.last_active_seconds)}
                        </span>
                      </div>

                      {/* Token bar */}
                      {agent.total_tokens != null && agent.total_tokens > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-white/20">Tokens used</span>
                            <span className="text-[10px] text-cyan-400/50 font-mono">{formatTokens(agent.total_tokens)}</span>
                          </div>
                          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.min(100, (agent.total_tokens / 200000) * 100)}%`,
                                backgroundColor: agent.avatarColor,
                                opacity: 0.7,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Activity Feed */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Recent Activity</h2>
              <Link href="/audit" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</Link>
            </div>
            <div className="glass-card overflow-hidden max-h-72 overflow-y-auto dashboard-scroll">
              {activity.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-3xl mb-2">📭</div>
                  <p className="text-white/30 text-sm">No recent activity</p>
                  <p className="text-white/15 text-xs mt-1">Events appear as agents work</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {activity.map((evt, i) => (
                    <div
                      key={evt.id}
                      className="px-3 py-2.5 hover:bg-white/5 transition-colors flex items-start gap-2.5 animate-card-enter"
                      style={{ animationDelay: `${400 + i * 50}ms` }}
                    >
                      <span className="text-sm mt-0.5 flex-shrink-0 w-5 text-center">
                        {EVENT_ICONS[evt.event_type] || EVENT_ICONS.default}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/70 line-clamp-2 leading-snug">{evt.description}</p>
                        <span className="text-[10px] text-white/20 mt-0.5 block">{timeAgo(evt.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Today's breakdown (only if daily data exists) */}
          {todayData && (
            <div className="glass-card p-4">
              <div className="text-xs text-white/30 uppercase tracking-widest font-semibold mb-3">Today's Usage</div>
              <div className="space-y-2.5">
                {[
                  { label: "Tokens", value: formatTokens(todayData.tokens), bar: todayData.tokens / (analytics?.total_tokens || 1), color: "bg-sky-500" },
                  { label: "Cost", value: formatCost(todayData.cost), bar: todayData.cost / (analytics?.total_cost || 1), color: "bg-violet-500" },
                  { label: "Requests", value: String(todayData.requests), bar: todayData.requests / (analytics?.total_requests || 1), color: "bg-emerald-500" },
                ].map(({ label, value, bar, color }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/40">{label}</span>
                      <span className="text-xs text-white/70 font-mono">{value}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(100, bar * 100).toFixed(1)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <h3 className="text-xs font-semibold text-white/25 mb-3 uppercase tracking-widest">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: "/command-center", icon: "🎛️", label: "Command", cls: "border-blue-500/20 hover:border-blue-400/50 text-blue-300 hover:bg-blue-500/10" },
                { href: "/topology",       icon: "🗺️", label: "Topology", cls: "border-purple-500/20 hover:border-purple-400/50 text-purple-300 hover:bg-purple-500/10" },
                { href: "/boards",         icon: "🗂️", label: "Boards",   cls: "border-emerald-500/20 hover:border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/10" },
                { href: "/analytics",      icon: "📊", label: "Analytics",cls: "border-amber-500/20 hover:border-amber-400/50 text-amber-300 hover:bg-amber-500/10" },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={`rounded-xl border bg-white/3 p-3.5 text-center transition-all hover:scale-[1.02] active:scale-[0.98] ${a.cls}`}
                >
                  <span className="text-xl">{a.icon}</span>
                  <p className="text-xs mt-1.5 font-medium">{a.label}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
