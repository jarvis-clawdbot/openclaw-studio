"use client";

import { memo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";

export type AgentNodeData = {
  label: string;
  role: string;
  model: string;
  status: "idle" | "active" | "stuck" | "offline";
  tasksCompleted: number;
  agentType?: "local" | "fleet";
  host?: string | null;
};

export type AgentNodeType = Node<AgentNodeData, "agent">;

const statusConfig: Record<string, { card: string; dot: string; label: string }> = {
  idle:    { card: "bg-slate-800/80 border-slate-600",                                           dot: "bg-slate-500",   label: "Idle" },
  active:  { card: "bg-slate-800/80 border-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.35)]", dot: "bg-emerald-400", label: "Active" },
  stuck:   { card: "bg-slate-800/80 border-red-500 shadow-[0_0_14px_rgba(239,68,68,0.35)]",      dot: "bg-red-500",     label: "Stuck" },
  offline: { card: "bg-slate-900/60 border-slate-700 opacity-40",                                dot: "bg-gray-600",    label: "Offline" },
};

function AgentNode({ data }: NodeProps<AgentNodeType>) {
  const cfg = statusConfig[data.status] ?? statusConfig.idle;
  const isFleet = data.agentType === "fleet";

  // Shorten model string for display
  const shortModel = data.model
    ? data.model.replace(/^.*\//, "").slice(0, 22)
    : "";

  return (
    <div
      className={`
        relative rounded-xl border-2 transition-all duration-300
        ${cfg.card}
        ${isFleet ? "border-dashed" : ""}
      `}
      style={{ width: 180, padding: "14px 16px 12px" }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-600 !w-2.5 !h-2.5 !border-2 !border-slate-400"
      />

      {/* Fleet host badge */}
      {isFleet && data.host && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-700 border border-slate-500 rounded-full px-2 py-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-300 whitespace-nowrap">
            {data.host}
          </span>
        </div>
      )}

      {/* Status dot + label */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${cfg.dot} ${data.status === "active" ? "animate-pulse" : ""}`} />
          <span className="text-[10px] text-slate-400 font-medium">{cfg.label}</span>
        </div>
        {data.status === "active" && (
          <div className="flex space-x-0.5">
            <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
        {data.status === "stuck" && (
          <span className="text-[9px] font-bold text-red-400 animate-pulse tracking-wide">STUCK</span>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700 mb-2.5" />

      {/* Name + role */}
      <div className="font-bold text-white text-sm leading-tight mb-0.5 truncate">
        {data.label}
      </div>
      <div className="text-slate-400 text-xs leading-snug mb-1.5 truncate">
        {data.role}
      </div>

      {/* Model chip */}
      <div className="inline-block bg-slate-700/60 rounded-md px-1.5 py-0.5 max-w-full">
        <span className="text-[10px] text-slate-400 font-mono truncate block" style={{ maxWidth: 148 }}>
          {shortModel}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-600 !w-2.5 !h-2.5 !border-2 !border-slate-400"
      />
    </div>
  );
}

export default memo(AgentNode);
