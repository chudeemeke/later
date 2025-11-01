export interface DeferredItem {
  id: number;
  decision: string;
  context: string;
  status: "pending" | "in-progress" | "done" | "archived";
  tags: string[];
  priority: "low" | "medium" | "high";
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
  conversation_id?: string;
  dependencies?: number[];  // IDs of items this depends on
}

export interface Config {
  version: string;
  backend: "slash-command" | "mcp-server";
  storage: "jsonl" | "sqlite";
  data_dir: string;
  installed_at?: string;
  upgraded_at?: string;
  previous_version?: string;
}

export interface CaptureArgs {
  decision: string;
  context?: string;
  tags?: string[];
  priority?: "low" | "medium" | "high";
}

export interface ListArgs {
  status?: string;
  tags?: string[];
  priority?: string;
  limit?: number;
}

export interface ShowArgs {
  id: number;
}

export interface DoArgs {
  id: number;
}
