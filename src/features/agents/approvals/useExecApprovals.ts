/**
 * useExecApprovals - Manages live exec approval state.
 *
 * Listens for gateway events:
 *   exec.approval.pending  → show approval card
 *   exec.approval.expired  → remove card
 *   exec.approval.resolved → remove card
 *
 * Sends decisions back to gateway via:
 *   POST /api/sessions/{sessionKey}/exec-approval/{id}
 */

import { useCallback, useEffect, useState } from "react";
import type { ExecApprovalDecision, PendingExecApproval } from "./ExecApprovalBanner";
import { upsertPendingApproval, removePendingApprovalById } from "./pendingStore";
import { BACKEND_URL } from "@/lib/config";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18789";

type EventFrame = {
  type: string;
  event: string;
  payload?: Record<string, unknown>;
  seq?: number;
};

type GatewayClientLike = {
  onEvent: (handler: (event: EventFrame) => void) => () => void;
  send?: (msg: unknown) => void;
};

export function useExecApprovals(client: GatewayClientLike | null) {
  const [approvals, setApprovals] = useState<PendingExecApproval[]>([]);

  // Listen for gateway approval events
  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.onEvent((event: EventFrame) => {
      const payload = event.payload ?? {};

      if (event.event === "exec.approval.pending") {
        const approval: PendingExecApproval = {
          id: String(payload.id ?? ""),
          agentId: String(payload.agent_id ?? payload.agentId ?? ""),
          sessionKey: String(payload.session_key ?? payload.sessionKey ?? ""),
          command: String(payload.command ?? ""),
          cwd: payload.cwd ? String(payload.cwd) : null,
          host: payload.host ? String(payload.host) : null,
          security: payload.security ? String(payload.security) : null,
          ask: payload.ask ? String(payload.ask) : null,
          resolvedPath: payload.resolved_path
            ? String(payload.resolved_path)
            : null,
          createdAtMs: Number(payload.created_at_ms ?? Date.now()),
          expiresAtMs: Number(payload.expires_at_ms ?? Date.now() + 30000),
          resolving: false,
          error: null,
        };
        setApprovals((prev) => upsertPendingApproval(prev, approval));
      }

      if (
        event.event === "exec.approval.expired" ||
        event.event === "exec.approval.resolved"
      ) {
        const id = String(payload.id ?? "");
        setApprovals((prev) => removePendingApprovalById(prev, id));
      }
    });

    return unsubscribe;
  }, [client]);

  // Auto-expire approvals past their deadline
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setApprovals((prev) =>
        prev.filter((a) => a.expiresAtMs > now)
      );
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const decide = useCallback(
    async (id: string, decision: ExecApprovalDecision) => {
      // Mark as resolving
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, resolving: true, error: null } : a
        )
      );

      const approval = approvals.find((a) => a.id === id);
      if (!approval) return;

      try {
        // Send decision via gateway WebSocket if available
        if (client?.send) {
          client.send({
            type: "exec.approval.decision",
            approval_id: id,
            decision,
            session_key: approval.sessionKey,
          });
        } else {
          // Fallback: backend proxy
          const res = await fetch(
            `${BACKEND_URL}/api/approvals/exec/${id}/decide`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                decision,
                session_key: approval.sessionKey,
                agent_id: approval.agentId,
              }),
            }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }

        // Remove from pending
        setApprovals((prev) => removePendingApprovalById(prev, id));

        // Record in history
        await fetch(`${BACKEND_URL}/api/approvals/decisions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_id: id,
            agent_id: approval.agentId ?? "unknown",
            action_type: "exec",
            action_name: approval.command,
            action_details: {
              cwd: approval.cwd,
              host: approval.host,
              security: approval.security,
            },
            decision: decision === "deny" ? "denied" : "approved",
            reason: decision,
            response_time_ms: Date.now() - approval.createdAtMs,
          }),
        }).catch(() => {});
      } catch (err) {
        setApprovals((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, resolving: false, error: String(err) }
              : a
          )
        );
      }
    },
    [approvals, client]
  );

  return { approvals, decide };
}

export default useExecApprovals;
