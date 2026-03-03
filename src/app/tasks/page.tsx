"use client";

import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from "@dnd-kit/core";
import { useTaskStore, TaskStatus } from "@/stores/taskStore";
import { KanbanColumn } from "@/components/tasks/KanbanColumn";

const TASKS_TITLE: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "review", "done", "blocked"];

export default function TasksPage() {
  const { tasks, isLoading, loadTasks, moveTask } = useTaskStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const displayTasks = tasks;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;
    const overColumn = COLUMNS.find((col) => overId === col || overId.startsWith(`${col}-`));

    if (overColumn) {
      const task = displayTasks[activeTaskId];
      if (task && task.status !== overColumn) {
        moveTask(activeTaskId, task.status, overColumn);
      }
    }
  };

  return (
    <div className="h-screen bg-slate-900 p-6 overflow-hidden">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-slate-400 text-sm">Drag and drop tasks to organize your workflow</p>
        </div>
        {isLoading && <span className="text-slate-400 text-sm">Loading...</span>}
      </div>

      {Object.keys(displayTasks).length === 0 && !isLoading ? (
        <div className="h-[calc(100vh-180px)] flex items-center justify-center text-slate-400">
          No tasks yet — create one from the backend/API.
        </div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-[calc(100vh-140px)] overflow-x-auto pb-4">
            {COLUMNS.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                title={TASKS_TITLE[status]}
                tasks={Object.values(displayTasks).filter((t) => t.status === status)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeId ? (
              <div className="bg-slate-700 rounded-lg p-4 shadow-xl w-64">
                <div className="text-white font-medium">{displayTasks[activeId]?.title}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
