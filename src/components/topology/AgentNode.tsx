"use client";

import { memo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";

export type AgentNodeData = {
  label: string;
  role: string;
  model: string;
  status: "idle" | "active" | "stuck" | "offline";
  tasksCompleted: number;
};

export type AgentNodeType = Node<AgentNodeData, "agent">;

const statusColors: Record<string, string> = {
  idle: "bg-slate-600 border-slate-500",
  active: "bg-green-900 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]",
  stuck: "bg-red-900 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
  offline: "bg-gray-900 border-gray-600 opacity-50",
};

const modelColors: Record<string, string> = {
  "glm-5": "text-blue-300",
  "glm-4.7": "text-purple-300",
};

function AgentNode({ data }: NodeProps<AgentNodeType>) {
  const statusClass = statusColors[data.status] || statusColors.idle;
  const modelClass = modelColors[data.model] || "text-slate-300";

  return (
    <div
      className={`px-4 py-3 rounded-lg ${statusClass} border-2 min-w-[120px] transition-all duration-300`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-500 !w-3 !h-3 !border-2 !border-slate-300"
      />
      
      <div className="text-center">
        <div className="text-white font-bold text-sm mb-1">{data.label}</div>
        <div className="text-slate-400 text-xs">{data.role}</div>
        <div className={`text-xs mt-1 ${modelClass}`}>{data.model}</div>
        {data.status === "active" && (
          <div className="mt-2 flex justify-center">
            <div className="animate-pulse flex space-x-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animation-delay-200" />
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animation-delay-400" />
            </div>
          </div>
        )}
        {data.status === "stuck" && (
          <div className="mt-1 text-xs text-red-400 animate-pulse">
            STUCK
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-500 !w-3 !h-3 !border-2 !border-slate-300"
      />
    </div>
  );
}

export default memo(AgentNode);
