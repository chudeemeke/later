/**
 * Update Retrospective Command
 *
 * Updates retrospective data after initial completion.
 * Allows adding lessons learned, adjusting metrics, etc.
 */

import { RetrospectiveProps } from '../../domain/entities/Retrospective.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { OutcomeValue } from '../../domain/value-objects/Outcome.js';

/**
 * Command input
 */
export interface UpdateRetrospectiveInput {
  itemId: number;
  outcome?: OutcomeValue;
  impactTimeSaved?: number;
  impactCostSaved?: number;
  effortEstimated?: number;
  effortActual?: number;
  lessonsLearned?: string;
}

/**
 * Command result
 */
export interface UpdateRetrospectiveResult {
  success: boolean;
  retrospective?: RetrospectiveProps;
  error?: string;
}

/**
 * Update Retrospective Command Handler
 */
export class UpdateRetrospectiveCommand {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the update command
   */
  async execute(input: UpdateRetrospectiveInput): Promise<UpdateRetrospectiveResult> {
    try {
      // Validate input
      if (!input.itemId || input.itemId <= 0) {
        return {
          success: false,
          error: 'Valid item ID is required',
        };
      }

      // Check if at least one field is being updated
      const hasUpdates =
        input.outcome !== undefined ||
        input.impactTimeSaved !== undefined ||
        input.impactCostSaved !== undefined ||
        input.effortEstimated !== undefined ||
        input.effortActual !== undefined ||
        input.lessonsLearned !== undefined;

      if (!hasUpdates) {
        return {
          success: false,
          error: 'At least one field must be provided to update',
        };
      }

      // Get existing retrospective
      const existing = await this.storage.getRetrospective(input.itemId);
      if (!existing) {
        return {
          success: false,
          error: `Retrospective for item ${input.itemId} not found`,
        };
      }

      // Merge updates with existing
      const updated = await this.storage.saveRetrospective({
        itemId: input.itemId,
        outcome: input.outcome ?? existing.outcome,
        impactTimeSaved: input.impactTimeSaved ?? existing.impactTimeSaved,
        impactCostSaved: input.impactCostSaved ?? existing.impactCostSaved,
        effortEstimated: input.effortEstimated ?? existing.effortEstimated,
        effortActual: input.effortActual ?? existing.effortActual,
        lessonsLearned: input.lessonsLearned ?? existing.lessonsLearned,
      });

      return {
        success: true,
        retrospective: updated,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
