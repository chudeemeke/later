/**
 * Get Retrospective Query
 *
 * Retrieves retrospective data for a completed item with optional analysis.
 */

import { ItemProps } from '../../domain/entities/Item.js';
import {
  Retrospective,
  RetrospectiveProps,
} from '../../domain/entities/Retrospective.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';

/**
 * Query input
 */
export interface GetRetrospectiveInput {
  itemId: number;
  includeItemDetails?: boolean;
  includeAnalysis?: boolean;
}

/**
 * Retrospective analysis
 */
export interface RetrospectiveAnalysis {
  estimationAccuracy?: number; // percentage
  effortVariance?: number; // actual - estimated
  wasUnderestimated: boolean;
  wasOverestimated: boolean;
  isPositive: boolean;
  hasImpact: boolean;
  hasLessons: boolean;
}

/**
 * Query result
 */
export interface GetRetrospectiveResult {
  success: boolean;
  retrospective?: RetrospectiveProps;
  item?: ItemProps;
  analysis?: RetrospectiveAnalysis;
  error?: string;
}

/**
 * Get Retrospective Query Handler
 */
export class GetRetrospectiveQuery {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the query
   */
  async execute(input: GetRetrospectiveInput): Promise<GetRetrospectiveResult> {
    try {
      // Validate input
      if (!input.itemId || input.itemId <= 0) {
        return {
          success: false,
          error: 'Valid item ID is required',
        };
      }

      // Get the item first
      const item = await this.storage.getItem(input.itemId);
      if (!item) {
        return {
          success: false,
          error: `Item ${input.itemId} not found`,
        };
      }

      // Get the retrospective
      const retrospectiveProps = await this.storage.getRetrospective(input.itemId);
      if (!retrospectiveProps) {
        return {
          success: false,
          error: `Retrospective for item ${input.itemId} not found`,
        };
      }

      const result: GetRetrospectiveResult = {
        success: true,
        retrospective: retrospectiveProps,
      };

      // Include item details if requested
      if (input.includeItemDetails) {
        result.item = item;
      }

      // Include analysis if requested
      if (input.includeAnalysis) {
        result.analysis = this.analyzeRetrospective(retrospectiveProps);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Analyze retrospective data
   */
  private analyzeRetrospective(props: RetrospectiveProps): RetrospectiveAnalysis {
    const retrospective = Retrospective.fromProps(props);

    return {
      estimationAccuracy: retrospective.estimationAccuracy(),
      effortVariance: retrospective.effortVariance(),
      wasUnderestimated: retrospective.wasUnderestimated(),
      wasOverestimated: retrospective.wasOverestimated(),
      isPositive: retrospective.isPositive(),
      hasImpact: retrospective.hasImpact(),
      hasLessons: retrospective.hasLessons(),
    };
  }
}
