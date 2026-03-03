/**
 * pendingStore - Pure utility functions for managing PendingExecApproval arrays.
 * Based on openclaw-studio's pendingStore.ts pattern.
 */

import type { PendingExecApproval } from "./ExecApprovalBanner";

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
