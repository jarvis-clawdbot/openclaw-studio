"use client";

/**
 * ExecApprovalBanner - Live exec approval UI from openclaw-studio pattern.
 *
 * When an agent calls exec with ask="on-miss" or "always", the gateway
 * emits an "exec.approval.pending" event. This component intercepts it
 * and shows an inline approval prompt.
 *
 * Decisions: allow-once | allow-always | deny
 */

import { useCallback, useEffect, useState } from "react";

export type PendingExecApproval = {
  id: string;
  agentId: string | null;
  sessionKey: string | null;
  command: string;
  cwd: string | null;
  host: string | null;
  security: string | null;
  ask: string | null;
  resolvedPath: string | null;
  createdAtMs: number;
  expiresAtMs: number;
  resolving: boolean;
  error: string | null;
};

export type ExecApprovalDecision = "allow-once" | "allow-always" | "deny";

type Props = {
  approval: PendingExecApproval;
  onDecide: (id: string, decision: ExecApprovalDecision) => void;
};

const DECISION_CONFIG = {
  "allow-once": {
    label: "Allow Once",
    icon: "✅",
    class: "bg-emerald-600 hover:bg-emerald-500 text-white",
  },
  "allow-always": {
    label: "Allow Always",
    icon: "♾️",
    class: "bg-blue-600 hover:bg-blue-500 text-white",
  },
  deny: {
    label: "Deny",
    icon: "🚫",
    class: "bg-red-600 hover:bg-red-500 text-white",
  },
};

function useCountdown(expiresAtMs: number) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000))
  );
  useEffect(() => {
    const iv = setInterval(() => {
      const left = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) clearInterval(iv);
    }, 1000);
    return () => clearInterval(iv);
  }, [expiresAtMs]);
  return remaining;
}

export function ExecApprovalCard({ approval, onDecide }: Props) {
  const countdown = useCountdown(approval.expiresAtMs);
  const pct = Math.max(
    0,
    ((approval.expiresAtMs - Date.now()) /
      (approval.expiresAtMs - approval.createdAtMs)) *
      100
  );

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-lg">⚠️</span>
          <span className="text-sm font-semibold text-amber-300">
            Exec Approval Required
          </span>
          {approval.agentId && (
            <span className="text-xs bg-white/10 rounded px-2 py-0.5 text-white/60">
              {approval.agentId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xs font-mono ${
              countdown <= 5 ? "text-red-400 animate-pulse" : "text-white/40"
            }`}
          >
            {countdown}s
          </span>
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            countdown <= 5 ? "bg-red-500" : "bg-amber-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Command */}
      <div>
        <div className="text-xs text-white/40 mb-1">Command</div>
        <code className="block text-sm text-white bg-black/30 rounded p-2 font-mono break-all">
          {approval.command}
        </code>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {approval.cwd && (
          <div>
            <span className="text-white/30">cwd: </span>
            <span className="text-white/60 font-mono">{approval.cwd}</span>
          </div>
        )}
        {approval.host && (
          <div>
            <span className="text-white/30">host: </span>
            <span className="text-white/60">{approval.host}</span>
          </div>
        )}
        {approval.security && (
          <div>
            <span className="text-white/30">security: </span>
            <span className="text-white/60">{approval.security}</span>
          </div>
        )}
      </div>

      {/* Decisions */}
      <div className="flex gap-2 pt-1">
        {(["allow-once", "allow-always", "deny"] as ExecApprovalDecision[]).map(
          (decision) => {
            const cfg = DECISION_CONFIG[decision];
            return (
              <button
                key={decision}
                disabled={approval.resolving}
                onClick={() => onDecide(approval.id, decision)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cfg.class}`}
              >
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
              </button>
            );
          }
        )}
      </div>

      {approval.error && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded p-2">
          {approval.error}
        </div>
      )}
    </div>
  );
}


/**
 * ExecApprovalOverlay - Floating overlay shown when approvals are pending.
 * Mount this in HomeClient near the agent chat area.
 */
type OverlayProps = {
  approvals: PendingExecApproval[];
  onDecide: (id: string, decision: ExecApprovalDecision) => void;
};

export function ExecApprovalOverlay({ approvals, onDecide }: OverlayProps) {
  if (approvals.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 z-50 space-y-3 max-h-[80vh] overflow-y-auto">
      {approvals.map((approval) => (
        <ExecApprovalCard key={approval.id} approval={approval} onDecide={onDecide} />
      ))}
    </div>
  );
}

export default ExecApprovalOverlay;
