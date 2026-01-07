/**
 * Get Item Query
 *
 * Retrieves a single item by ID with optional related data.
 * Supports including dependencies, retrospective, and reminders.
 */

import { ItemProps } from '../../domain/entities/Item.js';
import { DependencyProps } from '../../domain/entities/Dependency.js';
import { RetrospectiveProps } from '../../domain/entities/Retrospective.js';
import { ReminderProps } from '../../domain/entities/Reminder.js';
import { GitLinkProps } from '../../domain/entities/GitLink.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';

/**
 * Query input
 */
export interface GetItemInput {
  id: number;
  includeDependencies?: boolean;
  includeRetrospective?: boolean;
  includeReminders?: boolean;
  includeGitLinks?: boolean;
}

/**
 * Query result
 */
export interface GetItemResult {
  success: boolean;
  item?: ItemProps;
  dependencies?: DependencyProps[];
  dependents?: DependencyProps[];
  retrospective?: RetrospectiveProps;
  reminders?: ReminderProps[];
  gitLinks?: GitLinkProps[];
  error?: string;
}

/**
 * Get Item Query Handler
 */
export class GetItemQuery {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the query
   */
  async execute(input: GetItemInput): Promise<GetItemResult> {
    try {
      // Validate input
      if (!input.id || input.id <= 0) {
        return {
          success: false,
          error: 'Valid item ID is required',
        };
      }

      // Get the item
      const item = await this.storage.getItem(input.id);
      if (!item) {
        return {
          success: false,
          error: `Item ${input.id} not found`,
        };
      }

      const result: GetItemResult = {
        success: true,
        item,
      };

      // Fetch related data in parallel if requested
      const promises: Promise<void>[] = [];

      if (input.includeDependencies) {
        promises.push(
          Promise.all([
            this.storage.getDependencies(input.id),
            this.storage.getDependents(input.id),
          ]).then(([deps, dependents]) => {
            result.dependencies = deps;
            result.dependents = dependents;
          })
        );
      }

      if (input.includeRetrospective) {
        promises.push(
          this.storage.getRetrospective(input.id).then((retro) => {
            result.retrospective = retro || undefined;
          })
        );
      }

      if (input.includeReminders) {
        promises.push(
          this.storage.getRemindersForItem(input.id).then((reminders) => {
            result.reminders = reminders;
          })
        );
      }

      if (input.includeGitLinks) {
        promises.push(
          this.storage.getGitLinksForItem(input.id).then((links) => {
            result.gitLinks = links;
          })
        );
      }

      await Promise.all(promises);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
