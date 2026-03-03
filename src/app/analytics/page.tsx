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
    <div className="h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-500">Loading analytics...</div>
    </div>
  );

  return (
    <div className="h-screen bg-slate-900 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-sm text-white/40 mt-1">Real token usage from OpenClaw sessions</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "14d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded text-sm ${
                range === r ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-slate-400 text-sm mb-4">Loading…</div>}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Tokens", value: summary?.total_tokens.toLocaleString() ?? "—", color: "bg-blue-600" },
          { label: "Est. Cost (USD)", value: summary ? `$${summary.total_cost.toFixed(4)}` : "—", color: "bg-green-600" },
          { label: "Total Records", value: summary?.total_requests.toLocaleString() ?? "—", color: "bg-purple-600" },
          { label: "Active Agents", value: byAgent.length.toString(), color: "bg-orange-600" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.color} p-4 rounded-lg`}>
            <div className="text-white/80 text-sm mb-1">{stat.label}</div>
            <div className="text-white text-3xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily token usage */}
        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Daily Token Usage</h2>
          {daily.length === 0 && !loading ? (
            <p className="text-slate-400 text-sm">No data for selected range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px" }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Line type="monotone" dataKey="tokens" stroke="#3b82f6" strokeWidth={2} dot={false} name="Tokens" />
                <Line type="monotone" dataKey="requests" stroke="#22c55e" strokeWidth={2} dot={false} name="Records" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Per-agent token breakdown */}
        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Token Usage by Agent</h2>
          {agentUsage.length === 0 && !loading ? (
            <p className="text-slate-400 text-sm">No agent data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="agentName" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px" }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Bar dataKey="tokens" fill="#3b82f6" name="Total Tokens" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model distribution */}
        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Model Distribution</h2>
          {modelData.length === 0 && !loading ? (
            <p className="text-slate-400 text-sm">No model data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={modelData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={(e) => e.name}>
                  {modelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px" }}
                  formatter={(v: any) => [v.toLocaleString(), "Tokens"]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Per-agent table */}
        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Agent Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700">
                <tr>
                  <th className="pb-2 text-slate-400">Agent</th>
                  <th className="pb-2 text-slate-400 text-right">Total Tokens</th>
                  <th className="pb-2 text-slate-400 text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {agentUsage.map((a) => (
                  <tr key={a.agentName} className="border-b border-slate-700/50">
                    <td className="py-2 text-white">{a.agentName}</td>
                    <td className="py-2 text-slate-300 text-right">{a.tokens.toLocaleString()}</td>
                    <td className="py-2 text-emerald-400 text-right">${a.cost.toFixed(4)}</td>
                  </tr>
                ))}
                {agentUsage.length === 0 && !loading && (
                  <tr><td colSpan={3} className="py-4 text-slate-500 text-center">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

