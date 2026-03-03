import { create } from "zustand";
import { backendApi } from "@/lib/backend-api";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";
export type TaskType = "feature" | "bugfix" | "research" | "refactor" | "docs";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  assignee: string | null;
  notionId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface TaskState {
  tasks: Record<string, Task>;
  columns: Record<TaskStatus, string[]>;
  isLoading: boolean;
  error: string | null;
  loadTasks: () => Promise<void>;
  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, update: Partial<Task>) => void;
  moveTask: (taskId: string, from: TaskStatus, to: TaskStatus) => void;
  createTask: (task: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: {},
  columns: {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
    blocked: [],
  },
  isLoading: false,
  error: null,

  loadTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await backendApi.listTasks();
      const tasks = data.map((t: any) => ({
        id: String(t.id),
        title: t.title,
        description: t.description || "",
        status: t.status as TaskStatus,
        priority: t.priority as TaskPriority,
        type: t.type as TaskType,
        assignee: t.assignee,
        notionId: t.notion_id,
        createdAt: new Date(t.created_at).getTime(),
        updatedAt: new Date(t.updated_at).getTime(),
      }));
      
      const taskMap: Record<string, Task> = {};
      const columns: Record<TaskStatus, string[]> = {
        todo: [],
        in_progress: [],
        review: [],
        done: [],
        blocked: [],
      };
      
      tasks.forEach((task: Task) => {
        taskMap[task.id] = task;
        columns[task.status].push(task.id);
      });
      
      set({ tasks: taskMap, columns, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setTasks: (tasks) => {
    const taskMap: Record<string, Task> = {};
    const columns: Record<TaskStatus, string[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
      blocked: [],
    };
    tasks.forEach((task) => {
      taskMap[task.id] = task;
      columns[task.status].push(task.id);
    });
    set({ tasks: taskMap, columns });
  },

  updateTask: (id, update) =>
    set((state) => ({
      tasks: {
        ...state.tasks,
        [id]: { ...state.tasks[id], ...update },
      },
    })),

  moveTask: (taskId, from, to) =>
    set((state) => {
      const columns = { ...state.columns };
      columns[from] = columns[from].filter((id) => id !== taskId);
      columns[to] = [...columns[to], taskId];
      return {
        columns,
        tasks: {
          ...state.tasks,
          [taskId]: { ...state.tasks[taskId], status: to },
        },
      };
    }),

  createTask: async (task) => {
    try {
      const data = await backendApi.createTask({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        type: task.type,
        assignee: task.assignee,
      });
      get().loadTasks();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteTask: async (id) => {
    try {
      await backendApi.deleteTask(id);
      get().loadTasks();
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));
