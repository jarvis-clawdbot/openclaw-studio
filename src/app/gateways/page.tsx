"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Gateway = {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  is_primary: boolean;
  status: string;
  last_seen: string | null;
};

export default function GatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", url: "ws://", token: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/gateways`);
      if (res.ok) setGateways(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const checkStatus = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/api/gateways/${id}/status`, { method: "GET" });
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const addGateway = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/gateways`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, url: form.url, token: form.token || null }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ name: "", url: "ws://", token: "" });
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const removeGateway = async (id: number) => {
    if (!confirm("Remove this gateway?")) return;
    await fetch(`${BACKEND_URL}/api/gateways/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="h-screen bg-slate-950 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gateway Management</h1>
          <p className="text-sm text-white/40 mt-1">Manage multiple OpenClaw gateway instances</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
        >
          + Add Gateway
        </button>
      </div>

      {loading ? (
        <div className="text-center text-white/30 py-12">Loading...</div>
      ) : gateways.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/30 mb-4">No gateways registered</p>
          <p className="text-xs text-white/20">Add your first gateway to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {gateways.map((gw) => (
            <div key={gw.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    gw.status === "connected" ? "bg-emerald-500 animate-pulse" :
                    gw.status === "disconnected" ? "bg-red-500" : "bg-slate-500"
                  }`} />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{gw.name}</h3>
                    <p className="text-xs text-white/40 font-mono">{gw.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {gw.is_primary && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded px-2 py-1">
                      Primary
                    </span>
                  )}
                  <span className={`text-xs rounded px-2 py-1 ${
                    gw.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"
                  }`}>
                    {gw.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">
                  Status: <span className="text-white/60 capitalize">{gw.status}</span>
                </span>
                {gw.last_seen && (
                  <span className="text-white/40">
                    Last seen: {new Date(gw.last_seen).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => checkStatus(gw.id)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm rounded-lg transition-colors"
                >
                  Check Status
                </button>
                <button
                  onClick={() => removeGateway(gw.id)}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Gateway Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Add Gateway</h2>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white/80 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Production Gateway"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">WebSocket URL</label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="ws://localhost:18789"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Auth Token (optional)</label>
                <input
                  type="password"
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                  placeholder="Bearer token"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={addGateway}
                  disabled={saving || !form.name.trim() || !form.url.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {saving ? "Adding…" : "Add Gateway"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
