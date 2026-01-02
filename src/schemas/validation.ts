/**
 * Comprehensive Zod Validation Schemas
 * Phase 2.1: Complete validation for all tool arguments
 *
 * Design Principles:
 * - Single source of truth for all validation
 * - Type-safe with full TypeScript inference
 * - User-friendly error messages with field paths
 * - Extensible through composition
 * - Security-aware (field length limits, array bounds)
 */

import { z } from "zod";

// ============================================================================
// Validation Result Interface
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Primitive Schemas (Building Blocks)
// ============================================================================

/**
 * Positive integer ID schema
 * Used for item IDs and dependency references
 */
export const idSchema = z.number().int().positive();

/**
 * Item status schema
 * Enum of valid workflow states
 */
export const statusSchema = z.enum([
  "pending",
  "in-progress",
  "done",
  "archived",
]);

/**
 * Priority level schema
 */
export const prioritySchema = z.enum(["low", "medium", "high"]);

/**
 * Tags array schema
 * Optional array of non-empty strings with sensible limits
 */
export const tagsSchema = z.array(z.string().min(1).max(50)).max(20).optional();

/**
 * Dependencies array schema
 * Optional array of valid item IDs with limit
 */
export const dependenciesSchema = z
  .array(z.number().int().positive())
  .max(50)
  .optional();

/**
 * Base64 cursor schema for pagination
 * Validates base64 format (alphanumeric + / + = padding)
 */
export const cursorSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9+/]+=*$/);

// ============================================================================
// Pagination Schemas
// ============================================================================

/**
 * Pagination arguments schema
 * Supports forward (first/after) and backward (last/before) pagination
 * Ensures mutually exclusive cursor directions
 */
export const paginationArgsSchema = z
  .object({
    first: z.number().int().min(1).max(100).optional(),
    after: cursorSchema.optional(),
    last: z.number().int().min(1).max(100).optional(),
    before: cursorSchema.optional(),
  })
  .refine((data) => !(data.first !== undefined && data.last !== undefined), {
    message: "Cannot use both first and last",
  })
  .refine((data) => !(data.after !== undefined && data.before !== undefined), {
    message: "Cannot use both after and before",
  });

// ============================================================================
// Filter Operator Schemas
// ============================================================================

/**
 * Filter operator schema
 * Supports various comparison operators with single-operator constraint
 */
export const filterOperatorSchema = z
  .object({
    eq: z.union([z.string(), z.number()]).optional(),
    ne: z.union([z.string(), z.number()]).optional(),
    in: z.array(z.union([z.string(), z.number()])).optional(),
    contains: z.string().optional(),
    startsWith: z.string().optional(),
    endsWith: z.string().optional(),
    gte: z.number().optional(),
    lte: z.number().optional(),
    hasTag: z.string().optional(),
  })
  .refine(
    (data) => {
      const definedCount = Object.values(data).filter(
        (v) => v !== undefined,
      ).length;
      return definedCount <= 1;
    },
    { message: "Only one filter operator allowed per field" },
  );

/**
 * Advanced filters schema
 * Supports filtering on all major item fields
 */
export const advancedFiltersSchema = z
  .object({
    status: filterOperatorSchema.optional(),
    priority: filterOperatorSchema.optional(),
    tags: filterOperatorSchema.optional(),
    decision: filterOperatorSchema.optional(),
    context: filterOperatorSchema.optional(),
    created_at: filterOperatorSchema.optional(),
    updated_at: filterOperatorSchema.optional(),
  })
  .optional();

/**
 * Sort options schema
 * Defines sortable fields and direction
 */
export const sortOptionsSchema = z.object({
  field: z.enum(["created_at", "updated_at", "priority", "status", "id"]),
  direction: z.enum(["ASC", "DESC"]),
});

// ============================================================================
// Tool Argument Schemas
// ============================================================================

/**
 * Capture arguments schema
 * For creating new deferred items
 */
export const captureArgsSchema = z.object({
  decision: z.string().min(1).max(500),
  context: z.string().max(10000).optional(),
  tags: tagsSchema,
  priority: prioritySchema.optional(),
  dependencies: dependenciesSchema,
});

/**
 * Update arguments schema
 * For modifying existing items
 */
export const updateArgsSchema = z.object({
  id: idSchema,
  decision: z.string().min(1).max(500).optional(),
  context: z.string().optional(),
  tags: tagsSchema,
  priority: prioritySchema.optional(),
  status: statusSchema.optional(),
  dependencies: dependenciesSchema,
});

/**
 * Delete arguments schema
 * For removing items (soft or hard delete)
 */
export const deleteArgsSchema = z.object({
  id: idSchema,
  hard: z.boolean().optional(),
});

/**
 * List arguments schema
 * Supports legacy filters + Phase 2 advanced features
 */
