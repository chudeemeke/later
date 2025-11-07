/**
 * Context extraction utilities
 * MVP version: Simple passthrough
 * Future: AI-powered summarization, conversation linking
 */

/**
 * Extracts and sanitizes context for a deferred item
 * MVP: Returns provided context or generates a default message
 * @param providedContext - User-provided context (optional)
 * @param conversationId - Optional conversation ID for linking
 * @returns Extracted/sanitized context string
 */
export function extractContext(
  providedContext?: string,
  conversationId?: string
): string {
  // If context provided, return it
  if (providedContext && providedContext.trim().length > 0) {
    return providedContext.trim();
  }

  // Otherwise, return a default message
  let defaultContext = 'No additional context provided.';

  if (conversationId) {
    defaultContext += ` (Conversation ID: ${conversationId})`;
  }

  return defaultContext;
}

/**
 * Truncates context if it exceeds maximum length
 * @param context - Context to truncate
 * @param maxLength - Maximum length (default: 5000 characters)
 * @returns Truncated context
 */
export function truncateContext(
  context: string,
  maxLength: number = 5000
): string {
  if (context.length <= maxLength) {
    return context;
  }

  return context.substring(0, maxLength - 20) + '... [truncated]';
}

/**
 * Validates context for length and content
 * @param context - Context to validate
 * @returns True if valid, false otherwise
 */
export function isValidContext(context: string): boolean {
  // Context should not be empty if provided
  if (context.length === 0) {
    return false;
  }

  // Context should not exceed 10,000 characters
  if (context.length > 10000) {
    return false;
  }

  return true;
}

/**
 * Enhances context with metadata
 * Future: Add AI-generated tags, related decisions, etc.
 * @param context - Original context
 * @param metadata - Additional metadata
 * @returns Enhanced context
 */
export function enhanceContext(
  context: string,
  _metadata?: Record<string, any>
): string {
  // MVP: Just return the original context
  // Future: Add metadata, generate summary, extract entities
  return context;
}
