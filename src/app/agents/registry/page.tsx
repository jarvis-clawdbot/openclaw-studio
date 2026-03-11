"use client";
import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/config";

interface RegistryAgent {
  id: string;
  name?: string;
  model?: string;
  role?: string;
  status?: string;
  description?: string;
  tags?: string[];
}

export default function AgentRegistryPage() {
  const [agents, setAgents] = useState<RegistryAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/agents/registry`)
      .then((r) => r.json())
      .then((d) => {
        setAgents(Array.isArray(d) ? d : d.agents ?? []);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = agents.filter((a) =>
    !search || [a.id, a.name, a.role, a.model].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agent Registry</h1>
        <input
          className="border rounded px-3 py-1.5 text-sm w-48 bg-background"
          placeholder="Search agents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading && <p className="text-muted-foreground">Loading registry…</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-muted-foreground">No agents found.</p>
      )}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <div key={a.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{a.name ?? a.id}</p>
                <p className="text-xs text-muted-foreground font-mono">{a.id}</p>
              </div>
              {a.status && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  a.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                  a.status === "idle" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                  "bg-muted text-muted-foreground"
                }`}>{a.status}</span>
              )}
            </div>
            {a.role && <p className="text-sm text-muted-foreground mt-2">{a.role}</p>}
            {a.model && <p className="text-xs font-mono mt-1 text-muted-foreground">{a.model}</p>}
            {a.description && <p className="text-sm mt-2">{a.description}</p>}
            {a.tags && a.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {a.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-muted px-1.5 py-0.5 rounded">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
