"use client";

import { useCallback, useEffect } from "react";
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
import { useTopologyStore, startTopologySync, stopTopologySync, type Agent } from "@/stores/topologyStore";

const nodeTypes: any = { agent: AgentNode };
const edgeTypes: any = { agent: AgentEdge };

// Orchestrator — always Jarvis
const ORCHESTRATOR_ID = "jarvis";

// Node card dimensions + spacing
const NODE_W = 180;
const NODE_H = 130;  // approx rendered height
const COL_GAP = 220; // horizontal gap between card centers
const ROW_GAP = 200; // vertical gap between rows
const MAX_PER_ROW = 5; // wrap local agents after this many per row

/** Generate layout for any number of agents dynamically. */
function computePositions(agents: Agent[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const localAgents = agents.filter((a) => a.agent_type !== "fleet" && a.id !== ORCHESTRATOR_ID);
  const fleetAgents = agents.filter((a) => a.agent_type === "fleet");

  // ── Orchestrator: top center ──────────────────────────────────────
  const orch = agents.find((a) => a.id === ORCHESTRATOR_ID);
  if (orch) {
    positions[ORCHESTRATOR_ID] = { x: 0, y: 0 };
  }

  // ── Local sub-agents: wrap into rows of MAX_PER_ROW ─────────────
  const numLocalRows = Math.ceil(localAgents.length / MAX_PER_ROW);
  localAgents.forEach((a, i) => {
    const row = Math.floor(i / MAX_PER_ROW);
    const col = i % MAX_PER_ROW;
    const countInThisRow = Math.min(MAX_PER_ROW, localAgents.length - row * MAX_PER_ROW);
    // Center each row horizontally relative to orchestrator
    const rowWidth = (countInThisRow - 1) * COL_GAP;
    const startX = -(rowWidth / 2);
    positions[a.id] = {
      x: startX + col * COL_GAP,
      y: ROW_GAP + row * ROW_GAP,
    };
  });

  // ── Fleet agents: row below local agents, spread wide ────────────
  const fleetY = ROW_GAP + numLocalRows * ROW_GAP + ROW_GAP * 0.3;
  fleetAgents.forEach((a, i) => {
    const rowWidth = (fleetAgents.length - 1) * (COL_GAP + 60);
    const startX = -(rowWidth / 2);
    positions[a.id] = {
      x: startX + i * (COL_GAP + 60),
      y: fleetY,
    };
  });

  return positions;
}

function buildNodes(agents: Agent[]): Node[] {
  const positions = computePositions(agents);
  return agents
    .filter((a) => positions[a.id])
    .map((a) => ({
      id: a.id,
      type: "agent",
      position: positions[a.id],
      data: {
        label: a.name,
        role: a.role,
        model: a.model,
        status: a.status === "active" ? "active" : a.status === "stuck" ? "stuck" : a.status === "offline" ? "offline" : "idle",
        tasksCompleted: 0,
        agentType: a.agent_type,
        host: a.host,
      } satisfies AgentNodeData,
    }));
}

function buildEdges(agents: Agent[]): Edge[] {
  const edges: Edge[] = [];
  const orch = agents.find((a) => a.id === ORCHESTRATOR_ID);
  if (!orch) return edges;

  agents
    .filter((a) => a.id !== ORCHESTRATOR_ID)
    .forEach((a) => {
      const isActive = a.status === "active";
      const isFleet = a.agent_type === "fleet";
      edges.push({
        id: `e-${ORCHESTRATOR_ID}-${a.id}`,
        source: ORCHESTRATOR_ID,
        target: a.id,
        type: "agent",
        data: {
          active: isActive,
          dashed: isFleet, // fleet connections shown dashed
        },
        style: isFleet
          ? { strokeDasharray: "6 3", stroke: "#6b7280", opacity: 0.6 }
          : undefined,
      });
    });

  return edges;
}

function TopologyInner() {
  const { agentsList, selectedAgent, isLoading, setSelectedAgent } = useTopologyStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    startTopologySync();
    return () => stopTopologySync();
  }, []);

  useEffect(() => {
    if (agentsList.length === 0) return;
    setNodes(buildNodes(agentsList));
    setEdges(buildEdges(agentsList));
  }, [agentsList, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const agent =
        agentsList.find((a) => a.id === node.id) ?? null;
      setSelectedAgent(agent);
    },
    [setSelectedAgent, agentsList]
  );

  const localCount  = agentsList.filter((a) => a.agent_type !== "fleet").length;
  const fleetCount  = agentsList.filter((a) => a.agent_type === "fleet").length;
  const activeCount = agentsList.filter((a) => a.status === "active").length;

  return (
    <div className="relative bg-slate-950" style={{ width: "100%", height: "100%" }}>
      {isLoading && agentsList.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-50">
          <div className="text-slate-400">Loading agents…</div>
        </div>
      )}

      {/* Header bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 px-5 py-2.5 rounded-full bg-slate-900/95 border border-slate-700/80 text-sm text-slate-300 shadow-xl backdrop-blur-sm whitespace-nowrap">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="text-xs">Active</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-xs">Idle</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
            <span className="text-xs">Stuck</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-600" />
            <span className="text-xs">Offline</span>
          </span>
        </div>
        <div className="w-px h-4 bg-slate-600" />
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span><span className="text-emerald-400 font-semibold">{activeCount}</span> active</span>
          <span className="text-slate-600">·</span>
          <span><span className="text-white font-semibold">{localCount}</span> local</span>
          <span className="text-slate-600">·</span>
          <span><span className="text-white font-semibold">{fleetCount}</span> fleet</span>
          <span className="text-slate-600">·</span>
          <span><span className="text-white font-semibold">{agentsList.length}</span> total</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.35, includeHiddenNodes: false }}
        minZoom={0.2}
        maxZoom={2}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={28} size={1} />
        <Controls
          className="bg-slate-900/90 border border-slate-700 rounded-xl shadow-lg"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(n) => {
            const a = agentsList.find((ag) => ag.id === n.id);
            if (a?.status === "active") return "#10b981";
            if (a?.status === "stuck") return "#ef4444";
            if (a?.status === "offline") return "#374151";
            return a?.avatarColor ?? "#6b7280";
          }}
          className="bg-slate-900/90 border border-slate-700 rounded-xl shadow-lg"
          maskColor="rgba(15,23,42,0.7)"
        />
      </ReactFlow>

      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent as any}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}

export default function TopologyPage() {
  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <div className="flex-1 relative">
        <TopologyInner />
      </div>
    </div>
  );
}
