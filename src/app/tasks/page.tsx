"use client";

import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from "@dnd-kit/core";
import { useTaskStore, TaskStatus, TaskPriority, TaskType, Task } from "@/stores/taskStore";
import { KanbanColumn } from "@/components/tasks/KanbanColumn";

const TASKS_TITLE: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "review", "done", "blocked"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const TYPES: TaskType[] = ["feature", "bugfix", "research", "refactor", "docs"];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-slate-400",
  medium: "text-blue-400",
  high: "text-orange-400",
  urgent: "text-red-400",
};

export default function TasksPage() {
  const { tasks, isLoading, loadTasks, moveTask, createTask, updateTask, deleteTask } = useTaskStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    title: "", description: "", status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority, type: "feature" as TaskType, assignee: "",
  });

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const activeTaskId = active.id as string;
    const overId = over.id as string;
    const overColumn = COLUMNS.find((col) => overId === col || overId.startsWith(`${col}-`));
    if (overColumn) {
      const task = tasks[activeTaskId];
      if (task && task.status !== overColumn) moveTask(activeTaskId, task.status, overColumn);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      await createTask({ ...form, assignee: form.assignee || null });
      setShowCreate(false);
      setForm({ title: "", description: "", status: "todo", priority: "medium", type: "feature", assignee: "" });
    } finally {
      setCreating(false);
    }
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTask(tasks[taskId] ?? null);
  };

  return (
    <div className="h-screen bg-slate-950 p-6 overflow-hidden">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-slate-400 text-sm">Drag and drop to organize workflow</p>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <span className="text-slate-400 text-sm">Loading…</span>}
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
            + New Task
          </button>
        </div>
      </div>

      {/* Create task modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-[480px] border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Create Task</h3>
            <input
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Task title *" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white mb-3 text-sm"
            />
            <textarea
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description" rows={3} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white mb-3 text-sm resize-none"
            />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm">
                  {COLUMNS.map((s) => <option key={s} value={s}>{TASKS_TITLE[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Assignee</label>
                <input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} placeholder="e.g. Jarvis" className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-white/60 hover:text-white">Cancel</button>
              <button onClick={handleCreate} disabled={!form.title.trim() || creating} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded text-sm">
                {creating ? "Creating…" : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task detail side panel */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-40" onClick={() => setSelectedTask(null)}>
          <div className="w-96 h-full bg-slate-800 border-l border-white/10 p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Task Detail</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => { if (confirm("Delete this task?")) { deleteTask(selectedTask.id); setSelectedTask(null); } }}
                  className="text-xs text-red-400 hover:text-red-300"
                >Delete</button>
                <button onClick={() => setSelectedTask(null)} className="text-white/50 hover:text-white">✕</button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Title</label>
                <input
                  value={selectedTask.title}
                  onChange={(e) => { const t = { ...selectedTask, title: e.target.value }; setSelectedTask(t); updateTask(t.id, { title: t.title }); }}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Description</label>
                <textarea
                  value={selectedTask.description}
                  onChange={(e) => { const t = { ...selectedTask, description: e.target.value }; setSelectedTask(t); updateTask(t.id, { description: t.description }); }}
                  rows={4} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Status</label>
                  <select value={selectedTask.status} onChange={(e) => { const s = e.target.value as TaskStatus; setSelectedTask({ ...selectedTask, status: s }); updateTask(selectedTask.id, { status: s }); }} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm">
                    {COLUMNS.map((s) => <option key={s} value={s}>{TASKS_TITLE[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Priority</label>
                  <select value={selectedTask.priority} onChange={(e) => { const p = e.target.value as TaskPriority; setSelectedTask({ ...selectedTask, priority: p }); updateTask(selectedTask.id, { priority: p }); }} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm">
                    {PRIORITIES.map((p) => <option key={p} value={p} className={PRIORITY_COLORS[p]}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Type</label>
                  <select value={selectedTask.type} onChange={(e) => { const t = e.target.value as TaskType; setSelectedTask({ ...selectedTask, type: t }); updateTask(selectedTask.id, { type: t }); }} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm">
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Assignee</label>
                  <input value={selectedTask.assignee ?? ""} onChange={(e) => { const t = { ...selectedTask, assignee: e.target.value || null }; setSelectedTask(t); updateTask(t.id, { assignee: t.assignee }); }} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm" />
                </div>
              </div>
              <div className="text-xs text-white/30 pt-2 border-t border-white/5">
                Created {new Date(selectedTask.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {Object.keys(tasks).length === 0 && !isLoading ? (
        <div className="h-[calc(100vh-180px)] flex items-center justify-center">
          <div className="text-center">
            <p className="text-slate-400 mb-4">No tasks yet</p>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">
              Create First Task
            </button>
          </div>
        </div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-[calc(100vh-140px)] overflow-x-auto pb-4">
            {COLUMNS.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                title={TASKS_TITLE[status]}
                tasks={Object.values(tasks).filter((t) => t.status === status)}
                onTaskClick={handleTaskClick}
              />
            ))}
          </div>

          <DragOverlay>
            {activeId ? (
              <div className="bg-slate-700 rounded-lg p-4 shadow-xl w-64">
                <div className="text-white font-medium">{tasks[activeId]?.title}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
