/**
 * Remove Dependency Command
 *
 * Removes a dependency relationship between items.
 * Handles validation and reports cascading effects.
 */

import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { DependencyTypeValue } from '../../domain/value-objects/DependencyType.js';

/**
 * Command input
 */
export interface RemoveDependencyInput {
  itemId: number;
  dependsOnId: number;
  type?: DependencyTypeValue; // Optional: filter by specific type
  reportUnblocked?: boolean; // Report items that become unblocked
}

/**
 * Command result
 */
export interface RemoveDependencyResult {
  success: boolean;
  removed?: boolean;
  notFound?: boolean;
  unblockedItems?: number[]; // Items that are now unblocked
  error?: string;
}

/**
 * Remove Dependency Command Handler
 */
export class RemoveDependencyCommand {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the remove dependency command
   */
  async execute(input: RemoveDependencyInput): Promise<RemoveDependencyResult> {
    try {
      // Validate input
      if (!input.itemId || input.itemId <= 0) {
        return {
          success: false,
          error: 'Valid item ID is required',
        };
      }

      if (!input.dependsOnId || input.dependsOnId <= 0) {
        return {
          success: false,
          error: 'Valid depends-on ID is required',
        };
      }

      // Self-dependency check (shouldn't exist but validate anyway)
      if (input.itemId === input.dependsOnId) {
        return {
          success: false,
          error: 'Item cannot depend on itself',
        };
      }

      // Check if dependency exists
      const dependencies = await this.storage.getDependencies(input.itemId);
      const existingDep = dependencies.find((d) => {
        const matchesTarget = d.dependsOnId === input.dependsOnId;
        if (!matchesTarget) return false;

        // If type is specified, match type too
        if (input.type) {
          return d.type === input.type;
        }

        return true;
      });

      if (!existingDep) {
        return {
          success: false,
          notFound: true,
          error: `Dependency not found: ${input.itemId} -> ${input.dependsOnId}${input.type ? ` (${input.type})` : ''}`,
        };
      }

      // Get items that might be unblocked before removal
      let unblockedItems: number[] = [];
      if (input.reportUnblocked && existingDep.type === 'blocks') {
        unblockedItems = await this.getItemsToUnblock(input.itemId, input.dependsOnId);
      }

      // Delete the dependency (deleteDependency returns Promise<void>)
      await this.storage.deleteDependency(input.itemId, input.dependsOnId);

      return {
        success: true,
        removed: true,
        unblockedItems: unblockedItems.length > 0 ? unblockedItems : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get items that would become unblocked after removing this dependency
   */
  private async getItemsToUnblock(
    itemId: number,
    dependsOnId: number
  ): Promise<number[]> {
    // If this is the only blocker for the item, it will be unblocked
    const allDeps = await this.storage.getDependencies(itemId);
    const blockingDeps = allDeps.filter((d) => d.type === 'blocks');

    // If this is the only blocking dependency
    if (blockingDeps.length === 1 && blockingDeps[0].dependsOnId === dependsOnId) {
      return [itemId];
    }

    return [];
  }
}
