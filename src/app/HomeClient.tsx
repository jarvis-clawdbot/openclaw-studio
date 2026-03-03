"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Agent = {
  id: number;
  name: string;
  model: string;
  status: string;
  role: string;
  created_at?: string;
  updated_at?: string;
  session_key?: string | null;
};

const deriveStatus = (a: Agent) => {
  const db = (a.status || "idle").toLowerCase();
  if (["stuck", "offline", "archived"].includes(db)) return db;
  if (a.session_key) return "active";
  if (!a.updated_at) return "idle";
  const updated = new Date(a.updated_at);
  return Date.now() - updated.getTime() < 5 * 60 * 1000 ? "active" : "idle";
};

export default function HomeClient() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/agents`);
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
        }
      } catch (e) {
        console.error("Failed to load agents:", e);
      } finally {
        setLoading(false);
      }
    };
    loadAgents();
  }, []);

  return (
    <div className="h-screen bg-slate-900 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Fleet</h1>
          <p className="text-sm text-white/40 mt-1">Manage your OpenClaw agents</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/agents/create" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">+ New Agent</a>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-white/30 py-12">Loading agents...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/30 mb-4">No agents configured</p>
          <p className="text-xs text-white/20">Create your first agent to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const status = deriveStatus(agent);
            return (
              <div key={agent.id} className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-white/20 transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{agent.name}</h3>
                    <p className="text-xs text-white/40 mt-1">{agent.role}</p>
                  </div>
                  <span className={`text-xs rounded px-2 py-1 ${status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}`}>
                    {status}
                  </span>
                </div>
                <div className="text-sm text-white/60 mb-2">
                  Model: <span className="font-mono text-xs">{agent.model}</span>
                </div>
                {agent.created_at && (
                  <p className="text-xs text-white/40">Created: {new Date(agent.created_at).toLocaleDateString()}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
