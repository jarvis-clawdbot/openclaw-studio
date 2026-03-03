"use client";

import { AuditTimeline } from "@/features/audit/AuditTimeline";

export default function AuditPage() {
  return (
    <div className="h-screen bg-slate-950 p-6 overflow-hidden flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Timeline</h1>
        <p className="text-sm text-white/40 mt-1">
          Real-time agent activity log — all actions, tool calls, and events.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <AuditTimeline />
      </div>
    </div>
  );
}
