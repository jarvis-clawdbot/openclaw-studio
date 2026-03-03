"use client";

import { useEffect, useState, useCallback } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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
};

const TYPE_ICONS: Record<string, string> = {
  gateway_event: "⚡",
  tool_call: "🔧",
  chat: "💬",
  approval: "✅",
  error: "❌",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function AuditTimeline() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "error" | "success">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [hours, setHours] = useState(24);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ hours: String(hours), limit: "200" });
      if (filter !== "all") params.set("status", filter);
      if (agentFilter !== "all") params.set("agent_id", agentFilter);

      const [eventsRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/activity?${params}`),
        fetch(`${BACKEND_URL}/api/activity/stats?hours=${hours}`),
      ]);

      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {
      console.error("[AuditTimeline] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [hours, filter, agentFilter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const agents = Array.from(new Set(events.map((e) => e.agent_id).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-white">{stats.total_events}</div>
            <div className="text-xs text-white/50 mt-1">Total Events</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.errors}</div>
            <div className="text-xs text-white/50 mt-1">Errors</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {(100 - stats.error_rate).toFixed(1)}%
            </div>
            <div className="text-xs text-white/50 mt-1">Success Rate</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {Object.keys(stats.by_agent).length}
            </div>
            <div className="text-xs text-white/50 mt-1">Active Agents</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {(["all", "success", "error"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/70"
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
        ) : events.length === 0 ? (
          <div className="text-center text-white/30 py-12 text-sm">
            No activity events yet.<br />
            <span className="text-xs">Events will appear when the gateway is connected.</span>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
              onClick={() => setExpanded(expanded === event.id ? null : event.id)}
            >
              <div className="flex items-center gap-3 p-3">
                <span className="text-lg">
                  {TYPE_ICONS[event.event_type] || "📋"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {event.action}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_COLORS[event.status]}`}
                    >
                      {event.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {event.agent_id && (
                      <span className="text-xs text-blue-400/70">{event.agent_id}</span>
                    )}
                    {event.duration_ms && (
                      <span className="text-xs text-white/30">{event.duration_ms}ms</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-white/30 whitespace-nowrap">
                  {timeAgo(event.created_at)}
                </span>
              </div>

              {/* Expanded detail */}
              {expanded === event.id && (
                <div className="border-t border-white/10 p-3 space-y-2">
                  {event.message_preview && (
                    <div>
                      <div className="text-xs text-white/40 mb-1">Preview</div>
                      <div className="text-xs text-white/70 bg-white/5 rounded p-2 font-mono break-all line-clamp-4">
                        {event.message_preview}
                      </div>
                    </div>
                  )}
                  {event.error_message && (
                    <div>
                      <div className="text-xs text-red-400 mb-1">Error</div>
                      <div className="text-xs text-red-300/80 bg-red-500/10 rounded p-2 font-mono break-all">
                        {event.error_message}
                      </div>
                    </div>
                  )}
                  {event.session_key && (
                    <div className="text-xs text-white/40">
                      Session: <span className="text-white/60 font-mono">{event.session_key}</span>
                    </div>
                  )}
                  <div className="text-xs text-white/30">
                    {new Date(event.created_at).toLocaleString()}
                  </div>
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
