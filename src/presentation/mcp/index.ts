/**
 * MCP Module Barrel
 *
 * Re-exports MCP server and handler components.
 */

// Handlers
export * from './handlers/index.js';

// Tool metadata types
export type { ToolMetadata, JsonSchema, ToolSearchResult } from './tool-metadata.js';

// Server (typically run directly, not imported)
// export { server, container, tools } from './server.js';
