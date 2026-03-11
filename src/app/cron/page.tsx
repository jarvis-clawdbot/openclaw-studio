"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/modals/Modal";
import { BACKEND_URL } from "@/lib/config";


type CronJob = {
  id: string;
  name: string;
  schedule: any;
  enabled: boolean;
  nextRun?: string;
};

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDisabled, setShowDisabled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newJobName, setNewJobName] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/cron?includeDisabled=${showDisabled}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [showDisabled]);

  const toggleJob = async (id: string, enabled: boolean) => {
    await fetch(`${BACKEND_URL}/api/cron/${id}/enabled?enabled=${!enabled}`, { method: "PATCH" });
    load();
  };

  const runJob = async (id: string) => {
    await fetch(`${BACKEND_URL}/api/cron/${id}/run`, { method: "POST" });
  };

  const deleteJob = async (id: string) => {
    if (!confirm("Delete this cron job?")) return;
    await fetch(`${BACKEND_URL}/api/cron/${id}`, { method: "DELETE" });
    load();
  };

  const createJob = async () => {
    if (!newJobName.trim()) return;
    // Placeholder: Real implementation would collect full job config
    await fetch(`${BACKEND_URL}/api/cron`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newJobName,
        schedule: { kind: "every", everyMs: 3600000 },
        payload: { kind: "systemEvent", text: "Sample job" },
        sessionTarget: "isolated",
        enabled: true,
      }),
    });
    setNewJobName("");
    setShowModal(false);
    load();
  };

  return (
    <div className="h-screen bg-slate-950 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cron Jobs</h1>
          <p className="text-sm text-white/40 mt-1">Scheduled automation tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-white/60">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded"
            />
            Show disabled
          </label>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
          >
            + New Job
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-white/30 py-12">Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/30 text-lg">No cron jobs found</p>
          <p className="text-white/20 text-sm mt-2">Create your first scheduled task</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">{job.name || job.id}</h3>
                  <p className="text-xs text-white/40 mt-1">
                    {job.schedule.kind} • {job.enabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleJob(job.id, job.enabled)}
                    className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded"
                  >
                    {job.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => runJob(job.id)}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
                  >
                    Run Now
                  </button>
                  <button
                    onClick={() => deleteJob(job.id)}
                    className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Cron Job">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Job Name</label>
            <input
              type="text"
              value={newJobName}
              onChange={(e) => setNewJobName(e.target.value)}
              placeholder="e.g., Daily Backup"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={createJob}
              disabled={!newJobName.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
