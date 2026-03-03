"use client";

import { useState } from "react";
import type { AgentState } from "@/features/agents/state/store";

type Tab = "overview" | "live" | "history" | "tools";

interface AgentDetailPanelProps {
  agent: AgentState | null;
  onClose: () => void;
}

const statusBadge = (status: string) => {
  const cls =
    status === "running"
      ? "bg-green-500/20 text-green-400 border-green-500/40"
      : status === "error"
      ? "bg-red-500/20 text-red-400 border-red-500/40"
      : "bg-slate-500/20 text-slate-400 border-slate-500/40";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-mono uppercase ${cls}`}>
      {status}
    </span>
  );
};

function OverviewTab({ agent }: { agent: AgentState }) {
  const uptime = agent.runStartedAt
    ? Math.floor((Date.now() - agent.runStartedAt) / 1000)
    : null;
  const fmtUptime = uptime
    ? uptime > 3600
      ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
      : uptime > 60
      ? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
      : `${uptime}s`
    : "—";

  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Name", agent.name],
          ["Status", statusBadge(agent.status)],
          ["Model", agent.model ?? "—"],
          ["Uptime", fmtUptime],
          ["Run ID", agent.runId ? agent.runId.slice(0, 8) + "…" : "—"],
          ["Session", agent.sessionKey?.split(":")[1] ?? "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-slate-800/50 rounded-lg p-2">
            <div className="text-slate-500 text-xs mb-1">{label}</div>
            <div className="text-slate-200 text-sm font-medium">
              {typeof value === "string" ? value : value}
            </div>
          </div>
        ))}
      </div>
      {agent.lastResult && (
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-slate-500 text-xs mb-1">Last Result</div>
          <p className="text-slate-300 text-xs font-mono line-clamp-3">{agent.lastResult}</p>
        </div>
      )}
    </div>
  );
}

function LiveTab({ agent }: { agent: AgentState }) {
  const lines = agent.outputLines ?? [];
  const stream = agent.streamText;
  const thinking = agent.thinkingTrace;

  return (
    <div className="h-full flex flex-col">
      {thinking && (
        <div className="p-3 border-b border-slate-700 bg-blue-950/30">
          <div className="text-xs text-blue-400 mb-1">💭 Thinking…</div>
          <p className="text-xs text-blue-300/80 font-mono line-clamp-3">{thinking}</p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-xs">
        {lines.length === 0 && !stream ? (
          <p className="text-slate-500 italic">No output yet</p>
        ) : (
          lines.slice(-100).map((line, i) => (
            <div key={i} className="text-slate-300 leading-relaxed">
              {line}
            </div>
          ))
        )}
        {stream && (
          <div className="text-green-300 leading-relaxed">
            {stream}
            <span className="animate-pulse">▊</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ agent }: { agent: AgentState }) {
  const entries = agent.transcriptEntries ?? [];

  if (entries.length === 0) {
    return (
      <div className="p-4 text-slate-500 italic text-sm">No conversation history</div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-3 space-y-3">
      {entries.slice(-40).map((entry) => {
        const isUser = entry.role === "user";
        return (
          <div
            key={entry.entryId}
            className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                isUser ? "bg-blue-600" : "bg-slate-600"
              }`}
            >
              {isUser ? "U" : "A"}
            </div>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                isUser
                  ? "bg-blue-600/30 text-blue-100"
                  : "bg-slate-700/60 text-slate-200"
              }`}
            >
              {String(entry.text ?? "").slice(0, 400)}
              {String(entry.text ?? "").length > 400 && (
                <span className="text-slate-400">…</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ToolsTab({ agent }: { agent: AgentState }) {
  const toolEntries = (agent.transcriptEntries ?? []).filter(
    (e) => e.role === "tool" || (e as { type?: string }).type === "tool_call"
  );

  if (toolEntries.length === 0) {
    return (
      <div className="p-4 text-slate-500 italic text-sm">No tool calls recorded</div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-3 space-y-2">
      {toolEntries.slice(-20).map((entry) => (
        <details key={entry.entryId} className="bg-slate-800/50 rounded-lg">
          <summary className="px-3 py-2 cursor-pointer text-xs text-slate-300 hover:text-white list-none flex items-center gap-2">
            <span className="text-yellow-400">⚙</span>
            <span className="font-mono">
              {String(entry.text ?? "tool_call").slice(0, 60)}
            </span>
          </summary>
          <div className="px-3 pb-3 pt-1">
            <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap overflow-auto max-h-40">
              {String(entry.text ?? "")}
            </pre>
          </div>
        </details>
      ))}
    </div>
  );
}

export function AgentDetailPanel({ agent, onClose }: AgentDetailPanelProps) {
  const [tab, setTab] = useState<Tab>("overview");

  if (!agent) return null;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "◉" },
    { id: "live", label: "Live", icon: "▶" },
    { id: "history", label: "History", icon: "≡" },
    { id: "tools", label: "Tools", icon: "⚙" },
  ];

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              agent.status === "running"
                ? "bg-green-500 animate-pulse"
                : agent.status === "error"
                ? "bg-red-500"
                : "bg-slate-500"
            }`}
          />
          <span className="text-white font-semibold">{agent.name}</span>
          {statusBadge(agent.status)}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              tab === t.id
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "overview" && <OverviewTab agent={agent} />}
        {tab === "live" && <LiveTab agent={agent} />}
        {tab === "history" && <HistoryTab agent={agent} />}
        {tab === "tools" && <ToolsTab agent={agent} />}
      </div>

      {/* Footer actions */}
      <div className="border-t border-slate-700 p-3 flex gap-2">
        <button className="flex-1 text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/40 rounded-lg py-1.5 transition-colors">
          Send Message
        </button>
        <button className="flex-1 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/40 rounded-lg py-1.5 transition-colors">
          Kill Agent
        </button>
      </div>
    </div>
  );
}
