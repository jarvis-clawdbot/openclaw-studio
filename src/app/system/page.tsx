"use client";
import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/config";

interface SystemMetrics {
  cpu_percent?: number;
  memory_percent?: number;
  disk_percent?: number;
  uptime_seconds?: number;
}

interface ServiceStatus {
  name: string;
  status: string;
  pid?: number;
}

export default function SystemPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${BACKEND_URL}/api/system/metrics`).then((r) => r.json()).catch(() => null),
      fetch(`${BACKEND_URL}/api/health`).then((r) => r.json()).catch(() => null),
    ]).then(([m, h]) => {
      if (m) setMetrics(m);
      if (h) {
        setHealth(h);
        if (h.services) setServices(Array.isArray(h.services) ? h.services : Object.entries(h.services).map(([name, v]: [string, unknown]) => ({ name, ...(v as object) })));
      }
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const formatUptime = (s?: number) => {
    if (!s) return "—";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">System</h1>
        <button onClick={load} className="px-3 py-1.5 text-sm border rounded hover:bg-accent">Refresh</button>
      </div>
      {loading && <p className="text-muted-foreground">Loading system data…</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!loading && (
        <>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "CPU", value: `${metrics.cpu_percent?.toFixed(1) ?? "—"}%` },
                { label: "Memory", value: `${metrics.memory_percent?.toFixed(1) ?? "—"}%` },
                { label: "Disk", value: `${metrics.disk_percent?.toFixed(1) ?? "—"}%` },
                { label: "Uptime", value: formatUptime(metrics.uptime_seconds) },
              ].map((s) => (
                <div key={s.label} className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          )}
          {health && (
            <div className="border rounded-lg p-4">
              <h2 className="font-semibold mb-3">Health Checks</h2>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(health, null, 2)}</pre>
            </div>
          )}
          {services.length > 0 && (
            <div className="border rounded-lg p-4">
              <h2 className="font-semibold mb-3">Services</h2>
              <div className="space-y-2">
                {services.map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between">
                    <span className="font-mono text-sm">{svc.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${svc.status === "running" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>{svc.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
