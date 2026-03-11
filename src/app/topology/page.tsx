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

// Fixed positions for known local agents
const KNOWN_POSITIONS: Record<string, { x: number; y: number }> = {
  jarvis:   { x: 350, y: 60 },
  wolff:    { x: 100, y: 300 },
  dobby:    { x: 350, y: 300 },
  claudy:   { x: 600, y: 300 },
  // Fleet agents — second row
  clawdbot: { x: 150, y: 540 },
  cathy:    { x: 550, y: 540 },
};

/** Generate layout for any number of agents dynamically. */
function computePositions(agents: Agent[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const localAgents = agents.filter((a) => a.agent_type !== "fleet" && a.id !== ORCHESTRATOR_ID);
  const fleetAgents = agents.filter((a) => a.agent_type === "fleet");

  // Place orchestrator at top center
  const orch = agents.find((a) => a.id === ORCHESTRATOR_ID);
  if (orch) {
    positions[ORCHESTRATOR_ID] = KNOWN_POSITIONS[ORCHESTRATOR_ID] ?? { x: 350, y: 60 };
  }

  // Place local sub-agents in a row
  localAgents.forEach((a, i) => {
    if (KNOWN_POSITIONS[a.id]) {
      positions[a.id] = KNOWN_POSITIONS[a.id];
    } else {
      const startX = 100;
      const spacing = Math.min(250, 700 / Math.max(localAgents.length, 1));
      positions[a.id] = { x: startX + i * spacing, y: 300 };
    }
  });

  // Place fleet agents in a second row
  fleetAgents.forEach((a, i) => {
    if (KNOWN_POSITIONS[a.id]) {
      positions[a.id] = KNOWN_POSITIONS[a.id];
    } else {
      const startX = 150;
      const spacing = Math.min(300, 700 / Math.max(fleetAgents.length, 1));
      positions[a.id] = { x: startX + i * spacing, y: 540 };
    }
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
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700 text-sm text-slate-300 shadow-lg">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          Idle
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Stuck
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-600" />
          Offline
        </span>
        <span className="ml-2 text-slate-500">|</span>
        <span>{activeCount} active · {localCount} local · {fleetCount} fleet · {agentsList.length} total</span>
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
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        colorMode="dark"
      >
        <Background color="#1e293b" gap={24} />
        <Controls className="bg-slate-900 border border-slate-700 rounded-lg" />
        <MiniMap
          nodeColor={(n) => {
            const a = agentsList.find((ag) => ag.id === n.id);
            return a?.avatarColor ?? "#6b7280";
          }}
          className="bg-slate-900 border border-slate-700 rounded-lg"
        />
      </ReactFlow>

      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
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
