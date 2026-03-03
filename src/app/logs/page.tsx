"use client";

import { useEffect, useState, useRef } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
  agent: string;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial logs
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/logs/recent?limit=50`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (e) {
        console.error("Failed to load logs:", e);
      }
    };
    load();
  }, []);

  // Connect to SSE stream
  useEffect(() => {
    const es = new EventSource(`${BACKEND_URL}/api/logs/stream`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        if (entry && entry.timestamp) {
          setLogs((prev) => {
            const next = [...prev, entry];
            // Keep last 500 logs
            return next.slice(-500);
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const levelColor = (level: string) => {
    switch (level) {
      case "error": return "text-red-400";
      case "warn": return "text-yellow-400";
      case "info": return "text-blue-400";
      case "debug": return "text-white/40";
      default: return "text-white/60";
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="h-screen bg-slate-900 p-6 flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Logs</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-xs text-white/40">{connected ? "Live" : "Disconnected"}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-white/60">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
          <button
            onClick={clearLogs}
            className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/60 rounded"
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 bg-black/40 rounded-xl border border-white/10 p-4 font-mono text-sm overflow-auto"
      >
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/30">Waiting for logs...</p>
            <p className="text-white/20 text-xs mt-2">Logs will appear in real-time</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 hover:bg-white/5 px-1 rounded">
                <span className="text-white/30 flex-shrink-0 w-20">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`${levelColor(log.level)} w-12 flex-shrink-0`}>
                  {log.level.toUpperCase().padEnd(5)}
                </span>
                <span className="text-purple-400/60 flex-shrink-0 w-16 truncate">
                  [{log.agent}]
                </span>
                <span className="text-white/80 break-all">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
