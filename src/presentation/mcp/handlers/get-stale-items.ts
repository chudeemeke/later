/**
 * MCP Get Stale Items Handler
 *
 * Wraps GetStaleItemsQuery for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { PriorityValue } from '../../../domain/value-objects/Priority.js';

/**
 * MCP tool arguments
 */
export interface GetStaleItemsArgs {
  min_score?: number;
  include_urgent?: boolean;
  priority_filter?: PriorityValue[];
  exclude_archived?: boolean;
}

/**
 * Staleness factors in MCP format
 */
export interface StalenessFactorsMCP {
  time_factor: number;
  priority_factor: number;
  activity_factor: number;
}

/**
 * Stale item in MCP format
 */
export interface StaleItemMCP {
  id: number;
  decision: string;
  status: string;
  priority: string;
  staleness_score: number;
  days_since_update: number;
  recommendation: 'none' | 'review' | 'refresh' | 'archive';
  factors: StalenessFactorsMCP;
}

/**
 * Summary in MCP format
 */
export interface StalenessSummaryMCP {
  refresh: number;
  review: number;
  archive: number;
}

/**
 * MCP tool result
 */
export interface GetStaleItemsResult {
  success: boolean;
  stale_items?: StaleItemMCP[];
  total?: number;
  summary?: StalenessSummaryMCP;
  error?: string;
}

/**
 * Create a get stale items handler bound to the container
 */
export function createGetStaleItemsHandler(
  container: Container
): (args: GetStaleItemsArgs) => Promise<GetStaleItemsResult> {
  return async (args: GetStaleItemsArgs): Promise<GetStaleItemsResult> => {
    // Execute the application query
    const result = await container.queries.getStaleItems.execute({
      minScore: args.min_score,
      includeUrgent: args.include_urgent,
      priorityFilter: args.priority_filter,
      excludeArchived: args.exclude_archived,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: GetStaleItemsResult = {
      success: true,
      total: result.total,
    };

    // Transform stale items
    if (result.staleItems) {
      mcpResult.stale_items = result.staleItems.map((item) => ({
        id: item.item.id!,
        decision: item.item.decision,
        status: item.item.status,
        priority: item.item.priority,
        staleness_score: item.stalenessScore,
        days_since_update: item.daysSinceUpdate,
        recommendation: item.recommendation,
        factors: {
          time_factor: item.factors.timeFactor,
          priority_factor: item.factors.priorityFactor,
          activity_factor: item.factors.activityFactor,
        },
      }));
    }

    // Transform summary
    if (result.summary) {
      mcpResult.summary = {
        refresh: result.summary.refresh,
        review: result.summary.review,
        archive: result.summary.archive,
      };
    }

    return mcpResult;
  };
}
