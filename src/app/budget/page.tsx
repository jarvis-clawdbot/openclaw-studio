"use client";
import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/config";

interface BudgetAlert {
  id?: number;
  agent_id?: string;
  threshold?: number;
  current?: number;
  level?: string;
  triggered_at?: string;
}

interface TopSpender {
  agent_id: string;
  total_cost: number;
  total_tokens?: number;
}

export default function BudgetPage() {
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [spenders, setSpenders] = useState<TopSpender[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/api/budget/alerts`).then((r) => r.json()).catch(() => []),
      fetch(`${BACKEND_URL}/api/budget/top-spenders`).then((r) => r.json()).catch(() => []),
      fetch(`${BACKEND_URL}/api/analytics/summary`).then((r) => r.json()).catch(() => null),
    ]).then(([a, s, sum]) => {
      setAlerts(Array.isArray(a) ? a : a.alerts ?? []);
      setSpenders(Array.isArray(s) ? s : s.spenders ?? []);
      setSummary(sum);
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Budget</h1>
      {loading && <p className="text-muted-foreground">Loading budget data…</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!loading && (
        <>
          {summary && (
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">${Number(summary.total_cost ?? 0).toFixed(2)}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Tokens</p>
                <p className="text-2xl font-bold">{Number(summary.total_tokens ?? 0).toLocaleString()}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Requests</p>
                <p className="text-2xl font-bold">{Number(summary.total_requests ?? 0).toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4">
            <h2 className="font-semibold mb-3">Top Spenders</h2>
            {spenders.length === 0 ? (
              <p className="text-muted-foreground text-sm">No spend data yet</p>
            ) : (
              <div className="space-y-2">
                {spenders.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b last:border-0">
                    <span className="font-mono text-sm">{s.agent_id}</span>
                    <span className="font-semibold">${s.total_cost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="font-semibold mb-3">Budget Alerts</h2>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active alerts</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
                    <div>
                      <p className="font-medium text-sm">{a.agent_id ?? "system"}</p>
                      <p className="text-xs text-muted-foreground">{a.level} — ${a.current?.toFixed(2)} / ${a.threshold?.toFixed(2)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{a.triggered_at ? new Date(a.triggered_at).toLocaleTimeString() : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
