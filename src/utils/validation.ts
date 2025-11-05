/**
 * Input validation using Zod schemas
 * Provides runtime type checking for all tool arguments
 */

import { z } from 'zod';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Common schemas
const idSchema = z.number().int().positive();
const statusSchema = z.enum(['pending', 'in-progress', 'done', 'archived']);
const prioritySchema = z.enum(['low', 'medium', 'high']);
const tagsSchema = z.array(z.string().min(1)).optional();
const dependenciesSchema = z.array(z.number().int().positive()).optional();

// Capture args schema
const captureArgsSchema = z.object({
  decision: z.string().min(1).max(500),
  context: z.string().optional(),
  tags: tagsSchema,
  priority: prioritySchema.optional(),
  dependencies: dependenciesSchema,
});

// Update args schema
const updateArgsSchema = z.object({
  id: idSchema,
  decision: z.string().min(1).max(500).optional(),
  context: z.string().optional(),
  tags: tagsSchema,
  priority: prioritySchema.optional(),
  status: statusSchema.optional(),
  dependencies: dependenciesSchema,
});

// Delete args schema
const deleteArgsSchema = z.object({
  id: idSchema,
  hard: z.boolean().optional(),
});

// List args schema
const listArgsSchema = z.object({
  status: statusSchema.optional(),
  tags: tagsSchema,
  priority: prioritySchema.optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  cursor: z.string().optional(),
}).optional();

// Show args schema
const showArgsSchema = z.object({
  id: idSchema,
});

// Do args schema
const doArgsSchema = z.object({
  id: idSchema,
});

/**
 * Validate capture arguments
 */
export function validateCapture(args: unknown): ValidationResult {
  try {
    captureArgsSchema.parse(args);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate update arguments
 */
export function validateUpdate(args: unknown): ValidationResult {
  try {
    updateArgsSchema.parse(args);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate delete arguments
 */
export function validateDelete(args: unknown): ValidationResult {
  try {
    deleteArgsSchema.parse(args);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate list arguments
 */
export function validateList(args: unknown): ValidationResult {
  try {
    listArgsSchema.parse(args);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate show arguments
 */
export function validateShow(args: unknown): ValidationResult {
  try {
    showArgsSchema.parse(args);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate do arguments
 */
export function validateDo(args: unknown): ValidationResult {
  try {
    doArgsSchema.parse(args);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}
