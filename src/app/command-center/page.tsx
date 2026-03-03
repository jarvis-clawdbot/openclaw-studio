"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useBackendWS } from "@/hooks/useBackendWS";

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
  const [liveEvents, setLiveEvents] = useState<{ time: number; type: string; agent: string | null; content: string }[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const liveEndRef = useRef<HTMLDivElement>(null);

  // Append to command log helper
  const appendLog = useCallback((type: string, msg: string) => {
    setCommandLog((log) => [{ time: Date.now(), type, message: msg }, ...log]);
  }, []);

  // WebSocket for live agent output
  useBackendWS({
    onConnect: () => setWsConnected(true),
    onDisconnect: () => setWsConnected(false),
    onMessage: (msg) => {
      const { type, payload } = msg as { type: string; payload: any };
      // Handle various gateway event types
      const agentName = payload?.agent_id ?? payload?.agentId ?? null;
      let content = "";
      if (type === "agent.message" || type === "chat") {
        content = payload?.text ?? payload?.content ?? JSON.stringify(payload);
      } else if (type === "tool_call") {
        content = `[Tool: ${payload?.tool ?? "?"}] ${JSON.stringify(payload?.args ?? {})}`;
      } else if (type === "session.message") {
        content = payload?.text ?? payload?.content ?? JSON.stringify(payload);
      } else if (type === "gateway_event") {
        content = payload?.message ?? JSON.stringify(payload);
      } else {
        content = JSON.stringify(payload ?? {});
      }
      setLiveEvents((prev) => {
        const next = [{ time: Date.now(), type, agent: agentName, content }, ...prev].slice(0, 200);
        return next;
      });
    },
  });

  // Auto-scroll live panel
  useEffect(() => {
    liveEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveEvents]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/agents/live`);
        if (!res.ok) return;
        const data = await res.json();
        const mapped = (Array.isArray(data) ? data : []).map((a: any) => ({
          id: String(a.id ?? a.name),
          name: a.name,
          role: a.role,
          model: a.model,
          status: a.status ?? "idle",
          session_key: a.session_key ?? null,
          updated_at: a.last_active ?? null,
        }));
        setAgents(mapped);
      } catch {
        setAgents([]);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async () => {
    if (!selectedAgent || !message.trim()) return;
    if (!selectedAgent.session_key) {
      appendLog("warn", `${selectedAgent.name} has no active session.`);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/${selectedAgent.session_key}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      appendLog(res.ok ? "send" : "error", `${res.ok ? "Sent" : "Failed"} to ${selectedAgent.name}: ${message}`);
      if (res.ok) setMessage("");
    } catch {
      appendLog("error", `Failed to send to ${selectedAgent.name}`);
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
      appendLog(res.ok ? "spawn" : "error", `${res.ok ? "Spawned" : "Failed spawn"}: ${spawnTask.slice(0, 80)}`);
      if (res.ok) setSpawnTask("");
    } catch {
      appendLog("error", "Spawn request failed");
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex">
      {/* Agent sidebar */}
      <div className="w-72 bg-slate-800 border-r border-slate-700 overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Agent Fleet</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-xs text-slate-400">{wsConnected ? "Live stream connected" : "Connecting…"}</span>
          </div>
        </div>
        <div className="p-2 flex-1 overflow-y-auto">
          {agents.map((agent) => (
            <button key={agent.id} onClick={() => setSelectedAgent(agent)} className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${selectedAgent?.id === agent.id ? "bg-blue-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-200"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shrink-0 ${statusColors[agent.status]}`} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{agent.name}</div>
                  <div className="text-xs opacity-75 truncate">{agent.role}</div>
                </div>
              </div>
              <div className="text-xs opacity-50 mt-1">{agent.model}</div>
            </button>
          ))}
          {agents.length === 0 && <div className="text-slate-400 text-sm p-2">No agents loaded</div>}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        <h1 className="text-xl font-bold text-white shrink-0">Command Center</h1>

        {/* Top row: send + spawn */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
          <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-white">
              Send Message {selectedAgent ? `→ ${selectedAgent.name}` : "(select agent)"}
            </h2>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSendMessage(); }}
              placeholder={selectedAgent ? "Type message… (⌘Enter to send)" : "Select an agent first"}
              disabled={!selectedAgent}
              rows={3}
              className="bg-slate-700 border border-slate-600 rounded p-2 text-white placeholder-slate-400 resize-none disabled:opacity-50 text-sm"
            />
            <button onClick={handleSendMessage} disabled={!selectedAgent || !message.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded font-medium text-sm transition-colors">
              Send
            </button>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-white">Spawn New Agent</h2>
            <textarea
              value={spawnTask}
              onChange={(e) => setSpawnTask(e.target.value)}
              placeholder="Describe the task…"
              rows={3}
              className="bg-slate-700 border border-slate-600 rounded p-2 text-white placeholder-slate-400 resize-none text-sm"
            />
            <div className="flex gap-2">
              <select value={spawnModel} onChange={(e) => setSpawnModel(e.target.value)} className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white flex-1 text-sm">
                <option value="coder">coder</option>
                <option value="researcher">researcher</option>
                <option value="reviewer">reviewer</option>
                <option value="orchestrator">orchestrator</option>
              </select>
              <button onClick={handleSpawn} disabled={!spawnTask.trim()} className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white rounded font-medium text-sm transition-colors">
                Spawn
              </button>
            </div>
          </div>
        </div>

        {/* Bottom row: live output + command log */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden min-h-0">
          {/* Live WS output */}
          <div className="bg-slate-800 rounded-lg p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-sm font-semibold text-white">Live Agent Output</h2>
              <button onClick={() => setLiveEvents([])} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs">
              {liveEvents.length === 0 ? (
                <div className="text-slate-500 py-4 text-center">
                  Waiting for agent activity…<br />
                  <span className="text-xs text-slate-600">Messages appear when agents respond via gateway</span>
                </div>
              ) : (
                liveEvents.map((ev, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-slate-500 shrink-0">{new Date(ev.time).toLocaleTimeString()}</span>
                    <span className="text-purple-400 shrink-0">[{ev.type}]</span>
                    {ev.agent && <span className="text-blue-400 shrink-0">{ev.agent}</span>}
                    <span className="text-slate-300 break-all">{ev.content}</span>
                  </div>
                ))
              )}
              <div ref={liveEndRef} />
            </div>
          </div>

          {/* Command log */}
          <div className="bg-slate-800 rounded-lg p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-sm font-semibold text-white">Command Log</h2>
              <button onClick={() => setCommandLog([])} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs">
              {commandLog.length === 0 ? (
                <div className="text-slate-500 py-4 text-center">No commands yet…</div>
              ) : (
                commandLog.map((entry, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-500 shrink-0">{new Date(entry.time).toLocaleTimeString()}</span>
                    <span className={`shrink-0 ${entry.type === "error" ? "text-red-400" : entry.type === "warn" ? "text-yellow-400" : entry.type === "spawn" ? "text-green-400" : "text-blue-300"}`}>[{entry.type.toUpperCase()}]</span>
                    <span className="text-white break-all">{entry.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
