"use client";
import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/config";

interface Trace {
  id: string;
  session_key?: string;
  agent_id?: string;
  created_at?: string;
  status?: string;
  summary?: string;
  total_tokens?: number;
}

export default function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Trace | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/traces`)
      .then((r) => r.json())
      .then((d) => {
        setTraces(Array.isArray(d) ? d : d.traces ?? []);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Traces</h1>
      {loading && <p className="text-muted-foreground">Loading traces…</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!loading && !error && traces.length === 0 && (
        <p className="text-muted-foreground">No traces found.</p>
      )}
      <div className="grid gap-2">
        {traces.map((t) => (
          <div
            key={t.id}
            className="border rounded-lg p-4 cursor-pointer hover:bg-accent transition-colors"
            onClick={() => setSelected(t)}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{t.id}</span>
              <span className="text-xs text-muted-foreground">{t.status ?? "unknown"}</span>
            </div>
            {t.agent_id && <p className="text-sm text-muted-foreground">Agent: {t.agent_id}</p>}
            {t.summary && <p className="text-sm mt-1">{t.summary}</p>}
            {t.total_tokens != null && (
              <p className="text-xs text-muted-foreground mt-1">{t.total_tokens.toLocaleString()} tokens</p>
            )}
          </div>
        ))}
      </div>
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div className="bg-background border rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold mb-2">Trace Detail</h2>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(selected, null, 2)}</pre>
            <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
