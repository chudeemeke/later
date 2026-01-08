/**
 * MCP Handlers Barrel
 *
 * Re-exports all MCP handler factories for easy consumption.
 */

// Core handlers
export { createCaptureHandler, type CaptureArgs, type CaptureResult } from './capture.js';
export { createListHandler, type ListArgs, type ListResult, type ListItem } from './list.js';
export { createShowHandler, type ShowArgs, type ShowResult, type ShowItem } from './show.js';

// Workflow handlers
export { createDoHandler, type DoArgs, type DoResult } from './do.js';
export { createUpdateHandler, type UpdateArgs, type UpdateResult } from './update.js';
export { createDeleteHandler, type DeleteArgs, type DeleteResult } from './delete.js';

// Search handler
export { createSearchHandler, type SearchArgs, type SearchResult, type SearchResultItem } from './search.js';
