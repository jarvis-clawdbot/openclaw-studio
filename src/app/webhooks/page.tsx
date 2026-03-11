"use client";

import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/config";


const AVAILABLE_EVENTS = [
  "agent.started", "agent.completed", "agent.error",
  "task.created", "task.updated", "task.completed",
  "message.received", "message.sent",
];

type Webhook = {
  id: number;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", url: "https://", events: [] as string[], secret: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/webhooks`);
      if (res.ok) setWebhooks(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const testWebhook = async (id: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/webhooks/${id}/test`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(data.status === "success" ? "✅ Webhook test successful!" : `❌ ${data.error}`);
      }
    } catch (e) {
      alert(`❌ ${e}`);
    }
  };

  const deleteWebhook = async (id: number) => {
    if (!confirm("Delete this webhook?")) return;
    await fetch(`${BACKEND_URL}/api/webhooks/${id}`, { method: "DELETE" });
    await load();
  };

  const toggleEvent = (event: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event],
    }));
  };

  const createWebhook = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, url: form.url, events: form.events, secret: form.secret || null }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ name: "", url: "https://", events: [], secret: "" });
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen bg-slate-950 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhooks</h1>
          <p className="text-sm text-white/40 mt-1">External event integrations</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
        >
          + New Webhook
        </button>
      </div>

      {loading ? (
        <div className="text-center text-white/30 py-12">Loading...</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/30 mb-4">No webhooks configured</p>
          <p className="text-xs text-white/20">Create your first webhook integration</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${wh.enabled ? "bg-emerald-500" : "bg-slate-500"}`} />
                  <div>
                    <h3 className="text-white font-semibold">{wh.name}</h3>
                    <p className="text-xs text-white/40 font-mono">{wh.url}</p>
                  </div>
                </div>
                <span className={`text-xs rounded px-2 py-1 ${
                  wh.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"
                }`}>
                  {wh.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {wh.events.map((event) => (
                  <span key={event} className="text-xs bg-blue-500/20 text-blue-400 rounded px-2 py-0.5">
                    {event}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => testWebhook(wh.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium transition-colors"
                >
                  Test
                </button>
                <button
                  onClick={() => deleteWebhook(wh.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Webhook Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">New Webhook</h2>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white/80 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Slack Notifications"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">URL</label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://hooks.slack.com/..."
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Events</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <button
                      key={event}
                      onClick={() => toggleEvent(event)}
                      className={`text-xs rounded px-2 py-1 transition-colors ${
                        form.events.includes(event)
                          ? "bg-blue-600 text-white"
                          : "bg-white/10 text-white/50 hover:bg-white/20"
                      }`}
                    >
                      {event}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">
                  Cancel
                </button>
                <button
                  onClick={createWebhook}
                  disabled={saving || !form.name.trim() || !form.url.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {saving ? "Creating…" : "Create Webhook"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
