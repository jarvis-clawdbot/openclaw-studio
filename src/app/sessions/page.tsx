"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Session = {
  sessionKey: string;
  kind?: string;
  label?: string;
  agentId?: string;
  lastMessageAt?: string;
  model?: string;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
};

function formatAge(ts?: string): string {
  if (!ts) return "—";
  const ms = parseInt(ts);
  const date = isNaN(ms) ? new Date(ts) : new Date(ms);
  if (isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions?all_agents=true`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const kindColor = (kind?: string) => {
    if (kind === "direct") return "bg-blue-500/20 text-blue-400";
    if (kind === "subagent") return "bg-purple-500/20 text-purple-400";
    return "bg-white/10 text-white/40";
  };

  return (
    <div className="h-screen bg-slate-900 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-sm text-white/40 mt-1">Active and recent agent sessions</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-white/30 py-12">Loading sessions...</div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400">Error: {error}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/30 text-lg">No sessions found</p>
          <p className="text-white/20 text-sm mt-2">Sessions appear when agents are active</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.sessionKey} className="rounded-xl bg-white/5 border border-white/10 p-4 hover:bg-white/8 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium truncate">
                      {s.label || s.agentId || s.sessionKey}
                    </h3>
                    {s.kind && (
                      <span className={`text-xs rounded px-2 py-0.5 flex-shrink-0 ${kindColor(s.kind)}`}>
                        {s.kind}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/30 font-mono truncate">{s.sessionKey}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-white/40">{formatAge(s.lastMessageAt)}</p>
                  {s.model && (
                    <p className="text-xs text-purple-400 mt-1 font-mono">{s.model.split("/").pop()}</p>
                  )}
                </div>
              </div>
              {(s.totalTokens || s.inputTokens) && (
                <div className="mt-3 flex gap-4 text-xs text-white/30">
                  {s.totalTokens != null && (
                    <span>Total: <span className="text-white/60">{s.totalTokens.toLocaleString()} tokens</span></span>
                  )}
                  {s.inputTokens != null && (
                    <span>In: <span className="text-blue-400">{s.inputTokens.toLocaleString()}</span></span>
                  )}
                  {s.outputTokens != null && (
                    <span>Out: <span className="text-emerald-400">{s.outputTokens.toLocaleString()}</span></span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
