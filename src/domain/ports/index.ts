/**
 * Domain Ports
 *
 * Interfaces that define contracts for infrastructure adapters.
 * Following the Ports & Adapters (Hexagonal) architecture pattern.
 */

export {
  IStoragePort,
  ItemFilter,
  ItemSort,
  PaginationOptions,
  SearchResult,
  BulkResult,
} from './IStoragePort.js';

export {
  INotificationPort,
  NotificationSeverity,
  NotificationChannel,
  NotificationOptions,
  ReminderNotificationContext,
  ItemNotificationContext,
  BatchNotificationSummary,
  NotificationResult,
  ChannelConfig,
} from './INotificationPort.js';

export {
  IAIPort,
  TagSuggestion,
  PrioritySuggestion,
  CategorySuggestion,
  ContextSummary,
  SimilarityResult,
  ExtractionResult,
  AIProviderInfo,
  AICapability,
  AIRequestOptions,
} from './IAIPort.js';

export {
  IGitPort,
  GitCommit,
  GitRepoInfo,
  GitFileDiff,
  CommitSearchOptions,
  LaterTag,
} from './IGitPort.js';
