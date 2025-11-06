/**
 * JSON-RPC 2.0 compliant error codes and utilities
 * Follows standard error code ranges
 */

// JSON-RPC 2.0 standard error codes
export enum JSONRPCErrorCode {
  // Standard JSON-RPC errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  // Application-specific errors (custom range: -32000 to -32099)
  VALIDATION_ERROR = -32001,
  ITEM_NOT_FOUND = -32002,
  STORAGE_ERROR = -32003,
  STATE_TRANSITION_ERROR = -32004,
  DEPENDENCY_CYCLE_ERROR = -32005,
  DUPLICATE_ITEM_ERROR = -32006,
  PERMISSION_ERROR = -32007,
}

export interface StandardError {
  code: JSONRPCErrorCode;
  message: string;
  data?: {
    details?: string;
    field?: string;
    id?: number;
    [key: string]: any;
  };
}

/**
 * Create a standardized error response
 */
export function createError(
  code: JSONRPCErrorCode,
  message: string,
  data?: StandardError['data']
): StandardError {
  return {
    code,
    message,
    ...(data && { data }),
  };
}

/**
 * Create validation error
 */
export function createValidationError(
  details: string,
  field?: string
): StandardError {
  return createError(JSONRPCErrorCode.VALIDATION_ERROR, 'Validation failed', {
    details,
    ...(field && { field }),
  });
}

/**
 * Create item not found error
 */
export function createItemNotFoundError(id: number): StandardError {
  return createError(
    JSONRPCErrorCode.ITEM_NOT_FOUND,
    `Item not found`,
    { id, details: `Item #${id} not found` }
  );
}

/**
 * Create storage error
 */
export function createStorageError(details: string): StandardError {
  return createError(JSONRPCErrorCode.STORAGE_ERROR, 'Storage operation failed', {
    details,
  });
}

/**
 * Create state transition error
 */
export function createStateTransitionError(
  from: string,
  to: string,
  details: string
): StandardError {
  return createError(
    JSONRPCErrorCode.STATE_TRANSITION_ERROR,
    'Invalid state transition',
    {
      details,
      from,
      to,
    }
  );
}

/**
 * Create dependency cycle error
 */
export function createDependencyCycleError(
  itemId: number,
  details: string
): StandardError {
  return createError(
    JSONRPCErrorCode.DEPENDENCY_CYCLE_ERROR,
    'Dependency cycle detected',
    {
      details,
      id: itemId,
    }
  );
}

/**
 * Create internal error (fallback)
 */
export function createInternalError(details: string): StandardError {
  return createError(JSONRPCErrorCode.INTERNAL_ERROR, 'Internal server error', {
    details,
  });
}

/**
 * Convert error to standard format
 * Useful for wrapping thrown errors
 */
export function toStandardError(error: unknown): StandardError {
  if (error instanceof Error) {
    return createInternalError(error.message);
  }

  return createInternalError(String(error));
}

/**
 * Check if error code indicates a client error (4xx equivalent)
 */
export function isClientError(code: JSONRPCErrorCode): boolean {
  return (
    code === JSONRPCErrorCode.VALIDATION_ERROR ||
    code === JSONRPCErrorCode.ITEM_NOT_FOUND ||
    code === JSONRPCErrorCode.STATE_TRANSITION_ERROR ||
    code === JSONRPCErrorCode.DEPENDENCY_CYCLE_ERROR ||
    code === JSONRPCErrorCode.DUPLICATE_ITEM_ERROR ||
    code === JSONRPCErrorCode.PERMISSION_ERROR
  );
}

/**
 * Check if error code indicates a server error (5xx equivalent)
 */
export function isServerError(code: JSONRPCErrorCode): boolean {
  return (
    code === JSONRPCErrorCode.STORAGE_ERROR ||
    code === JSONRPCErrorCode.INTERNAL_ERROR
  );
}
