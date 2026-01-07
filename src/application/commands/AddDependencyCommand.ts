/**
 * Add Dependency Command
 *
 * Creates a dependency relationship between items.
 * Handles cycle detection to prevent circular dependencies.
 */

import { Dependency, DependencyProps } from '../../domain/entities/Dependency.js';
import { Item } from '../../domain/entities/Item.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { DependencyResolver } from '../../domain/services/DependencyResolver.js';
import { DependencyTypeValue } from '../../domain/value-objects/DependencyType.js';

/**
 * Command input
 */
export interface AddDependencyInput {
  itemId: number;
  dependsOnId: number;
  type?: DependencyTypeValue;
}

/**
 * Command result
 */
export interface AddDependencyResult {
  success: boolean;
  dependency?: DependencyProps;
  cycleDetected?: {
    path: number[];
    description: string;
  };
  error?: string;
}

/**
 * Add Dependency Command Handler
 */
export class AddDependencyCommand {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the add dependency command
   */
  async execute(input: AddDependencyInput): Promise<AddDependencyResult> {
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

      // Self-dependency check
      if (input.itemId === input.dependsOnId) {
        return {
          success: false,
          error: 'Item cannot depend on itself',
        };
      }

      // Verify both items exist
      const [item, dependsOnItem] = await Promise.all([
        this.storage.getItem(input.itemId),
        this.storage.getItem(input.dependsOnId),
      ]);

      if (!item) {
        return {
          success: false,
          error: `Item ${input.itemId} not found`,
        };
      }

      if (!dependsOnItem) {
        return {
          success: false,
          error: `Item ${input.dependsOnId} not found`,
        };
      }

      // Check for existing dependency
      const existingDeps = await this.storage.getDependencies(input.itemId);
      const alreadyExists = existingDeps.some(
        (d) => d.dependsOnId === input.dependsOnId
      );

      if (alreadyExists) {
        return {
          success: false,
          error: `Dependency already exists: ${input.itemId} -> ${input.dependsOnId}`,
        };
      }

      // Determine if cycle detection is needed
      const depType = input.type || 'blocks';
      const needsCycleCheck = depType === 'blocks' || depType === 'parent-of';

      if (needsCycleCheck) {
        // Check for cycles
        const wouldCreateCycle = await this.storage.wouldCreateCycle(
          input.itemId,
          input.dependsOnId
        );

        if (wouldCreateCycle) {
          // Build cycle description
          const cyclePath = await this.buildCyclePath(
            input.itemId,
            input.dependsOnId
          );

          return {
            success: false,
            cycleDetected: {
              path: cyclePath,
              description: `Adding this dependency would create a cycle: ${cyclePath.join(' -> ')}`,
            },
            error: 'Dependency would create a cycle',
          };
        }
      }

      // Create the dependency
      const dependencyProps = await this.storage.createDependency({
        itemId: input.itemId,
        dependsOnId: input.dependsOnId,
        type: depType,
      });

      return {
        success: true,
        dependency: dependencyProps,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build a cycle path for error reporting
   */
  private async buildCyclePath(
    fromId: number,
    toId: number
  ): Promise<number[]> {
    // Get all items and dependencies to build the full path
    const allItems = await this.storage.listItems();
    const allDeps: DependencyProps[] = [];

    for (const item of allItems) {
      const deps = await this.storage.getDependencies(item.id);
      allDeps.push(...deps);
    }

    // Build resolver and check
    const resolver = new DependencyResolver();
    const items = allItems.map((p) => Item.fromProps(p));
    const dependencies = allDeps.map((p) =>
      Dependency.fromProps({
        ...p,
        createdAt: p.createdAt || new Date(),
      })
    );

    resolver.buildGraph(items, dependencies);
    const result = resolver.wouldCreateCycle(fromId, toId);

    return result.cyclePath || [fromId, toId, fromId];
  }
}