export const listArgsSchema = z
  .object({
    // Legacy (backward compatible)
    status: statusSchema.optional(),
    tags: tagsSchema,
    priority: prioritySchema.optional(),
    limit: z.number().int().min(1).max(1000).optional(),
    cursor: z.string().optional(),

    // Phase 2: Advanced features
    filters: advancedFiltersSchema,
    orderBy: z.array(sortOptionsSchema).max(3).optional(),
    pagination: paginationArgsSchema.optional(),
  })
  .optional();

/**
 * Show arguments schema
 * For retrieving a single item by ID
 */
export const showArgsSchema = z.object({
  id: idSchema,
});

/**
 * Do arguments schema
 * For converting an item to a todo
 */
export const doArgsSchema = z.object({
  id: idSchema,
});

/**
 * Search arguments schema
 * For full-text search across items
 */
export const searchArgsSchema = z.object({
  query: z.string().min(1).max(500),
  fields: z.array(z.enum(["decision", "context", "tags"])).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  minScore: z.number().min(0).max(1).optional(),
});

/**
 * Bulk update arguments schema
 * For updating multiple items at once
 */
export const bulkUpdateArgsSchema = z.object({
  ids: z.array(idSchema).min(1).max(100),
  changes: z
    .object({
      decision: z.string().min(1).max(500).optional(),
      context: z.string().optional(),
      tags: tagsSchema,
      priority: prioritySchema.optional(),
      status: statusSchema.optional(),
      dependencies: dependenciesSchema,
    })
    .refine((data) => Object.values(data).some((v) => v !== undefined), {
      message: "At least one change field is required",
    }),
});

/**
 * Bulk delete arguments schema
 * For deleting multiple items at once
 */
export const bulkDeleteArgsSchema = z.object({
  ids: z.array(idSchema).min(1).max(100),
  hard: z.boolean().optional(),
});

// ============================================================================
// Generic Validation Function
// ============================================================================

/**
 * Generic validation function with type inference
 * Returns discriminated union for type-safe handling
 *
 * @param schema - Zod schema to validate against
 * @param data - Unknown data to validate
 * @returns Success with typed data or failure with error messages
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map(
      (err) => `${err.path.join(".")}: ${err.message}`,
    ),
  };
}

// ============================================================================
// Tool-Specific Validation Functions (Backward Compatible)
// ============================================================================

/**
 * Helper to convert Zod validation to ValidationResult
 */
function toValidationResult(
  schema: z.ZodSchema,
  data: unknown,
): ValidationResult {
  try {
    schema.parse(data);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(
          (err) => `${err.path.join(".")}: ${err.message}`,
        ),
      };
    }
    return { valid: false, errors: ["Unknown validation error"] };
  }
}

/**
 * Validate capture arguments
 */
export function validateCapture(args: unknown): ValidationResult {
  return toValidationResult(captureArgsSchema, args);
}

/**
 * Validate update arguments
 */
export function validateUpdate(args: unknown): ValidationResult {
  return toValidationResult(updateArgsSchema, args);
}

/**
 * Validate delete arguments
 */
export function validateDelete(args: unknown): ValidationResult {
  return toValidationResult(deleteArgsSchema, args);
}

/**
 * Validate list arguments
 */
export function validateList(args: unknown): ValidationResult {
  return toValidationResult(listArgsSchema, args);
}

/**
 * Validate show arguments
 */
export function validateShow(args: unknown): ValidationResult {
  return toValidationResult(showArgsSchema, args);
}

/**
 * Validate do arguments
 */
export function validateDo(args: unknown): ValidationResult {
  return toValidationResult(doArgsSchema, args);
}

/**
 * Validate search arguments
 */
export function validateSearch(args: unknown): ValidationResult {
  return toValidationResult(searchArgsSchema, args);
}

/**
 * Validate bulk update arguments
 */
export function validateBulkUpdate(args: unknown): ValidationResult {
  return toValidationResult(bulkUpdateArgsSchema, args);
}

/**
 * Validate bulk delete arguments
 */
export function validateBulkDelete(args: unknown): ValidationResult {
  return toValidationResult(bulkDeleteArgsSchema, args);
}

// ============================================================================
// Type Exports (Inferred from Schemas)
// ============================================================================

export type CaptureArgs = z.infer<typeof captureArgsSchema>;
export type UpdateArgs = z.infer<typeof updateArgsSchema>;
export type DeleteArgs = z.infer<typeof deleteArgsSchema>;
export type ListArgs = z.infer<typeof listArgsSchema>;
export type ShowArgs = z.infer<typeof showArgsSchema>;
export type DoArgs = z.infer<typeof doArgsSchema>;
export type SearchArgs = z.infer<typeof searchArgsSchema>;
export type BulkUpdateArgs = z.infer<typeof bulkUpdateArgsSchema>;
export type BulkDeleteArgs = z.infer<typeof bulkDeleteArgsSchema>;
export type PaginationArgs = z.infer<typeof paginationArgsSchema>;
export type FilterOperator = z.infer<typeof filterOperatorSchema>;
export type AdvancedFilters = z.infer<typeof advancedFiltersSchema>;
export type SortOptions = z.infer<typeof sortOptionsSchema>;
