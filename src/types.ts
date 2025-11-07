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
  // V2.0: PII tokenization fields
  context_tokens?: Record<string, string>;  // Tokenized PII mapping
  context_pii_types?: Record<string, number>;  // Detected PII types count
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

// Phase 2: Pagination types
export interface PaginationArgs {
  first?: number;  // Forward pagination limit
  after?: string;  // Cursor for forward pagination
  last?: number;   // Backward pagination limit
  before?: string; // Cursor for backward pagination
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
  totalCount?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pageInfo: PageInfo;
}

// Phase 2: Advanced filtering types
export interface FilterOperator {
  eq?: string | number;      // Equals
  ne?: string | number;      // Not equals
  in?: Array<string | number>; // In array
  contains?: string;         // String contains (case-insensitive)
  startsWith?: string;       // String starts with
  endsWith?: string;         // String ends with
  gte?: number;             // Greater than or equal
  lte?: number;             // Less than or equal
  hasTag?: string;          // Has specific tag
}

export interface AdvancedFilters {
  status?: FilterOperator;
  priority?: FilterOperator;
  tags?: FilterOperator;
  decision?: FilterOperator;
  context?: FilterOperator;
  created_at?: FilterOperator;
  updated_at?: FilterOperator;
}

export interface SortOptions {
  field: 'created_at' | 'updated_at' | 'priority' | 'status' | 'id';
  direction: 'ASC' | 'DESC';
}

export interface ListArgs {
  // Legacy (backward compatible)
  status?: string;
  tags?: string[];
  priority?: string;
  limit?: number;

  // Phase 2: Advanced features
  filters?: AdvancedFilters;
  orderBy?: SortOptions[];
  pagination?: PaginationArgs;
}

export interface ShowArgs {
  id: number;
}

export interface DoArgs {
  id: number;
}
