/**
 * pendingStore - Pure utility functions for managing PendingExecApproval arrays.
 * Based on openclaw-studio's pendingStore.ts pattern.
 */

import type { PendingExecApproval } from "./types";

export const upsertPendingApproval = (
  approvals: PendingExecApproval[],
  next: PendingExecApproval
): PendingExecApproval[] => {
  const idx = approvals.findIndex((a) => a.id === next.id);
  if (idx < 0) return [next, ...approvals];
  const updated = [...approvals];
  updated[idx] = next;
  return updated;
};

export const removePendingApprovalById = (
  approvals: PendingExecApproval[],
  id: string
): PendingExecApproval[] => approvals.filter((a) => a.id !== id);

export const updatePendingApprovalById = (
  approvals: PendingExecApproval[],
  id: string,
  updater: (a: PendingExecApproval) => PendingExecApproval
): PendingExecApproval[] => {
  const next = approvals.map((a) => (a.id === id ? updater(a) : a));
  return next;
};

export const removePendingApprovalEverywhere = (params: {
  approvalsByAgentId: Record<string, PendingExecApproval[]>;
  unscopedApprovals: PendingExecApproval[];
  approvalId: string;
}): {
  approvalsByAgentId: Record<string, PendingExecApproval[]>;
  unscopedApprovals: PendingExecApproval[];
} => {
  let changed = false;
  const nextMap: Record<string, PendingExecApproval[]> = {};
  for (const [agentId, approvals] of Object.entries(params.approvalsByAgentId)) {
    const filtered = approvals.filter((a) => a.id !== params.approvalId);
    if (filtered.length !== approvals.length) changed = true;
    if (filtered.length > 0) nextMap[agentId] = filtered;
    else if (approvals.length > 0) changed = true;
  }
  const filteredUnscoped = params.unscopedApprovals.filter((a) => a.id !== params.approvalId);
  if (filteredUnscoped.length !== params.unscopedApprovals.length) changed = true;
  if (!changed) {
    return {
      approvalsByAgentId: params.approvalsByAgentId,
      unscopedApprovals: params.unscopedApprovals,
    };
  }
  return { approvalsByAgentId: nextMap, unscopedApprovals: filteredUnscoped };
};

export const removePendingApprovalByIdMap = (
  map: Record<string, PendingExecApproval[]>,
  approvalId: string
): Record<string, PendingExecApproval[]> => {
  const next: Record<string, PendingExecApproval[]> = {};
  for (const [agentId, approvals] of Object.entries(map)) {
    const filtered = approvals.filter((a) => a.id !== approvalId);
    if (filtered.length > 0) next[agentId] = filtered;
  }
  return next;
};

export const pruneExpiredPendingApprovals = (
  approvals: PendingExecApproval[],
  opts: { nowMs: number; graceMs: number }
): PendingExecApproval[] => {
  return approvals.filter((a) => a.expiresAtMs + opts.graceMs > opts.nowMs);
};

export const pruneExpiredPendingApprovalsMap = (
  map: Record<string, PendingExecApproval[]>,
  opts: { nowMs: number; graceMs: number }
): Record<string, PendingExecApproval[]> => {
  const next: Record<string, PendingExecApproval[]> = {};
  for (const [agentId, approvals] of Object.entries(map)) {
    const pruned = pruneExpiredPendingApprovals(approvals, opts);
    if (pruned.length > 0) next[agentId] = pruned;
  }
  return next;
};

export const nextPendingApprovalPruneDelayMs = (params: {
  approvalsByAgentId: Record<string, PendingExecApproval[]>;
  unscopedApprovals: PendingExecApproval[];
  nowMs: number;
  graceMs: number;
}): number | null => {
  let earliest: number | null = null;
  const all = [
    ...Object.values(params.approvalsByAgentId).flat(),
    ...params.unscopedApprovals,
  ];
  for (const a of all) {
    const deadline = a.expiresAtMs + params.graceMs;
    if (earliest === null || deadline < earliest) earliest = deadline;
  }
  if (earliest === null) return null;
  return Math.max(0, earliest - params.nowMs);
};

export const mergePendingApprovalsForFocusedAgent = (params: {
  scopedApprovals: PendingExecApproval[];
  unscopedApprovals: PendingExecApproval[];
}): PendingExecApproval[] => {
  const seen = new Set<string>();
  const merged: PendingExecApproval[] = [];
  for (const a of params.scopedApprovals) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      merged.push(a);
    }
  }
  for (const a of params.unscopedApprovals) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      merged.push(a);
    }
  }
  return merged;
};
