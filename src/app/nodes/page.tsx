"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Node = {
  id: string;
  name: string;
  platform?: string;
  version?: string;
  lastSeen?: string;
  capabilities?: string[];
};

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/nodes`);
        if (res.ok) setNodes(await res.json());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="h-screen bg-slate-950 p-6 overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Paired Devices</h1>
        <p className="text-sm text-white/40 mt-1">Manage connected nodes</p>
      </div>

      {loading ? (
        <div className="text-center text-white/30 py-12">Loading...</div>
      ) : nodes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/30 mb-4">No paired devices</p>
          <p className="text-xs text-white/20">Install OpenClaw Node on mobile devices</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div key={node.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
              <h3 className="text-white font-semibold mb-2">{node.name}</h3>
              {node.platform && (
                <p className="text-sm text-white/60 mb-1">{node.platform} {node.version}</p>
              )}
              {node.capabilities && node.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {node.capabilities.map((cap) => (
                    <span key={cap} className="text-xs bg-blue-500/20 text-blue-400 rounded px-2 py-0.5">
                      {cap}
                    </span>
                  ))}
                </div>
              )}
              {node.lastSeen && (
                <p className="text-xs text-white/40">
                  Last seen: {new Date(node.lastSeen).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
