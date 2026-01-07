/**
 * Application Layer
 *
 * Contains use cases implemented as commands (write) and queries (read).
 * Follows CQRS pattern for separation of concerns.
 */

// Commands (write operations)
export {
  CaptureItemCommand,
  CaptureItemInput,
  CaptureItemResult,
  UpdateItemCommand,
  UpdateItemInput,
  UpdateItemResult,
  CompleteItemCommand,
  CompleteItemInput,
  CompleteItemResult,
  AddDependencyCommand,
  AddDependencyInput,
  AddDependencyResult,
  DeleteItemCommand,
  DeleteItemInput,
  DeleteItemResult,
} from './commands/index.js';

// Queries (read operations)
export {
  GetItemQuery,
  GetItemInput,
  GetItemResult,
  ListItemsQuery,
  ListItemsInput,
  ListItemsResult,
  SearchItemsQuery,
  SearchItemsInput,
  SearchItemsResult,
  SearchItemResult,
  GetBlockedItemsQuery,
  GetBlockedItemsInput,
  GetBlockedItemsResult,
  BlockedItemResult,
  GetStaleItemsQuery,
  GetStaleItemsInput,
  GetStaleItemsResult,
  StaleItemResult,
} from './queries/index.js';
