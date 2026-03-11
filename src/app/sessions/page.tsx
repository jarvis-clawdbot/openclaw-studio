"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/config";


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
    <div className="h-screen bg-slate-950 p-6 overflow-auto dashboard-scroll page-enter">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Sessions</h1>
          <p className="text-sm text-white/40 mt-1">Active and recent agent sessions</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 glass-card hover:bg-white/10 text-white/70 text-sm transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="glass-card text-center py-16">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400">Error: {error}</p>
          <button onClick={load} className="mt-4 text-sm text-blue-400 hover:text-blue-300">Try again →</button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass-card text-center py-16">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-white/40 text-lg">No sessions found</p>
          <p className="text-white/20 text-sm mt-2">Sessions appear when agents are active</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => (
            <div
              key={s.sessionKey}
              className="glass-card p-4 animate-card-enter"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium truncate">
                      {s.label || s.agentId || s.sessionKey}
                    </h3>
                    {s.kind && (
                      <span className={`text-xs rounded-full px-2 py-0.5 flex-shrink-0 ${kindColor(s.kind)}`}>
                        {s.kind}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/20 font-mono truncate">{s.sessionKey}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-white/40">{formatAge(s.lastMessageAt)}</p>
                  {s.model && (
                    <p className="text-xs text-purple-400/70 mt-1 font-mono bg-white/5 px-1.5 py-0.5 rounded inline-block">{s.model.split("/").pop()}</p>
                  )}
                </div>
              </div>
              {(s.totalTokens || s.inputTokens) && (
                <div className="mt-3 flex gap-4 text-xs text-white/25 border-t border-white/5 pt-3">
                  {s.totalTokens != null && (
                    <span>Total: <span className="text-white/50 font-semibold">{s.totalTokens.toLocaleString()}</span></span>
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
