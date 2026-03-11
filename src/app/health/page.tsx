"use client";
import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/config";

export default function HealthPage() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/health`)
      .then((r) => r.json())
      .then((d) => { setHealth(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">System Health</h1>
      {loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {health && (
        <div className="border rounded-lg p-4">
          <pre className="text-sm bg-muted p-3 rounded overflow-auto">{JSON.stringify(health, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}