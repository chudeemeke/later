/**
 * Delete Item Command
 *
 * Deletes an item (soft or hard delete).
 * Handles dependency cleanup.
 */

import { IStoragePort } from '../../domain/ports/IStoragePort.js';

/**
 * Command input
 */
export interface DeleteItemInput {
  id: number;
  hard?: boolean; // Permanent delete vs archive
}

/**
 * Command result
 */
export interface DeleteItemResult {
  success: boolean;
  deletedId?: number;
  wasArchived?: boolean;
  cleanedUpDependencies?: number;
  cleanedUpReminders?: number;
  error?: string;
}

/**
 * Delete Item Command Handler
 */
export class DeleteItemCommand {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the delete command
   */
  async execute(input: DeleteItemInput): Promise<DeleteItemResult> {
    try {
      // Validate input
      if (!input.id || input.id <= 0) {
        return {
          success: false,
          error: 'Valid item ID is required',
        };
      }

      // Verify item exists
      const item = await this.storage.getItem(input.id);
      if (!item) {
        return {
          success: false,
          error: `Item ${input.id} not found`,
        };
      }

      // Get dependent items count (for info)
      const dependents = await this.storage.getDependents(input.id);
      const reminders = await this.storage.getRemindersForItem(input.id);

      // Delete the item (cascade handled by storage)
      await this.storage.deleteItem(input.id, input.hard);

      return {
        success: true,
        deletedId: input.id,
        wasArchived: !input.hard,
        cleanedUpDependencies: dependents.length,
        cleanedUpReminders: reminders.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
