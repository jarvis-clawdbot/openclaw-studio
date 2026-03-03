"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Tag = {
  id: number;
  name: string;
  color: string;
  description?: string;
  created_at: string;
};

const PRESET_COLORS = [
  "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", color: PRESET_COLORS[0], description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tags`);
      if (res.ok) setTags(await res.json());
    } catch (e) {
      console.error("[Tags] fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.detail ?? "Failed to create tag");
        return;
      }
      await load();
      setShowModal(false);
      setForm({ name: "", color: PRESET_COLORS[0], description: "" });
    } finally {
      setSaving(false);
    }
  };

  const deleteTag = async (id: number) => {
    if (!confirm("Delete this tag?")) return;
    await fetch(`${BACKEND_URL}/api/tags/${id}`, { method: "DELETE" });
    setTags((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="h-screen bg-slate-950 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tags</h1>
          <p className="text-sm text-white/40 mt-1">Organize agents, tasks, and skills with labels</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium"
        >
          + New Tag
        </button>
      </div>

      {loading && <div className="text-slate-400 text-sm">Loading tags…</div>}

      {/* Tag grid */}
      {!loading && tags.length === 0 && (
        <div className="text-white/30 text-center py-12">
          No tags yet. Create one to start organizing your agents and tasks.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-slate-800 group"
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="text-white font-medium text-sm">{tag.name}</span>
            {tag.description && (
              <span className="text-white/40 text-xs">{tag.description}</span>
            )}
            <button
              onClick={() => deleteTag(tag.id)}
              className="ml-1 text-white/20 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Tag table for more details */}
      {tags.length > 0 && (
        <div className="mt-8 bg-slate-800 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="text-left text-white/40 px-4 py-3">Color</th>
                <th className="text-left text-white/40 px-4 py-3">Name</th>
                <th className="text-left text-white/40 px-4 py-3">Description</th>
                <th className="text-left text-white/40 px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <span className="w-5 h-5 rounded inline-block" style={{ backgroundColor: tag.color }} />
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{tag.name}</td>
                  <td className="px-4 py-3 text-white/40">{tag.description ?? "—"}</td>
                  <td className="px-4 py-3 text-white/30 text-xs">
                    {new Date(tag.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="text-white/20 hover:text-red-400 text-xs px-2 py-1 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Tag Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Create Tag</h2>

            {error && (
              <div className="mb-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded p-2">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. production"
                  className="w-full px-3 py-2 bg-slate-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        form.color === c ? "border-white scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-white/40 text-xs">Custom:</span>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-white/40 text-xs font-mono">{form.color}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What is this tag for?"
                  className="w-full px-3 py-2 bg-slate-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Preview</label>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-slate-700 w-fit">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: form.color }} />
                  <span className="text-white text-sm">{form.name || "tag name"}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setError(null); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white/60 rounded-lg text-sm hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={create}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create Tag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
