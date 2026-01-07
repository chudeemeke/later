/**
 * AI Port
 *
 * Defines the contract for AI-powered features.
 * Implemented by adapters: Claude Code context, Claude API, rule-based fallback.
 */

import { ItemProps } from '../entities/Item.js';
import { PriorityValue } from '../value-objects/Priority.js';

/**
 * Tag suggestion with confidence score
 */
export interface TagSuggestion {
  tag: string;
  confidence: number; // 0-1
  reason?: string;
}

/**
 * Priority suggestion with reasoning
 */
export interface PrioritySuggestion {
  priority: PriorityValue;
  confidence: number; // 0-1
  reason?: string;
}

/**
 * Category suggestion (hierarchical tag)
 */
export interface CategorySuggestion {
  category: string;
  subcategory?: string;
  confidence: number;
  reason?: string;
}

/**
 * Context summary result
 */
export interface ContextSummary {
  summary: string;
  keyPoints: string[];
  tokenCount: number;
  truncated: boolean;
}

/**
 * Similarity result
 */
export interface SimilarityResult {
  itemId: number;
  similarity: number; // 0-1
  matchedOn: 'decision' | 'context' | 'tags' | 'combined';
}

/**
 * Extraction result from text
 */
export interface ExtractionResult {
  decision: string;
  context?: string;
  suggestedTags: TagSuggestion[];
  suggestedPriority?: PrioritySuggestion;
  mentionedIds?: number[];
  mentionedFiles?: string[];
}

/**
 * AI provider information
 */
export interface AIProviderInfo {
  name: string;
  version?: string;
  model?: string;
  capabilities: AICapability[];
}

/**
 * AI capabilities
 */
export type AICapability =
  | 'categorization'
  | 'summarization'
  | 'similarity'
  | 'extraction'
  | 'priority_suggestion'
  | 'context_analysis';

/**
 * AI request options
 */
export interface AIRequestOptions {
  /** Maximum tokens for response */
  maxTokens?: number;

  /** Temperature for randomness (0-1) */
  temperature?: number;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Use cached result if available */
  useCache?: boolean;
}

/**
 * Main AI port interface
 */
export interface IAIPort {
  // ===========================================
  // Categorization & Suggestions
  // ===========================================

  /**
   * Suggest tags for a decision/item
   * @param text Decision text and optional context
   * @param existingTags Tags already in use (for consistency)
   * @returns Ranked tag suggestions
   */
  suggestTags(
    text: string,
    existingTags?: string[],
    options?: AIRequestOptions
  ): Promise<TagSuggestion[]>;

  /**
   * Suggest priority for a decision
   * @param text Decision text and optional context
   * @returns Priority suggestion with reasoning
   */
  suggestPriority(
    text: string,
    options?: AIRequestOptions
  ): Promise<PrioritySuggestion>;

  /**
   * Suggest category (hierarchical tag)
   * @param text Decision text
   * @param existingCategories Categories in use
   */
  suggestCategory(
    text: string,
    existingCategories?: string[],
    options?: AIRequestOptions
  ): Promise<CategorySuggestion>;

  // ===========================================
  // Context & Summarization
  // ===========================================

  /**
   * Summarize context for storage
   * @param context Full conversation context
   * @param maxWords Target word count for summary
   */
  summarizeContext(
    context: string,
    maxWords?: number,
    options?: AIRequestOptions
  ): Promise<ContextSummary>;

  /**
   * Extract decision from conversation text
   * @param text Raw conversation or input text
   */
  extractDecision(
    text: string,
    options?: AIRequestOptions
  ): Promise<ExtractionResult>;

  /**
   * Analyze if context is stale based on changes
   * @param item The item to check
   * @param currentContext Current environment context
   * @returns Staleness score (0-1) and reason
   */
  analyzeContextStaleness(
    item: ItemProps,
    currentContext: string,
    options?: AIRequestOptions
  ): Promise<{
    staleness: number;
    reason?: string;
    suggestedAction?: 'refresh' | 'review' | 'none';
  }>;

  // ===========================================
  // Similarity & Duplicates
  // ===========================================

  /**
   * Find similar items
   * @param text Text to compare
   * @param candidates Items to compare against
   * @param threshold Minimum similarity (0-1)
   */
  findSimilar(
    text: string,
    candidates: ItemProps[],
    threshold?: number,
    options?: AIRequestOptions
  ): Promise<SimilarityResult[]>;

  /**
   * Check for potential duplicate
   * @param newItem New item to check
   * @param existingItems Existing items to compare
   * @returns Most similar item if above threshold
   */
  checkDuplicate(
    newItem: { decision: string; context?: string },
    existingItems: ItemProps[],
    options?: AIRequestOptions
  ): Promise<{
    isDuplicate: boolean;
    similarItem?: ItemProps;
    similarity?: number;
  }>;

  // ===========================================
  // Batch Operations
  // ===========================================

  /**
   * Auto-categorize multiple items
   */
  batchCategorize(
    items: ItemProps[],
    existingTags?: string[],
    options?: AIRequestOptions
  ): Promise<Map<number, TagSuggestion[]>>;

  /**
   * Generate insights from items
   * @param items Items to analyze
   * @returns Insights about patterns, common themes, etc.
   */
  generateInsights(
    items: ItemProps[],
    options?: AIRequestOptions
  ): Promise<{
    themes: Array<{ theme: string; itemCount: number }>;
    patterns: string[];
    suggestions: string[];
  }>;

  // ===========================================
  // Provider Management
  // ===========================================

  /**
   * Get information about the AI provider
   */
  getProviderInfo(): AIProviderInfo;

  /**
   * Check if a capability is available
   */
  hasCapability(capability: AICapability): boolean;

  /**
   * Check if AI is available (connected, authenticated)
   */
  isAvailable(): Promise<boolean>;

  // ===========================================
  // Lifecycle
  // ===========================================

  /**
   * Initialize AI connection
   */
  initialize(): Promise<void>;

  /**
   * Shutdown AI connection
   */
  shutdown(): Promise<void>;

  /**
   * Clear any cached results
   */
  clearCache(): Promise<void>;
}
