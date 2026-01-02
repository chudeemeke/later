/**
 * Schemas Module - Central Validation Hub
 *
 * Re-exports all validation schemas and functions for external use.
 * Import from this module for type-safe validation throughout the application.
 */

export {
  // Primitive schemas
  idSchema,
  statusSchema,
  prioritySchema,
  tagsSchema,
  dependenciesSchema,
  cursorSchema,

  // Pagination schemas
  paginationArgsSchema,

  // Filter schemas
  filterOperatorSchema,
  advancedFiltersSchema,
  sortOptionsSchema,

  // Tool argument schemas
  captureArgsSchema,
  updateArgsSchema,
  deleteArgsSchema,
  listArgsSchema,
  showArgsSchema,
  doArgsSchema,
  searchArgsSchema,
  bulkUpdateArgsSchema,
  bulkDeleteArgsSchema,

  // Validation functions
  validate,
  validateCapture,
  validateUpdate,
  validateDelete,
  validateList,
  validateShow,
  validateDo,
  validateSearch,
  validateBulkUpdate,
  validateBulkDelete,

  // Types
  type ValidationResult,
  type CaptureArgs,
  type UpdateArgs,
  type DeleteArgs,
  type ListArgs,
  type ShowArgs,
  type DoArgs,
  type SearchArgs,
  type BulkUpdateArgs,
  type BulkDeleteArgs,
  type PaginationArgs,
  type FilterOperator,
  type AdvancedFilters,
  type SortOptions,
} from "./validation.js";
