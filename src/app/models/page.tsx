"use client";
import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/config";

interface AgentModel {
  model_id: string;
  provider?: string;
  total_tokens?: number;
  total_cost?: number;
  request_count?: number;
}

export default function ModelsPage() {
  const [leaderboard, setLeaderboard] = useState<AgentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/api/models/leaderboard`).then((r) => r.json()),
    ])
      .then(([lb]) => {
        setLeaderboard(Array.isArray(lb) ? lb : lb.models ?? []);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Models</h1>
      {loading && <p className="text-muted-foreground">Loading model data…</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!loading && !error && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">Model</th>
                <th className="text-left p-3">Provider</th>
                <th className="text-right p-3">Requests</th>
                <th className="text-right p-3">Tokens</th>
                <th className="text-right p-3">Cost</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No model data yet</td></tr>
              )}
              {leaderboard.map((m, i) => (
                <tr key={i} className="border-t hover:bg-accent/50">
                  <td className="p-3 font-mono">{m.model_id}</td>
                  <td className="p-3 text-muted-foreground">{m.provider ?? "—"}</td>
                  <td className="p-3 text-right">{(m.request_count ?? 0).toLocaleString()}</td>
                  <td className="p-3 text-right">{(m.total_tokens ?? 0).toLocaleString()}</td>
                  <td className="p-3 text-right">${(m.total_cost ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
