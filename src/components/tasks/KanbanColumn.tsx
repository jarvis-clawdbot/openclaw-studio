"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { Task, TaskStatus } from "@/stores/taskStore";

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

export function KanbanColumn({ status, title, tasks, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const statusColors: Record<TaskStatus, string> = {
    todo: "border-slate-500",
    in_progress: "border-blue-500",
    review: "border-yellow-500",
    done: "border-green-500",
    blocked: "border-red-500",
  };

  const statusBgColors: Record<TaskStatus, string> = {
    todo: "bg-slate-800/50",
    in_progress: "bg-blue-900/20",
    review: "bg-yellow-900/20",
    done: "bg-green-900/20",
    blocked: "bg-red-900/20",
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 ${statusBgColors[status]} rounded-lg p-3 ${isOver ? "ring-2 ring-white/50" : ""}`}
    >
      <div className={`flex items-center justify-between mb-3 pb-2 border-b ${statusColors[status]}`}>
        <h2 className="text-white font-semibold">{title}</h2>
        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[200px]">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
