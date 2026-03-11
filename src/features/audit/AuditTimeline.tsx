"use client";

import { useEffect, useState, useCallback } from "react";
import { BACKEND_URL } from "@/lib/config";


type ActivityEvent = {
  id: number;
  event_type: string;
  action: string;
  agent_id: string | null;
  session_key: string | null;
  details: Record<string, unknown> | null;
  message_preview: string | null;
  status: "success" | "error" | "pending";
  error_message: string | null;
  created_at: string;
  duration_ms: number | null;
};

type GatewayLog = {
  timestamp: string;
  level: string;
  message: string;
  agent: string;
  subsystem: string;
};

// Unified timeline entry
type TimelineEntry = {
  _key: string;
  _source: "db" | "gateway";
  _ts: number;
  // DB fields
  id?: number;
  event_type?: string;
  action?: string;
  agent_id?: string | null;
  session_key?: string | null;
  details?: Record<string, unknown> | null;
  message_preview?: string | null;
  status?: "success" | "error" | "pending";
  error_message?: string | null;
  created_at?: string;
  duration_ms?: number | null;
  // Gateway fields
  timestamp?: string;
  level?: string;
  message?: string;
  agent?: string;
  subsystem?: string;
};

type ActivityStats = {
  total_events: number;
  errors: number;
  error_rate: number;
  by_type: Record<string, number>;
  by_agent: Record<string, number>;
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  debug: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  warn: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const TYPE_ICONS: Record<string, string> = {
  gateway_event: "⚡",
  tool_call: "🔧",
  chat: "💬",
  "session.message": "💬",
  approval: "✅",
  error: "❌",
  telegram: "📨",
  ws: "🔌",
  gateway: "🌐",
  channel: "📡",
};

const LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-400",
  debug: "text-slate-400",
  warn: "text-orange-400",
  error: "text-red-400",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function AuditTimeline() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<"all" | "db" | "gateway">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "error" | "success">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [hours, setHours] = useState(24);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ hours: String(hours), limit: "200" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (agentFilter !== "all") params.set("agent_id", agentFilter);

      const [eventsRes, statsRes, logsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/activity?${params}`),
        fetch(`${BACKEND_URL}/api/activity/stats?hours=${hours}`),
        fetch(`${BACKEND_URL}/api/logs/recent?limit=100`),
      ]);

      const dbEvents: ActivityEvent[] = eventsRes.ok ? await eventsRes.json() : [];
      if (statsRes.ok) setStats(await statsRes.json());

      const logsData = logsRes.ok ? await logsRes.json() : { logs: [] };
      const gwLogs: GatewayLog[] = logsData.logs ?? [];

      // Convert DB events → timeline entries
      const dbEntries: TimelineEntry[] = dbEvents.map((e) => ({
        _key: `db-${e.id}`,
        _source: "db",
        _ts: new Date(e.created_at).getTime(),
        ...e,
      }));

      // Convert gateway logs → timeline entries (only last 24h matching hours filter)
      const cutoff = Date.now() - hours * 3600 * 1000;
      const gwEntries: TimelineEntry[] = gwLogs
        .filter((l) => new Date(l.timestamp).getTime() >= cutoff)
        .map((l, i) => ({
          _key: `gw-${l.timestamp}-${i}`,
          _source: "gateway",
          _ts: new Date(l.timestamp).getTime(),
          ...l,
        }));

      // Merge and sort descending
      const merged = [...dbEntries, ...gwEntries].sort((a, b) => b._ts - a._ts);
      setEntries(merged);
    } catch (e) {
      console.error("[AuditTimeline] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [hours, statusFilter, agentFilter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredEntries = entries.filter((e) => {
    if (sourceFilter !== "all" && e._source !== sourceFilter) return false;
    return true;
  });

  // All unique agents from both sources
  const agents = Array.from(
    new Set(
      entries
        .map((e) => (e._source === "db" ? e.agent_id : e.agent))
        .filter(Boolean)
    )
  ) as string[];

  const dbCount = entries.filter((e) => e._source === "db").length;
  const gwCount = entries.filter((e) => e._source === "gateway").length;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-white">{entries.length}</div>
            <div className="text-xs text-white/50 mt-1">Total Events</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{dbCount}</div>
            <div className="text-xs text-white/50 mt-1">DB Events</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">{gwCount}</div>
            <div className="text-xs text-white/50 mt-1">Gateway Logs</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.errors}</div>
            <div className="text-xs text-white/50 mt-1">Errors</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Source filter */}
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {(["all", "db", "gateway"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                sourceFilter === s ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {s === "all" ? "All" : s === "db" ? "DB Events" : "Gateway Logs"}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {(["all", "success", "error"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 outline-none"
        >
          <option value="all">All Agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 outline-none"
        >
          <option value={1}>Last 1h</option>
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

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="text-center text-white/30 py-12 text-sm">Loading...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center text-white/30 py-12 text-sm">
            No events in this range.<br />
            <span className="text-xs">Events appear when the gateway or agents are active.</span>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry._key}
              className="rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
              onClick={() => setExpanded(expanded === entry._key ? null : entry._key)}
            >
              {entry._source === "db" ? (
                // DB activity event row
                <div className="flex items-center gap-3 p-3">
                  <span className="text-base shrink-0">
                    {TYPE_ICONS[entry.event_type ?? ""] || "📋"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{entry.action}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_COLORS[entry.status ?? "success"]}`}>
                        {entry.status}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-blue-500/10 text-blue-400 border-blue-500/20">
                        DB
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {entry.agent_id && <span className="text-xs text-blue-400/70">{entry.agent_id}</span>}
                      {entry.duration_ms && <span className="text-xs text-white/30">{entry.duration_ms}ms</span>}
                    </div>
                  </div>
                  <span className="text-xs text-white/30 whitespace-nowrap shrink-0">{timeAgo(entry._ts)}</span>
                </div>
              ) : (
                // Gateway log row
                <div className="flex items-center gap-3 p-3">
                  <span className="text-base shrink-0">
                    {TYPE_ICONS[entry.subsystem ?? ""] || "⚡"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium truncate ${LEVEL_COLORS[entry.level ?? "info"] || "text-white"}`}>
                        {entry.message}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-purple-500/10 text-purple-400 border-purple-500/20">
                        GW
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {entry.subsystem && <span className="text-xs text-purple-400/70">{entry.subsystem}</span>}
                      {entry.level && <span className={`text-xs ${LEVEL_COLORS[entry.level]}`}>{entry.level}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-white/30 whitespace-nowrap shrink-0">{timeAgo(entry._ts)}</span>
                </div>
              )}

              {/* Expanded detail */}
              {expanded === entry._key && (
                <div className="border-t border-white/10 p-3 space-y-2">
                  {entry._source === "db" ? (
                    <>
                      {entry.message_preview && (
                        <div>
                          <div className="text-xs text-white/40 mb-1">Preview</div>
                          <div className="text-xs text-white/70 bg-white/5 rounded p-2 font-mono break-all line-clamp-4">
                            {entry.message_preview}
                          </div>
                        </div>
                      )}
                      {entry.error_message && (
                        <div>
                          <div className="text-xs text-red-400 mb-1">Error</div>
                          <div className="text-xs text-red-300/80 bg-red-500/10 rounded p-2 font-mono break-all">
                            {entry.error_message}
                          </div>
                        </div>
                      )}
                      {entry.session_key && (
                        <div className="text-xs text-white/40">
                          Session: <span className="text-white/60 font-mono">{entry.session_key}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-white/40">
                      Agent: <span className="text-white/60">{entry.agent}</span> · Subsystem: <span className="text-white/60">{entry.subsystem}</span>
                    </div>
                  )}
                  <div className="text-xs text-white/30">{new Date(entry._ts).toLocaleString()}</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AuditTimeline;
