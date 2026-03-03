"use client";

import { useEffect, useState, useCallback } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Decision = {
  id: number;
  request_id: string;
  agent_id: string;
  action_type: string;
  action_name: string;
  action_details: Record<string, unknown> | null;
  decision: "approved" | "denied" | "deferred";
  reason: string | null;
  decided_by: string | null;
  requested_at: string | null;
  decided_at: string;
  response_time_ms: number | null;
};

type ApprovalStats = {
  total_decisions: number;
  approved: number;
  denied: number;
  approval_rate: number;
  avg_response_time_ms: number | null;
  by_action_type: Record<string, number>;
};

const DECISION_COLORS: Record<string, string> = {
  approved: "text-emerald-400",
  denied: "text-red-400",
  deferred: "text-yellow-400",
};

const DECISION_ICONS: Record<string, string> = {
  approved: "✅",
  denied: "❌",
  deferred: "⏸️",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export function ApprovalsPanel() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [filter, setFilter] = useState<"all" | "approved" | "denied">("all");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ hours: String(hours), limit: "100" });
      if (filter !== "all") params.set("decision", filter);

      const [decRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/approvals/decisions?${params}`),
        fetch(`${BACKEND_URL}/api/approvals/stats?hours=${hours}`),
      ]);

      if (decRes.ok) setDecisions(await decRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {
      console.error("[ApprovalsPanel] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [hours, filter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-white">{stats.total_decisions}</div>
            <div className="text-xs text-white/50 mt-1">Total</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.approved}</div>
            <div className="text-xs text-white/50 mt-1">Approved</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.denied}</div>
            <div className="text-xs text-white/50 mt-1">Denied</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {stats.approval_rate.toFixed(1)}%
            </div>
            <div className="text-xs text-white/50 mt-1">Rate</div>
          </div>
        </div>
      )}

      {/* Avg response time */}
      {stats?.avg_response_time_ms && (
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs text-white/50">
          ⏱ Avg response time:{" "}
          <span className="text-white/70 font-medium">
            {stats.avg_response_time_ms < 1000
              ? `${Math.round(stats.avg_response_time_ms)}ms`
              : `${(stats.avg_response_time_ms / 1000).toFixed(1)}s`}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {(["all", "approved", "denied"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 outline-none"
        >
          <option value={6}>Last 6h</option>
          <option value={24}>Last 24h</option>
          <option value={72}>Last 3d</option>
          <option value={168}>Last 7d</option>
        </select>
        <button
          onClick={fetchData}
          className="ml-auto text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Decision list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="text-center text-white/30 py-12 text-sm">Loading...</div>
        ) : decisions.length === 0 ? (
          <div className="text-center text-white/30 py-12 text-sm">
            No approval decisions recorded yet.
          </div>
        ) : (
          decisions.map((d) => (
            <div
              key={d.id}
              className="rounded-xl bg-white/5 border border-white/10 p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{DECISION_ICONS[d.decision]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {d.action_name}
                    </span>
                    <span
                      className={`text-xs font-medium ${DECISION_COLORS[d.decision]}`}
                    >
                      {d.decision}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-blue-400/70">{d.agent_id}</span>
                    <span className="text-xs text-white/30">{d.action_type}</span>
                    {d.response_time_ms && (
                      <span className="text-xs text-white/25">{d.response_time_ms}ms</span>
                    )}
                  </div>
                  {d.reason && (
                    <div className="text-xs text-white/40 mt-1 truncate">{d.reason}</div>
                  )}
                </div>
                <span className="text-xs text-white/30 whitespace-nowrap">
                  {timeAgo(d.decided_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ApprovalsPanel;
