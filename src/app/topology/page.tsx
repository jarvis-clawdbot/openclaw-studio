"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import AgentNode, { type AgentNodeData } from "@/components/topology/AgentNode";
import { AgentEdge } from "@/components/topology/AgentEdge";
import { AgentDetailPanel } from "@/components/topology/AgentDetailPanel";
import { useTopologyStore, startTopologySync, stopTopologySync } from "@/stores/topologyStore";

const nodeTypes: any = { agent: AgentNode };
const edgeTypes: any = { agent: AgentEdge };

const POSITIONS: Record<string, { x: number; y: number }> = {
  jarvis: { x: 350, y: 60 },
  wolff: { x: 100, y: 280 },
  dobby: { x: 350, y: 280 },
  claudy: { x: 600, y: 280 },
};

const BASE_EDGES: Edge[] = [
  { id: "e-jarvis-wolff", source: "jarvis", target: "wolff", type: "agent", data: { active: false } },
  { id: "e-jarvis-dobby", source: "jarvis", target: "dobby", type: "agent", data: { active: false } },
  { id: "e-jarvis-claudy", source: "jarvis", target: "claudy", type: "agent", data: { active: false } },
];

function buildNodesFromAgents(agents: { id: string; name: string; status: string; model: string; role: string; avatarColor: string }[]): Node[] {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const byName = new Map(agents.map((a) => [a.name.toLowerCase(), a]));

  return Object.entries(POSITIONS).map(([id, pos]) => {
    const live = byName.get(id) || byId.get(id);
    const status = live
      ? live.status === "active" ? "active" : live.status === "stuck" ? "stuck" : "idle"
      : "offline";

    return {
      id,
      type: "agent",
      position: pos,
      data: {
        label: live?.name || id.charAt(0).toUpperCase() + id.slice(1),
        role: live?.role || "Agent",
        model: live?.model || "unknown",
        status,
        tasksCompleted: 0,
      },
    };
  });
}

function TopologyInner() {
  const { agentsList, selectedAgent, isLoading, loadAgents, setSelectedAgent } = useTopologyStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(BASE_EDGES);

  // Start real-time sync on mount
  useEffect(() => {
    startTopologySync();
    return () => stopTopologySync();
  }, []);

  useEffect(() => {
    setNodes(buildNodesFromAgents(agentsList));
    setEdges((eds) =>
      eds.map((e) => {
        const targetAgent = agentsList.find((a) => a.name.toLowerCase() === e.target);
        return { ...e, data: { ...e.data, active: targetAgent?.status === "active" } };
      })
    );
  }, [agentsList, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedAgent(node.id), [setSelectedAgent]);

  return (
    <div className="relative bg-slate-900" style={{width:"100%",height:"100%"}}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-50">
          <div className="text-slate-400">Loading agents...</div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedAgent(null)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-left"
        className="bg-slate-900"
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="!bg-slate-800 !border-slate-700" />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as any;
            if (d?.status === "active") return "#22c55e";
            if (d?.status === "stuck") return "#ef4444";
            if (d?.status === "offline") return "#374151";
            return "#64748b";
          }}
          maskColor="rgba(2,6,23,0.85)"
          className="!bg-slate-900 !border-slate-700"
        />
      </ReactFlow>

      <div className="absolute top-4 left-4 flex items-center gap-4 bg-slate-900/80 backdrop-blur rounded-lg px-4 py-2 border border-slate-700 text-xs">
        <span className="text-slate-400 font-medium">Agent Fleet</span>
        {[
          { color: "bg-green-500", label: "Active" },
          { color: "bg-slate-500", label: "Idle" },
          { color: "bg-red-500", label: "Stuck" },
          { color: "bg-gray-700", label: "Offline" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur rounded-lg px-3 py-2 border border-slate-700 text-xs flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${agentsList.some((a) => a.status === "active") ? "bg-green-500 animate-pulse" : "bg-slate-500"}`} />
        <span className="text-slate-300">
          {agentsList.filter((a) => a.status === "active").length} running · {agentsList.length} total
        </span>
      </div>
    </div>
  );
}

export default function TopologyPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400">Loading topology...</div>;
  return <TopologyInner />;
}
