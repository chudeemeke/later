/**
 * Update Item Command
 *
 * Updates an existing deferred decision item.
 * Handles status transitions, priority changes, and tag modifications.
 */

import { Item, ItemProps } from '../../domain/entities/Item.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { StatusValue, Status } from '../../domain/value-objects/Status.js';
import { PriorityValue, Priority } from '../../domain/value-objects/Priority.js';

/**
 * Command input
 */
export interface UpdateItemInput {
  id: number;
  decision?: string;
  context?: string;
  status?: StatusValue;
  priority?: PriorityValue;
  tags?: string[];
  addTags?: string[];
  removeTags?: string[];
  contextFiles?: string[];
  contextHash?: string;
}

/**
 * Command result
 */
export interface UpdateItemResult {
  success: boolean;
  item?: ItemProps;
  changes?: string[];
  error?: string;
}

/**
 * Update Item Command Handler
 */
export class UpdateItemCommand {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the update command
   */
  async execute(input: UpdateItemInput): Promise<UpdateItemResult> {
    try {
      // Validate input
      if (!input.id || input.id <= 0) {
        return {
          success: false,
          error: 'Valid item ID is required',
        };
      }

      // Get existing item
      const existingProps = await this.storage.getItem(input.id);
      if (!existingProps) {
        return {
          success: false,
          error: `Item ${input.id} not found`,
        };
      }

      // Reconstitute as entity for validation
      const item = Item.fromProps(existingProps);
      const changes: string[] = [];

      // Apply updates with validation
      if (input.decision !== undefined) {
        const trimmed = input.decision.trim();
        if (trimmed.length === 0) {
          return {
            success: false,
            error: 'Decision cannot be empty',
          };
        }
        if (trimmed !== item.decision) {
          changes.push(`decision: "${item.decision}" -> "${trimmed}"`);
        }
      }

      if (input.status !== undefined) {
        const newStatus = Status.create(input.status);
        if (!item.status.canTransitionTo(newStatus)) {
          return {
            success: false,
            error: `Cannot transition from ${item.status.value} to ${input.status}`,
          };
        }
        if (item.status.value !== input.status) {
          changes.push(`status: ${item.status.value} -> ${input.status}`);
        }
      }

      if (input.priority !== undefined && item.priority.value !== input.priority) {
        changes.push(`priority: ${item.priority.value} -> ${input.priority}`);
      }

      // Handle tag modifications
      let finalTags = [...item.tags];

      if (input.tags !== undefined) {
        finalTags = input.tags;
        changes.push(`tags: [${item.tags.join(', ')}] -> [${input.tags.join(', ')}]`);
      } else {
        if (input.addTags && input.addTags.length > 0) {
          const newTags = input.addTags.filter((t) => !finalTags.includes(t.toLowerCase()));
          if (newTags.length > 0) {
            finalTags = [...finalTags, ...newTags.map((t) => t.toLowerCase())];
            changes.push(`tags: added [${newTags.join(', ')}]`);
          }
        }

        if (input.removeTags && input.removeTags.length > 0) {
          const removeLower = input.removeTags.map((t) => t.toLowerCase());
          const removed = finalTags.filter((t) => removeLower.includes(t));
          if (removed.length > 0) {
            finalTags = finalTags.filter((t) => !removeLower.includes(t));
            changes.push(`tags: removed [${removed.join(', ')}]`);
          }
        }
      }

      if (input.context !== undefined && input.context !== item.context) {
        changes.push('context: updated');
      }

      // No changes to make
      if (changes.length === 0) {
        return {
          success: true,
          item: existingProps,
          changes: [],
        };
      }

      // Build update object
      const updates: Partial<ItemProps> = {
        updatedAt: new Date(),
      };

      if (input.decision !== undefined) {
        updates.decision = input.decision.trim();
      }
      if (input.context !== undefined) {
        updates.context = input.context;
      }
      if (input.status !== undefined) {
        updates.status = input.status;
      }
      if (input.priority !== undefined) {
        updates.priority = input.priority;
      }
      if (input.tags !== undefined || input.addTags || input.removeTags) {
        updates.tags = finalTags;
      }
      if (input.contextFiles !== undefined) {
        updates.contextFiles = input.contextFiles;
      }
      if (input.contextHash !== undefined) {
        updates.contextHash = input.contextHash;
      }

      // Store updates
      const updatedProps = await this.storage.updateItem(input.id, updates);

      return {
        success: true,
        item: updatedProps,
        changes,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
