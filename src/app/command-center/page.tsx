"use client";

import { useEffect, useState } from "react";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "idle" | "active" | "stuck" | "offline";
  model: string;
  session_key?: string | null;
  updated_at?: string | null;
}

const statusColors: Record<string, string> = {
  idle: "bg-slate-500",
  active: "bg-green-500 animate-pulse",
  stuck: "bg-red-500",
  offline: "bg-gray-600",
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const deriveStatus = (a: Agent): Agent["status"] => {
  const db = (a.status || "idle").toLowerCase();
  if (["stuck", "offline", "archived"].includes(db)) return db as any;
  if (a.session_key) return "active";
  if (!a.updated_at) return "idle";
  const updated = new Date(a.updated_at);
  return Date.now() - updated.getTime() < 5 * 60 * 1000 ? "active" : "idle";
};

export default function CommandCenterPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [message, setMessage] = useState("");
  const [spawnTask, setSpawnTask] = useState("");
  const [spawnModel, setSpawnModel] = useState("coder");
  const [commandLog, setCommandLog] = useState<{ time: number; type: string; message: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/agents`);
        if (!res.ok) return;
        const data = await res.json();
        const mapped = (Array.isArray(data) ? data : []).map((a: any) => ({
          id: String(a.id),
          name: a.name,
          role: a.role,
          model: a.model,
          status: deriveStatus(a),
          session_key: a.session_key ?? null,
          updated_at: a.updated_at ?? null,
        }));
        setAgents(mapped);
      } catch {
        setAgents([]);
      }
    };
    load();
  }, []);

  const handleSendMessage = async () => {
    if (!selectedAgent || !message.trim()) return;
    if (!selectedAgent.session_key) {
      setCommandLog((log) => [{ time: Date.now(), type: "warn", message: `${selectedAgent.name} has no active session.` }, ...log]);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/${selectedAgent.session_key}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      setCommandLog((log) => [
        { time: Date.now(), type: res.ok ? "send" : "error", message: `${res.ok ? "Sent" : "Failed"} to ${selectedAgent.name}: ${message}` },
        ...log,
      ]);
      if (res.ok) setMessage("");
    } catch {
      setCommandLog((log) => [{ time: Date.now(), type: "error", message: `Failed to send to ${selectedAgent.name}` }, ...log]);
    }
  };

  const handleSpawn = async () => {
    if (!spawnTask.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/spawn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: spawnTask, runtime: "subagent", mode: "run", agentId: spawnModel }),
      });
      setCommandLog((log) => [{ time: Date.now(), type: res.ok ? "spawn" : "error", message: `${res.ok ? "Spawned" : "Failed spawn"}: ${spawnTask.slice(0, 80)}` }, ...log]);
      if (res.ok) setSpawnTask("");
    } catch {
      setCommandLog((log) => [{ time: Date.now(), type: "error", message: "Spawn request failed" }, ...log]);
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex">
      <div className="w-80 bg-slate-800 border-r border-slate-700 overflow-y-auto">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Agent Fleet</h2>
        </div>
        <div className="p-2">
          {agents.map((agent) => (
            <button key={agent.id} onClick={() => setSelectedAgent(agent)} className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${selectedAgent?.id === agent.id ? "bg-blue-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-200"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${statusColors[agent.status]}`} />
                <div>
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-xs opacity-75">{agent.role}</div>
                </div>
              </div>
              <div className="text-xs opacity-50 mt-1">{agent.model}</div>
            </button>
          ))}
          {agents.length === 0 && <div className="text-slate-400 text-sm p-2">No agents loaded</div>}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <h1 className="text-2xl font-bold text-white mb-6">Command Center</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
          <div className="bg-slate-800 rounded-lg p-4 flex flex-col">
            <h2 className="text-lg font-semibold text-white mb-4">Send Message {selectedAgent ? `to ${selectedAgent.name}` : ""}</h2>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={selectedAgent ? "Type your message..." : "Select an agent first"} disabled={!selectedAgent} className="flex-1 bg-slate-700 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 resize-none disabled:opacity-50 disabled:cursor-not-allowed" />
            <button onClick={handleSendMessage} disabled={!selectedAgent || !message.trim()} className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">Send Message</button>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 flex flex-col">
            <h2 className="text-lg font-semibold text-white mb-4">Spawn New Agent</h2>
            <textarea value={spawnTask} onChange={(e) => setSpawnTask(e.target.value)} placeholder="Describe the task for the new agent..." className="flex-1 bg-slate-700 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 resize-none" />
            <div className="mt-3 flex gap-3">
              <select value={spawnModel} onChange={(e) => setSpawnModel(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white flex-1">
                <option value="coder">coder</option>
                <option value="researcher">researcher</option>
                <option value="reviewer">reviewer</option>
                <option value="orchestrator">orchestrator</option>
              </select>
              <button onClick={handleSpawn} disabled={!spawnTask.trim()} className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">Spawn Agent</button>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-slate-800 rounded-lg p-4 flex-1 overflow-hidden flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-2">Command Log</h2>
          <div className="flex-1 overflow-y-auto space-y-1">
            {commandLog.length === 0 ? (
              <div className="text-slate-500 text-sm">No commands yet...</div>
            ) : (
              commandLog.map((entry, i) => (
                <div key={i} className="text-sm">
                  <span className="text-slate-400">{new Date(entry.time).toLocaleTimeString()}</span>
                  <span className="ml-2 text-blue-300">[{entry.type.toUpperCase()}]</span>
                  <span className="ml-2 text-white">{entry.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
