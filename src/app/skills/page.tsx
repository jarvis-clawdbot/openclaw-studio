"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Skill = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  installed: boolean;
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filter, setFilter] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/skills`);
      if (res.ok) setSkills(await res.json());
    } catch (e) {
      console.error("[Skills] fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const install = async (skill: Skill) => {
    setActionId(skill.id);
    setActionError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/skills/${skill.id}/install`, { method: "POST" });
      if (res.ok) {
        setSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, installed: true } : s));
      } else {
        const err = await res.json();
        setActionError(err.detail ?? "Install failed");
      }
    } catch (e: any) {
      setActionError(e.message ?? "Network error");
    } finally {
      setActionId(null);
    }
  };

  const uninstall = async (skill: Skill) => {
    if (!confirm(`Uninstall "${skill.name}"?`)) return;
    setActionId(skill.id);
    setActionError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/skills/${skill.id}/uninstall`, { method: "DELETE" });
      if (res.ok) {
        setSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, installed: false } : s));
      } else {
        setActionError("Uninstall failed");
      }
    } catch (e: any) {
      setActionError(e.message ?? "Network error");
    } finally {
      setActionId(null);
    }
  };

  const allTags = Array.from(new Set(skills.flatMap((s) => s.tags))).sort();

  const filteredSkills = skills.filter((s) => {
    const matchText =
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.description.toLowerCase().includes(filter.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase()));
    const matchTag = !activeTag || s.tags.includes(activeTag);
    return matchText && matchTag;
  });

  const installedCount = skills.filter((s) => s.installed).length;

  return (
    <div className="h-screen bg-slate-950 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Skills Marketplace</h1>
          <p className="text-sm text-white/40 mt-1">
            Discover and install OpenClaw skills — {installedCount}/{skills.length} installed
          </p>
        </div>
        <button onClick={load} className="text-white/40 hover:text-white text-sm">↻ Refresh</button>
      </div>

      {actionError && (
        <div className="mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded p-3">
          {actionError}
        </div>
      )}

      {/* Search + tag filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search skills..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-48 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 outline-none focus:border-blue-500"
        />
        <button
          onClick={() => setActiveTag(null)}
          className={`px-3 py-1.5 rounded-lg text-sm ${!activeTag ? "bg-blue-600 text-white" : "bg-slate-800 text-white/50 hover:bg-slate-700"}`}
        >
          All
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`px-3 py-1.5 rounded-lg text-sm ${activeTag === tag ? "bg-blue-600 text-white" : "bg-slate-800 text-white/50 hover:bg-slate-700"}`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Skills grid */}
      {loading ? (
        <div className="text-center text-white/30 py-12">Loading…</div>
      ) : filteredSkills.length === 0 ? (
        <div className="text-center text-white/30 py-12">No skills found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-white/20 transition-all flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-white">{skill.name}</h3>
                {skill.installed && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded px-2 py-0.5 flex-shrink-0">
                    ✓ Installed
                  </span>
                )}
              </div>

              <p className="text-sm text-white/60 mb-3 flex-1 line-clamp-3">
                {skill.description}
              </p>

              <div className="flex flex-wrap gap-1 mb-3">
                {skill.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className="text-xs bg-blue-500/10 text-blue-400 rounded px-2 py-0.5 hover:bg-blue-500/20"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-white/40 mb-3">
                <span>by {skill.author}</span>
                <span>v{skill.version}</span>
              </div>

              {skill.installed ? (
                <button
                  onClick={() => uninstall(skill)}
                  disabled={actionId === skill.id}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-red-900/50 text-white/60 hover:text-red-300 transition-colors disabled:opacity-40"
                >
                  {actionId === skill.id ? "Removing…" : "Uninstall"}
                </button>
              ) : (
                <button
                  onClick={() => install(skill)}
                  disabled={actionId === skill.id}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
                >
                  {actionId === skill.id ? "Installing…" : "Install"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

