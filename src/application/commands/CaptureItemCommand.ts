/**
 * Capture Item Command
 *
 * Creates a new deferred decision item.
 * Handles duplicate detection, auto-categorization, and context capture.
 */

import { Item, CreateItemInput, ItemProps } from '../../domain/entities/Item.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { IAIPort, TagSuggestion } from '../../domain/ports/IAIPort.js';
import { PriorityValue } from '../../domain/value-objects/Priority.js';

/**
 * Command input
 */
export interface CaptureItemInput {
  decision: string;
  context?: string;
  tags?: string[];
  priority?: PriorityValue;
  conversationId?: string;
  contextFiles?: string[];
  contextHash?: string;
  autoCategorize?: boolean;
  checkDuplicates?: boolean;
}

/**
 * Command result
 */
export interface CaptureItemResult {
  success: boolean;
  item?: ItemProps;
  duplicateWarning?: {
    existingId: number;
    similarity: number;
    decision: string;
  };
  suggestedTags?: TagSuggestion[];
  error?: string;
}

/**
 * Capture Item Command Handler
 */
export class CaptureItemCommand {
  constructor(
    private readonly storage: IStoragePort,
    private readonly ai?: IAIPort
  ) {}

  /**
   * Execute the capture command
   */
  async execute(input: CaptureItemInput): Promise<CaptureItemResult> {
    try {
      // Validate input
      if (!input.decision || input.decision.trim().length === 0) {
        return {
          success: false,
          error: 'Decision cannot be empty',
        };
      }

      // Check for duplicates if enabled
      if (input.checkDuplicates !== false && this.ai) {
        const duplicateCheck = await this.checkDuplicate(input);
        if (duplicateCheck) {
          return {
            success: false,
            duplicateWarning: duplicateCheck,
            error: 'Potential duplicate detected',
          };
        }
      }

      // Auto-categorize if enabled and AI available
      let suggestedTags: TagSuggestion[] = [];
      let finalTags = input.tags || [];

      if (input.autoCategorize !== false && this.ai) {
        try {
          const isAvailable = await this.ai.isAvailable();
          if (isAvailable) {
            suggestedTags = await this.ai.suggestTags(
              `${input.decision}\n${input.context || ''}`,
              await this.getExistingTags()
            );

            // Auto-add high-confidence tags
            const highConfidenceTags = suggestedTags
              .filter((t) => t.confidence >= 0.8)
              .map((t) => t.tag);

            finalTags = [...new Set([...finalTags, ...highConfidenceTags])];
          }
        } catch {
          // AI unavailable - continue without categorization
        }
      }

      // Create the item input
      const createInput: CreateItemInput = {
        decision: input.decision.trim(),
        context: input.context,
        tags: finalTags,
        priority: input.priority,
        conversationId: input.conversationId,
        contextFiles: input.contextFiles,
        contextHash: input.contextHash,
      };

      // Store the item
      const itemProps = await this.storage.createItem(createInput);

      return {
        success: true,
        item: itemProps,
        suggestedTags: suggestedTags.filter((t) => t.confidence < 0.8), // Return remaining suggestions
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check for potential duplicates
   */
  private async checkDuplicate(
    input: CaptureItemInput
  ): Promise<CaptureItemResult['duplicateWarning'] | null> {
    if (!this.ai) return null;

    try {
      const existingItems = await this.storage.listItems(
        { status: ['pending', 'in-progress'] },
        { field: 'createdAt', direction: 'desc' },
        { limit: 50 } // Check recent items only
      );

      if (existingItems.length === 0) return null;

      // Pass ItemProps directly to AI - it expects ItemProps[], not Item[]
      const result = await this.ai.checkDuplicate(
        { decision: input.decision, context: input.context },
        existingItems
      );

      if (result.isDuplicate && result.similarItem && result.similarity) {
        return {
          existingId: result.similarItem.id,
          similarity: result.similarity,
          decision: result.similarItem.decision,
        };
      }

      return null;
    } catch {
      // Duplicate check failed - continue without warning
      return null;
    }
  }

  /**
   * Get existing tags for consistency
   */
  private async getExistingTags(): Promise<string[]> {
    try {
      const items = await this.storage.listItems(
        {},
        { field: 'createdAt', direction: 'desc' },
        { limit: 100 }
      );

      const allTags = new Set<string>();
      for (const item of items) {
        for (const tag of item.tags || []) {
          allTags.add(tag);
        }
      }

      return Array.from(allTags);
    } catch {
      return [];
    }
  }
}
