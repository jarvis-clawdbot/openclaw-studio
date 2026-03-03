const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  status: "idle" | "active" | "stuck" | "offline";
  last_activity: number;
  tasks_completed: number;
  created_at: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  type: "feature" | "bugfix" | "research" | "refactor" | "docs";
  assignee: string | null;
  notion_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface UsageStats {
  total_input_tokens: number;
  total_output_tokens: number;
  total_requests: number;
  agents: {
    id: string;
    name: string;
    input_tokens: number;
    output_tokens: number;
    requests: number;
  }[];
  models: {
    model: string;
    input_tokens: number;
    output_tokens: number;
    requests: number;
  }[];
}

class BackendAPI {
  private baseUrl: string;

  constructor(baseUrl: string = BACKEND_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Health
  async health() {
    return this.fetch<{ status: string; checks: Record<string, { status: string }> }>("/api/health");
  }

  // Agents
  async listAgents() {
    return this.fetch<Agent[]>("/api/agents");
  }

  async getAgent(id: string) {
    return this.fetch<Agent>(`/api/agents/${id}`);
  }

  async createAgent(data: Partial<Agent>) {
    return this.fetch<Agent>("/api/agents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAgent(id: string, data: Partial<Agent>) {
    return this.fetch<Agent>(`/api/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Tasks
  async listTasks() {
    return this.fetch<Task[]>("/api/tasks");
  }

  async getTask(id: string) {
    return this.fetch<Task>(`/api/tasks/${id}`);
  }

  async createTask(data: Partial<Task>) {
    return this.fetch<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: Partial<Task>) {
    return this.fetch<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.fetch<void>(`/api/tasks/${id}`, { method: "DELETE" });
  }

  // Analytics
  async getUsageStats(range: "24h" | "7d" | "30d" = "24h") {
    return this.fetch<UsageStats>(`/api/analytics/usage?range=${range}`);
  }

  // Recovery
  async getStuckAgents() {
    return this.fetch<Agent[]>("/api/recovery/stuck");
  }

  async nudgeAgent(id: string, message: string) {
    return this.fetch<{ success: boolean }>(`/api/recovery/agents/${id}/nudge`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  async killAgent(id: string, reason: string) {
    return this.fetch<{ success: boolean }>(`/api/recovery/agents/${id}/kill`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  // WebSocket
  createWebSocket(onMessage: (data: unknown) => void): WebSocket | null {
    try {
      const wsUrl = this.baseUrl.replace("http", "ws");
      const ws = new WebSocket(`${wsUrl}/ws`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch {
          console.error("Failed to parse WebSocket message");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      return ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      return null;
    }
  }
}

export const backendApi = new BackendAPI();
export default backendApi;
