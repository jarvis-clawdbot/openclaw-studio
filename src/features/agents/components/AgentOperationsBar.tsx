"use client";

/**
 * AgentOperationsBar - Run/Pause/Resume controls for agents.
 * Based on openclaw-studio's operations pattern.
 */

import { useCallback } from "react";

type AgentStatus = "idle" | "running" | "paused" | "error";

type Props = {
  agentId: string;
  status: AgentStatus;
  runId: string | null;
  onStart: (agentId: string) => void;
  onPause: (agentId: string, runId: string) => void;
  onResume: (agentId: string, runId: string) => void;
  onStop: (agentId: string) => void;
};

export function AgentOperationsBar({
  agentId,
  status,
  runId,
  onStart,
  onPause,
  onResume,
  onStop,
}: Props) {
  const handleStart = useCallback(() => {
    onStart(agentId);
  }, [agentId, onStart]);

  const handlePause = useCallback(() => {
    if (runId) onPause(agentId, runId);
  }, [agentId, runId, onPause]);

  const handleResume = useCallback(() => {
    if (runId) onResume(agentId, runId);
  }, [agentId, runId, onResume]);

  const handleStop = useCallback(() => {
    onStop(agentId);
  }, [agentId, onStop]);

  return (
    <div className="flex items-center gap-2 p-3 bg-white/5 border-b border-white/10">
      {/* Status indicator */}
      <div className="flex items-center gap-2 mr-auto">
        <div
          className={`w-2 h-2 rounded-full ${
            status === "running"
              ? "bg-emerald-500 animate-pulse"
              : status === "paused"
              ? "bg-yellow-500"
              : status === "error"
              ? "bg-red-500"
              : "bg-slate-500"
          }`}
        />
        <span className="text-xs text-white/60 capitalize">{status}</span>
        {runId && (
          <span className="text-xs text-white/30 font-mono">#{runId.slice(0, 8)}</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {status === "idle" && (
          <button
            onClick={handleStart}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <span>▶️</span>
            <span>Start</span>
          </button>
        )}

        {status === "running" && (
          <>
            <button
              onClick={handlePause}
              className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <span>⏸️</span>
              <span>Pause</span>
            </button>
            <button
              onClick={handleStop}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <span>⏹️</span>
              <span>Stop</span>
            </button>
          </>
        )}

        {status === "paused" && (
          <>
            <button
              onClick={handleResume}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <span>▶️</span>
              <span>Resume</span>
            </button>
            <button
              onClick={handleStop}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <span>⏹️</span>
              <span>Stop</span>
            </button>
          </>
        )}

        {status === "error" && (
          <button
            onClick={handleStart}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default AgentOperationsBar;
