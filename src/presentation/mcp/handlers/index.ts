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

// Dependency handlers
export {
  createAddDependencyHandler,
  type AddDependencyArgs,
  type AddDependencyResult,
} from './add-dependency.js';
export {
  createRemoveDependencyHandler,
  type RemoveDependencyArgs,
  type RemoveDependencyResult,
} from './remove-dependency.js';
export {
  createDependencyChainHandler,
  type DependencyChainArgs,
  type DependencyChainResult,
  type ChainItemDetailMCP,
  type DependencySummaryMCP,
} from './dependency-chain.js';
export {
  createResolutionOrderHandler,
  type ResolutionOrderArgs,
  type ResolutionOrderResult,
  type OrderedItemMCP,
  type ResolutionStatsMCP,
  type NextActionMCP,
} from './resolution-order.js';
export {
  createSuggestDependenciesHandler,
  type SuggestDependenciesArgs,
  type SuggestDependenciesResult,
  type SuggestedDependencyMCP,
} from './suggest-dependencies.js';

// Retrospective handlers
export {
  createGetRetrospectiveHandler,
  type GetRetrospectiveArgs,
  type GetRetrospectiveResult,
  type RetrospectiveMCP,
  type RetrospectiveAnalysisMCP,
} from './get-retrospective.js';
export {
  createGetRetrospectiveStatsHandler,
  type GetRetrospectiveStatsArgs,
  type GetRetrospectiveStatsResult,
  type RetrospectiveStatsMCP,
  type DetailedAnalysisMCP,
  type LessonsSummaryMCP,
} from './get-retrospective-stats.js';
export {
  createUpdateRetrospectiveHandler,
  type UpdateRetrospectiveArgs,
  type UpdateRetrospectiveResult,
} from './update-retrospective.js';
