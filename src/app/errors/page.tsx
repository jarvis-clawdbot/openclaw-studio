"use client";
import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/config";

interface ErrorLog {
  id: string;
  message: string;
  timestamp: string;
  agent_id?: string;
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/errors`)
      .then((r) => r.json())
      .then((d) => { setErrors(Array.isArray(d) ? d : d.errors ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Error Logs</h1>
      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && errors.length === 0 && <p className="text-muted-foreground">No errors recorded.</p>}
      <div className="space-y-2">
        {errors.map((e) => (
          <div key={e.id} className="border rounded-lg p-3 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <p className="font-medium text-sm">{e.message}</p>
            <p className="text-xs text-muted-foreground mt-1">{e.timestamp}</p>
          </div>
        ))}
      </div>
    </div>
  );
}