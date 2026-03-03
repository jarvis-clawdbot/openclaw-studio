"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/shared/Avatar";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Organization = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
};

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/organizations`);
      if (res.ok) setOrgs(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createOrg = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || undefined,
          description: form.description || undefined,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ name: "", slug: "", description: "" });
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteOrg = async (id: number) => {
    if (!confirm("Delete this organization?")) return;
    await fetch(`${BACKEND_URL}/api/organizations/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="h-screen bg-slate-950 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-sm text-white/40 mt-1">Multi-tenant workspace management</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
        >
          + New Organization
        </button>
      </div>

      {loading ? (
        <div className="text-center text-white/30 py-12">Loading...</div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/30 mb-4">No organizations yet</p>
          <p className="text-xs text-white/20">Create your first organization to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <div key={org.id} className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-white/20 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <Avatar id={org.slug} name={org.name} size={48} />
                <div className="flex-1">
                  <h3 className="text-white font-semibold">{org.name}</h3>
                  <p className="text-xs text-white/40">@{org.slug}</p>
                </div>
                <button
                  onClick={() => deleteOrg(org.id)}
                  className="text-white/20 hover:text-red-400 text-lg leading-none"
                  title="Delete"
                >
                  ×
                </button>
              </div>
              {org.description && (
                <p className="text-sm text-white/60 mb-3">{org.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Organization Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">New Organization</h2>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white/80 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Acme Corp"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Slug (optional)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="acme-corp (auto-generated if empty)"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">
                  Cancel
                </button>
                <button
                  onClick={createOrg}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
