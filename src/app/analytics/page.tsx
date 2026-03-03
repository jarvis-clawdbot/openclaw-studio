"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ef4444"];

type DayStat = { date: string; tokens: number; cost: number; requests: number };
type AgentStat = { agent: string; tokens: number; cost: number };
type ModelStat = { model: string; tokens: number; count: number };
type Summary = { total_tokens: number; total_cost: number; total_requests: number };

export default function AnalyticsPage() {
  const [range, setRange] = useState<"7d" | "14d" | "30d">("7d");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DayStat[]>([]);
  const [byAgent, setByAgent] = useState<AgentStat[]>([]);
  const [byModel, setByModel] = useState<ModelStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const days = range === "7d" ? 7 : range === "14d" ? 14 : 30;
    const load = async () => {
      setLoading(true);
      try {
        const [sumRes, dailyRes, agentRes, modelRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/analytics/summary`),
          fetch(`${BACKEND_URL}/api/analytics/daily?days=${days}`),
          fetch(`${BACKEND_URL}/api/analytics/by-agent`),
          fetch(`${BACKEND_URL}/api/analytics/by-model`),
        ]);
        if (sumRes.ok) setSummary(await sumRes.json());
        if (dailyRes.ok) setDaily(await dailyRes.json());
        if (agentRes.ok) setByAgent(await agentRes.json());
        if (modelRes.ok) {
          const raw = await modelRes.json();
          setByModel(Array.isArray(raw) ? raw : []);
        }
      } catch (e) {
        console.error("[Analytics] fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [range]);

  const modelData = byModel.map((m, i) => ({
    name: m.model?.split("/").pop() || m.model || "unknown",
    value: m.tokens,
    color: COLORS[i % COLORS.length],
  }));

  const agentUsage = byAgent.map((a) => ({
    agentName: a.agent,
    tokens: a.tokens,
    cost: a.cost,
  }));

  if (!mounted) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-500">Loading analytics...</div>
    </div>
  );

  return (
    <div className="h-screen bg-slate-950 p-6 overflow-auto dashboard-scroll page-enter">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Analytics</h1>
          <p className="text-sm text-white/40 mt-1">Real token usage from OpenClaw sessions</p>
        </div>
        <div className="flex gap-1.5 bg-white/5 rounded-lg p-1">
          {(["7d", "14d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                range === r ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Tokens", value: summary?.total_tokens.toLocaleString() ?? "—", icon: "⚡", gradient: "from-blue-500/20 to-cyan-600/10", border: "border-blue-500/20" },
          { label: "Est. Cost", value: summary ? `$${summary.total_cost.toFixed(4)}` : "—", icon: "💰", gradient: "from-emerald-500/20 to-teal-600/10", border: "border-emerald-500/20" },
          { label: "Total Records", value: summary?.total_requests.toLocaleString() ?? "—", icon: "📊", gradient: "from-purple-500/20 to-violet-600/10", border: "border-purple-500/20" },
          { label: "Active Agents", value: byAgent.length.toString(), icon: "🤖", gradient: "from-amber-500/20 to-orange-600/10", border: "border-amber-500/20" },
        ].map((stat, i) => (
          <div key={stat.label} className={`glass-card p-5 bg-gradient-to-br ${stat.gradient} ${stat.border} animate-card-enter`} style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between">
              <div className="text-white/50 text-xs uppercase tracking-wider font-medium">{stat.label}</div>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <div className="text-white text-2xl font-bold mt-2">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily token usage */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Daily Token Usage</h2>
          {daily.length === 0 && !loading ? (
            <div className="h-[300px] flex items-center justify-center text-white/30 text-sm">No data for selected range</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily}>
                <defs>
                  <linearGradient id="tokenLine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", backdropFilter: "blur(12px)" }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Line type="monotone" dataKey="tokens" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Tokens" />
                <Line type="monotone" dataKey="requests" stroke="#22c55e" strokeWidth={2} dot={false} name="Records" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Per-agent token breakdown */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Token Usage by Agent</h2>
          {agentUsage.length === 0 && !loading ? (
            <div className="h-[300px] flex items-center justify-center text-white/30 text-sm">No agent data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentUsage}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="agentName" stroke="#475569" />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Bar dataKey="tokens" fill="url(#barGradient)" name="Total Tokens" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model distribution */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Model Distribution</h2>
          {modelData.length === 0 && !loading ? (
            <div className="h-[300px] flex items-center justify-center text-white/30 text-sm">No model data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={modelData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={(e) => e.name} paddingAngle={2}>
                  {modelData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                  formatter={(v: any) => [v.toLocaleString(), "Tokens"]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Per-agent table */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Agent Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="pb-3 text-white/40 text-xs uppercase tracking-wider font-medium">Agent</th>
                  <th className="pb-3 text-white/40 text-xs uppercase tracking-wider font-medium text-right">Total Tokens</th>
                  <th className="pb-3 text-white/40 text-xs uppercase tracking-wider font-medium text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {agentUsage.map((a) => (
                  <tr key={a.agentName} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 text-white font-medium">{a.agentName}</td>
                    <td className="py-3 text-white/70 text-right font-mono text-xs">{a.tokens.toLocaleString()}</td>
                    <td className="py-3 text-emerald-400 text-right font-mono text-xs">${a.cost.toFixed(4)}</td>
                  </tr>
                ))}
                {agentUsage.length === 0 && !loading && (
                  <tr><td colSpan={3} className="py-8 text-white/30 text-center">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

