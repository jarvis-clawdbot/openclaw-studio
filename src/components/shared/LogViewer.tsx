"use client";

import { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLogStore, type LogLevel } from "@/stores/logStore";

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "text-slate-500",
  info: "text-slate-300",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const LEVEL_BG: Record<LogLevel, string> = {
  debug: "",
  info: "",
  warn: "bg-yellow-900/10",
  error: "bg-red-900/10",
};

const AGENTS = ["jarvis", "wolff", "dobby", "claudy"];

export function LogViewer({ className = "" }: { className?: string }) {
  const entries = useLogStore((s) => s.getFiltered());
  const filter = useLogStore((s) => s.filter);
  const autoScroll = useLogStore((s) => s.autoScroll);
  const setFilter = useLogStore((s) => s.setFilter);
  const setAutoScroll = useLogStore((s) => s.setAutoScroll);
  const clear = useLogStore((s) => s.clear);
  const getAgentColor = useLogStore((s) => s.getAgentColor);

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && entries.length > 0) {
      virtualizer.scrollToIndex(entries.length - 1, { align: "end" });
    }
  }, [entries.length, autoScroll, virtualizer]);

  const onScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (!atBottom && autoScroll) setAutoScroll(false);
    if (atBottom && !autoScroll) setAutoScroll(true);
  }, [autoScroll, setAutoScroll]);

  return (
    <div className={`flex flex-col bg-slate-900 border border-slate-700 rounded-lg overflow-hidden ${className}`}>
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
        {/* Search */}
        <input
          type="text"
          placeholder="Filter logs…"
          value={filter.search}
          onChange={(e) => setFilter({ search: e.target.value })}
          className="bg-slate-700 text-slate-200 text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-blue-500 w-40"
        />

        {/* Agent filter */}
        <select
          value={filter.agentId ?? ""}
          onChange={(e) => setFilter({ agentId: e.target.value || null })}
          className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none"
        >
          <option value="">All Agents</option>
          {AGENTS.map((a) => (
            <option key={a} value={a}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </option>
          ))}
        </select>

        {/* Level filter */}
        <select
          value={filter.level ?? ""}
          onChange={(e) => setFilter({ level: (e.target.value as LogLevel) || null })}
          className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none"
        >
          <option value="">All Levels</option>
          {(["debug", "info", "warn", "error"] as LogLevel[]).map((l) => (
            <option key={l} value={l}>{l.toUpperCase()}</option>
          ))}
        </select>

        <div className="flex-1" />

        {/* Count */}
        <span className="text-slate-500 text-xs">{entries.length.toLocaleString()} entries</span>

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            autoScroll
              ? "bg-blue-600/20 text-blue-400 border-blue-600/40"
              : "text-slate-400 border-slate-600 hover:border-slate-400"
          }`}
          title="Toggle auto-scroll"
        >
          ↓
        </button>

        {/* Clear */}
        <button
          onClick={clear}
          className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400 hover:text-red-400 hover:border-red-600/40 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Virtual list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        onScroll={onScroll}
        style={{ minHeight: 0 }}
      >
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-slate-500 text-sm italic">
            No log entries
          </div>
        ) : (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((vitem) => {
              const entry = entries[vitem.index];
              const ts = new Date(entry.timestamp).toISOString().slice(11, 23);
              return (
                <div
                  key={entry.id}
                  style={{
                    position: "absolute",
                    top: vitem.start,
                    left: 0,
                    right: 0,
                    height: vitem.size,
                  }}
                  className={`flex items-baseline gap-2 px-3 font-mono text-xs leading-6 hover:bg-slate-800/50 ${LEVEL_BG[entry.level]}`}
                >
                  <span className="text-slate-600 flex-shrink-0">{ts}</span>
                  <span className={`flex-shrink-0 w-14 ${getAgentColor(entry.agentId)}`}>
                    {entry.agentName.slice(0, 6).padEnd(6)}
                  </span>
                  <span className={`flex-shrink-0 w-10 uppercase ${LEVEL_COLORS[entry.level]}`}>
                    {entry.level}
                  </span>
                  <span className="text-slate-300 truncate">{entry.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
