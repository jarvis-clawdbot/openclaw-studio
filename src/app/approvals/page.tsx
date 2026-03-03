"use client";

import { ApprovalsPanel } from "@/features/audit/ApprovalsPanel";

export default function ApprovalsPage() {
  return (
    <div className="h-screen bg-slate-950 p-6 overflow-hidden flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Approvals</h1>
        <p className="text-sm text-white/40 mt-1">
          Approval decision history and policy configuration.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ApprovalsPanel />
      </div>
    </div>
  );
}
