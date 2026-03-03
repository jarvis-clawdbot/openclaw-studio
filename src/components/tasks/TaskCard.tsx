"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, TaskPriority, TaskType } from "@/stores/taskStore";

interface TaskCardProps {
  task: Task;
  onClick?: (taskId: string) => void;
}

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-slate-600",
  medium: "bg-blue-600",
  high: "bg-orange-600",
  urgent: "bg-red-600",
};

const typeIcons: Record<TaskType, string> = {
  feature: "*",
  bugfix: "!",
  research: "?",
  refactor: "~",
  docs: "#",
};

const assigneeColors: Record<string, string> = {
  jarvis: "bg-blue-500",
  wolff: "bg-purple-500",
  dobby: "bg-green-500",
  claudy: "bg-yellow-500",
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick?.(task.id); }}
      className="bg-slate-800 rounded-lg p-3 cursor-grab active:cursor-grabbing border border-slate-700 hover:border-slate-500 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span title={task.type}>{typeIcons[task.type]}</span>
          <h3 className="text-white text-sm font-medium line-clamp-1">{task.title}</h3>
        </div>
        <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} title={task.priority} />
      </div>

      <p className="text-slate-400 text-xs line-clamp-2 mb-3">{task.description}</p>

      <div className="flex items-center justify-between">
        {task.assignee ? (
          <div
            className={`w-6 h-6 rounded-full ${assigneeColors[task.assignee] || "bg-slate-600"} flex items-center justify-center text-xs text-white font-medium`}
            title={task.assignee}
          >
            {task.assignee[0].toUpperCase()}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 border-dashed flex items-center justify-center text-xs text-slate-500">
            ?
          </div>
        )}

        {task.notionId && (
          <span className="text-xs text-slate-500" title="Synced with Notion">
            N
          </span>
        )}
      </div>
    </div>
  );
}
