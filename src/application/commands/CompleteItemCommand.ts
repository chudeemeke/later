/**
 * Complete Item Command
 *
 * Marks an item as done with optional retrospective data.
 * Handles dependency checks (soft blocking) and retrospective creation.
 */

import { Item, ItemProps } from '../../domain/entities/Item.js';
import {
  Retrospective,
  CreateRetrospectiveInput,
  RetrospectiveProps,
} from '../../domain/entities/Retrospective.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { DependencyResolver } from '../../domain/services/DependencyResolver.js';
import { Dependency } from '../../domain/entities/Dependency.js';
import { OutcomeValue } from '../../domain/value-objects/Outcome.js';

/**
 * Command input
 */
export interface CompleteItemInput {
  id: number;
  force?: boolean; // Skip dependency check
  retrospective?: {
    outcome: OutcomeValue;
    impactTimeSaved?: number;
    impactCostSaved?: number;
    effortEstimated?: number;
    effortActual?: number;
    lessonsLearned?: string;
  };
}

/**
 * Command result
 */
export interface CompleteItemResult {
  success: boolean;
  item?: ItemProps;
  retrospective?: RetrospectiveProps;
  blockedBy?: Array<{ id: number; decision: string }>;
  unblockedItems?: number[];
  error?: string;
}

/**
 * Complete Item Command Handler
 */
export class CompleteItemCommand {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the complete command
   */
  async execute(input: CompleteItemInput): Promise<CompleteItemResult> {
    try {
      // Validate input
      if (!input.id || input.id <= 0) {
        return {
          success: false,
          error: 'Valid item ID is required',
        };
      }

      // Get the item
      const itemProps = await this.storage.getItem(input.id);
      if (!itemProps) {
        return {
          success: false,
          error: `Item ${input.id} not found`,
        };
      }

      const item = Item.fromProps(itemProps);

      // Check if already complete
      if (item.isComplete()) {
        return {
          success: false,
          error: `Item ${input.id} is already ${item.status.value}`,
        };
      }

      // Check for blocking dependencies (unless forced)
      if (!input.force) {
        const blockedBy = await this.getBlockingDependencies(input.id);
        if (blockedBy.length > 0) {
          return {
            success: false,
            blockedBy,
            error: 'Item is blocked by unresolved dependencies. Use force to complete anyway.',
          };
        }
      }

      // Mark as done
      const updatedProps = await this.storage.updateItem(input.id, {
        status: 'done',
        updatedAt: new Date(),
      });

      // Create retrospective if provided
      let retrospectiveProps: RetrospectiveProps | undefined;
      if (input.retrospective) {
        const retroInput: CreateRetrospectiveInput = {
          itemId: input.id,
          outcome: input.retrospective.outcome,
          impactTimeSaved: input.retrospective.impactTimeSaved,
          impactCostSaved: input.retrospective.impactCostSaved,
          effortEstimated: input.retrospective.effortEstimated,
          effortActual: input.retrospective.effortActual,
          lessonsLearned: input.retrospective.lessonsLearned,
        };
        retrospectiveProps = await this.storage.saveRetrospective(retroInput);
      }

      // Find items that are now unblocked
      const unblockedItems = await this.getNewlyUnblockedItems(input.id);

      return {
        success: true,
        item: updatedProps,
        retrospective: retrospectiveProps,
        unblockedItems,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get blocking dependencies for an item
   */
  private async getBlockingDependencies(
    itemId: number
  ): Promise<Array<{ id: number; decision: string }>> {
    const dependencies = await this.storage.getDependencies(itemId);

    // Filter to blocking type only
    const blockingDeps = dependencies.filter((d) => d.type === 'blocks');
    if (blockingDeps.length === 0) return [];

    // Get the dependency items
    const depIds = blockingDeps.map((d) => d.dependsOnId);
    const depItems = await this.storage.getItems(depIds);

    // Return unresolved ones
    return depItems
      .filter((item) => item.status !== 'done' && item.status !== 'archived')
      .map((item) => ({ id: item.id, decision: item.decision }));
  }

  /**
   * Find items that become unblocked when this item is completed
   */
  private async getNewlyUnblockedItems(completedId: number): Promise<number[]> {
    // Get all items that depend on the completed item
    const dependents = await this.storage.getDependents(completedId);

    // Filter to blocking type
    const blockingDependents = dependents.filter((d) => d.type === 'blocks');
    if (blockingDependents.length === 0) return [];

    const unblockedIds: number[] = [];

    for (const dep of blockingDependents) {
      // Check if this dependent has any other unresolved blocking dependencies
      const otherDeps = await this.storage.getDependencies(dep.itemId);
      const blockingOthers = otherDeps.filter(
        (d) => d.type === 'blocks' && d.dependsOnId !== completedId
      );

      if (blockingOthers.length === 0) {
        // No other blocking deps - this item is now unblocked
        unblockedIds.push(dep.itemId);
      } else {
        // Check if all other blockers are resolved
        const otherIds = blockingOthers.map((d) => d.dependsOnId);
        const otherItems = await this.storage.getItems(otherIds);
        const unresolvedBlockers = otherItems.filter(
          (item) => item.status !== 'done' && item.status !== 'archived'
        );

        if (unresolvedBlockers.length === 0) {
          unblockedIds.push(dep.itemId);
        }
      }
    }

    return unblockedIds;
  }
}
