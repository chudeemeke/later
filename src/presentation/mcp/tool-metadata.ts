/**
 * Tool Metadata Types for MCP Server
 *
 * MCP 2025-06 Specification Compliant:
 * - Includes outputSchema for typed tool responses
 * - Supports structured content validation
 */

/**
 * JSON Schema type for tool input/output schemas
 */
export interface JsonSchema {
  type: string;
  properties?: Record<
    string,
    JsonSchema & { description?: string; enum?: string[]; items?: JsonSchema }
  >;
  required?: string[];
  items?: JsonSchema;
  description?: string;
  enum?: string[];
  additionalProperties?: boolean;
}

/**
 * Tool metadata for MCP registration
 */
export interface ToolMetadata {
  /** Unique tool identifier */
  name: string;
  /** Tool category for organization */
  category: 'core' | 'workflow' | 'batch' | 'search' | 'meta' | 'retrospective';
  /** Keywords for discovery search */
  keywords: string[];
  /** Priority for search ranking (higher = more relevant) */
  priority: number;
  /** Human-readable description */
  description: string;
  /** JSON Schema for input parameters */
  inputSchema: JsonSchema;
  /** JSON Schema for output structure (MCP 2025-06) */
  outputSchema?: JsonSchema;
  /** Hide from search results */
  hidden?: boolean;
  /** Tool handler function */
  handler: (args: any) => Promise<any>;
}

/**
 * Tool search result for progressive disclosure
 */
export interface ToolSearchResult {
  name: string;
  category: string;
  description: string;
  keywords: string[];
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
}
