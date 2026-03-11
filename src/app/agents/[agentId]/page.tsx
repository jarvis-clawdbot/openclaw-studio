"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BACKEND_URL } from "@/lib/config";


type LiveAgent = {
  id: string | number;
  name: string;
  status: string;
  model: string | null;
  role: string;
  avatarColor: string;
  avatar_color?: string;
  agent_type?: string;
  host?: string;
  session_key: string | null;
  last_active_seconds: number | null;
  total_tokens: number | null;
};

type AgentStat = { agent: string; tokens: number; cost: number };
type DayStat = { date: string; tokens: number; requests: number };
type Session = { sessionKey: string; agentId?: string; model?: string; totalTokens?: number; updatedAt?: string };

function formatAge(secs: number | null): string {
  if (secs === null) return "—";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

const statusColor: Record<string, string> = {
  active: "text-emerald-400",
  idle: "text-slate-400",
  stuck: "text-red-400",
  offline: "text-gray-500",
};

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<LiveAgent | null>(null);
  const [stat, setStat] = useState<AgentStat | null>(null);
  const [daily, setDaily] = useState<DayStat[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentId) return;
    const load = async () => {
      try {
        const [liveRes, statsRes, dailyRes, sessRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/agents`),
          fetch(`${BACKEND_URL}/api/analytics/by-agent`),
          fetch(`${BACKEND_URL}/api/analytics/daily?days=14`),
          fetch(`${BACKEND_URL}/api/sessions`),
        ]);
        if (liveRes.ok) {
          const all: LiveAgent[] = (await liveRes.json()).map((a: any) => ({
            ...a,
            avatarColor: a.avatar_color || a.avatarColor || "#6b7280",
            agent_type: a.role?.toLowerCase().includes("worker") ? "fleet" : "local",
            host: a.name === "ClawdBot" ? "Azure VM" : a.name === "Cathy" ? "Android" : "Mac",
          }));
          // Match by numeric id OR name
          setAgent(all.find((a) => String(a.id) === agentId || a.name.toLowerCase() === agentId.toLowerCase()) ?? null);
        }
        if (statsRes.ok) {
          const all: AgentStat[] = await statsRes.json();
          setStat(all.find((s) => s.agent.toLowerCase() === agentId.toLowerCase()) ?? null);
        }
        if (dailyRes.ok) setDaily(await dailyRes.json());
        if (sessRes.ok) {
          const data = await sessRes.json();
          const all: Session[] = Array.isArray(data) ? data : (data.sessions ?? []);
          setSessions(all.filter((s) => s.agentId?.toLowerCase().includes(agentId.toLowerCase())));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [agentId]);

  if (loading) return (
    <div className="h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400">Loading…</div>
    </div>
  );

  if (!agent) return (
    <div className="h-screen bg-slate-900 p-6">
      <Link href="/agents" className="text-blue-400 hover:underline text-sm">← Back to Agents</Link>
      <p className="text-white/40 mt-4">Agent "{agentId}" not found.</p>
    </div>
  );

  return (
    <div className="h-screen bg-slate-900 p-6 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/agents" className="text-blue-400 hover:underline text-sm">← Back to Agents</Link>
        <div className="flex items-center gap-4 mt-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl"
            style={{ backgroundColor: agent.avatarColor }}
          >
            {agent.name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
            <p className="text-white/40 text-sm">{agent.role}</p>
          </div>
          <span className={`ml-auto text-sm font-semibold ${statusColor[agent.status] ?? "text-slate-400"}`}>
            ● {agent.status}
          </span>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Session Tokens", value: agent.total_tokens?.toLocaleString() ?? "—" },
          { label: "All-time Tokens", value: stat?.tokens?.toLocaleString() ?? "—" },
          { label: "Est. Cost (all-time)", value: stat ? `$${stat.cost.toFixed(4)}` : "—" },
          { label: "Last Active", value: formatAge(agent.last_active_seconds) },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800 border border-white/10 rounded-xl p-4">
            <div className="text-white/40 text-xs mb-1">{s.label}</div>
            <div className="text-white text-xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Model & session key */}
      <div className="bg-slate-800 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-3">Current Session</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-white/40">Model</dt>
            <dd className="text-white font-mono">{agent.model ?? "No active session"}</dd>
          </div>
          <div>
            <dt className="text-white/40">Session Key</dt>
            <dd className="text-white font-mono truncate">{agent.session_key ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <Link
            href={`/agents/${agentId}/settings`}
            className="text-blue-400 hover:underline text-sm"
          >
            Edit agent settings →
          </Link>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="bg-slate-800 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-3">Recent Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-white/40 text-sm">No session history found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-white/40 pb-2">Session Key</th>
                <th className="text-right text-white/40 pb-2">Tokens</th>
                <th className="text-right text-white/40 pb-2">Model</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 10).map((s) => (
                <tr key={s.sessionKey} className="border-t border-white/5">
                  <td className="py-2 text-white/60 font-mono text-xs">{s.sessionKey}</td>
                  <td className="py-2 text-white text-right">{s.totalTokens?.toLocaleString() ?? "—"}</td>
                  <td className="py-2 text-white/40 text-right text-xs">{s.model ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Daily usage mini-chart */}
      {daily.length > 0 && (
        <div className="bg-slate-800 border border-white/10 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3">Platform Daily Usage (last 14 days)</h2>
          <div className="flex items-end gap-1 h-20">
            {daily.map((d) => {
              const max = Math.max(...daily.map((x) => x.tokens));
              const pct = max > 0 ? (d.tokens / max) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.tokens.toLocaleString()} tokens`}>
                  <div className="w-full bg-blue-500/70 rounded-sm" style={{ height: `${pct}%` }} />
                  <span className="text-white/20 text-[9px] rotate-90 mt-1">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
