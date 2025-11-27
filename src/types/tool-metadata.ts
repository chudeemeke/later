/**
 * Tool Metadata for Progressive Disclosure
 * Enables efficient tool discovery and on-demand loading
 *
 * MCP 2025-06 Specification Compliant:
 * - Includes outputSchema for typed tool responses
 * - Supports structured content validation
 */

import type { Storage } from '../storage/interface.js';

/**
 * JSON Schema type for tool input/output schemas
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema & { description?: string; enum?: string[]; items?: JsonSchema }>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
  enum?: string[];
  additionalProperties?: boolean;
}

/**
 * Tool metadata for registry
 * Following MCP 2025-06 specification with outputSchema support
 */
export interface ToolMetadata {
  /** Unique tool identifier */
  name: string;
  /** Tool category for organization */
  category: 'core' | 'workflow' | 'batch' | 'search' | 'meta';
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
  handler: (args: any, storage: Storage) => Promise<any>;
}

/**
 * Tool search result for progressive disclosure
 */
export interface ToolSearchResult {
  name: string;
  category: string;
  description: string;
  score: number;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
}
