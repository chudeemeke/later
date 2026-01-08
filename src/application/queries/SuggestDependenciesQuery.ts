/**
 * Suggest Dependencies Query
 *
 * AI-powered query that suggests potential dependencies between items
 * based on text similarity, keyword matching, and tag overlap.
 */

import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { ItemProps } from '../../domain/entities/Item.js';
import { DependencyTypeValue } from '../../domain/value-objects/DependencyType.js';

/**
 * Query input
 */
export interface SuggestDependenciesInput {
  itemId: number;
  limit?: number; // Max suggestions to return (default: 10)
  minConfidence?: number; // Minimum confidence threshold (0-1, default: 0.3)
  includeCompleted?: boolean; // Include done/archived items
  includeTargetDetails?: boolean; // Include target item details in response
}

/**
 * Suggested dependency
 */
export interface SuggestedDependency {
  targetId: number;
  suggestedType: DependencyTypeValue;
  confidence: number; // 0-1 confidence score
  reason: string;
  targetDecision?: string;
  targetStatus?: string;
  targetPriority?: string;
}

/**
 * Query result
 */
export interface SuggestDependenciesResult {
  success: boolean;
  suggestions?: SuggestedDependency[];
  error?: string;
}

/**
 * Suggest Dependencies Query Handler
 */
export class SuggestDependenciesQuery {
  // Common English stop words to filter out
  private readonly stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'up',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    'here',
    'there',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    's',
    't',
    'can',
    'will',
    'just',
    'don',
    'should',
    'now',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'having',
    'do',
    'does',
    'did',
    'doing',
    'would',
    'could',
    'need',
    'must',
    'this',
    'that',
    'these',
    'those',
    'i',
    'me',
    'my',
    'myself',
    'we',
    'our',
    'ours',
    'ourselves',
    'you',
    'your',
    'yours',
    'yourself',
    'yourselves',
    'he',
    'him',
    'his',
    'himself',
    'she',
    'her',
    'hers',
    'herself',
    'it',
    'its',
    'itself',
    'they',
    'them',
    'their',
    'theirs',
    'themselves',
    'what',
    'which',
    'who',
    'whom',
  ]);

  // Keywords that suggest prerequisite relationship
  private readonly prerequisiteKeywords = new Set([
    'before',
    'first',
    'prerequisite',
    'required',
    'dependency',
    'must',
    'need',
    'complete',
    'finish',
    'done',
    'test',
    'testing',
    'build',
    'deploy',
    'release',
    'production',
  ]);

  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the query
   */
  async execute(input: SuggestDependenciesInput): Promise<SuggestDependenciesResult> {
    try {
      // Validate input
      if (!input.itemId || input.itemId <= 0) {
        return {
          success: false,
          error: 'Valid item ID is required',
        };
      }

      // Get the source item
      const sourceItem = await this.storage.getItem(input.itemId);
      if (!sourceItem) {
        return {
          success: false,
          error: `Item ${input.itemId} not found`,
        };
      }

      // Get all items
      const allItems = await this.storage.listItems();

      // Get existing dependencies
      const existingDeps = await this.storage.getDependencies(input.itemId);
      const existingDepIds = new Set(existingDeps.map((d) => d.dependsOnId));

      // Filter candidates
      const candidates = allItems.filter((item) => {
        // Exclude self
        if (item.id === input.itemId) return false;

        // Exclude existing dependencies
        if (existingDepIds.has(item.id)) return false;

        // Exclude completed unless requested
        if (!input.includeCompleted) {
          if (item.status === 'done' || item.status === 'archived') return false;
        }

        return true;
      });

      // Score each candidate
      const scored = candidates.map((candidate) => ({
        item: candidate,
        score: this.calculateSimilarityScore(sourceItem, candidate),
      }));

      // Filter by minimum confidence
      const minConfidence = input.minConfidence ?? 0.3;
      const filtered = scored.filter((s) => s.score.total >= minConfidence);

      // Sort by score descending
      filtered.sort((a, b) => b.score.total - a.score.total);

      // Apply limit
      const limit = input.limit ?? 10;
      const top = filtered.slice(0, limit);

      // Build suggestions
      const suggestions: SuggestedDependency[] = top.map((s) => {
        const suggestion: SuggestedDependency = {
          targetId: s.item.id,
          suggestedType: this.suggestDependencyType(sourceItem, s.item, s.score),
          confidence: s.score.total,
          reason: this.buildReason(s.score),
        };

        if (input.includeTargetDetails) {
          suggestion.targetDecision = s.item.decision;
          suggestion.targetStatus = s.item.status;
          suggestion.targetPriority = s.item.priority;
        }

        return suggestion;
      });

      return {
        success: true,
        suggestions,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate similarity score between two items
   */
  private calculateSimilarityScore(
    source: ItemProps,
    target: ItemProps
  ): SimilarityScore {
    const textScore = this.calculateTextSimilarity(source, target);
    const tagScore = this.calculateTagSimilarity(source.tags, target.tags);

    // Weight: text 60%, tags 40%
    const total = textScore.score * 0.6 + tagScore.score * 0.4;

    return {
      total: Math.min(1, total),
      textScore: textScore.score,
      tagScore: tagScore.score,
      sharedKeywords: textScore.sharedKeywords,
      sharedTags: tagScore.sharedTags,
    };
  }

  /**
   * Calculate text similarity using keyword overlap
   */
  private calculateTextSimilarity(
    source: ItemProps,
    target: ItemProps
  ): { score: number; sharedKeywords: string[] } {
    const sourceKeywords = this.extractKeywords(
      `${source.decision} ${source.context || ''}`
    );
    const targetKeywords = this.extractKeywords(
      `${target.decision} ${target.context || ''}`
    );

    const sharedKeywords: string[] = [];
    for (const keyword of sourceKeywords) {
      if (targetKeywords.has(keyword)) {
        sharedKeywords.push(keyword);
      }
    }

    if (sourceKeywords.size === 0 || targetKeywords.size === 0) {
      return { score: 0, sharedKeywords: [] };
    }

    // Jaccard similarity coefficient
    const union = new Set([...sourceKeywords, ...targetKeywords]);
    const score = sharedKeywords.length / union.size;

    return { score, sharedKeywords };
  }

  /**
   * Calculate tag similarity
   */
  private calculateTagSimilarity(
    sourceTags: string[],
    targetTags: string[]
  ): { score: number; sharedTags: string[] } {
    if (sourceTags.length === 0 || targetTags.length === 0) {
      return { score: 0, sharedTags: [] };
    }

    const sourceSet = new Set(sourceTags.map((t) => t.toLowerCase()));
    const targetSet = new Set(targetTags.map((t) => t.toLowerCase()));

    const sharedTags: string[] = [];
    for (const tag of sourceSet) {
      if (targetSet.has(tag)) {
        sharedTags.push(tag);
      }
    }

    // Jaccard similarity for tags
    const union = new Set([...sourceSet, ...targetSet]);
    const score = sharedTags.length / union.size;

    return { score, sharedTags };
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .filter((w) => !this.stopWords.has(w));

    return new Set(words);
  }

  /**
   * Suggest dependency type based on context
   */
  private suggestDependencyType(
    source: ItemProps,
    target: ItemProps,
    score: SimilarityScore
  ): DependencyTypeValue {
    // Check if target item contains prerequisite keywords
    const targetText = `${target.decision} ${target.context || ''}`.toLowerCase();
    const sourceText = `${source.decision} ${source.context || ''}`.toLowerCase();

    let hasPrerequisiteSignal = false;

    // Check for explicit blocking keywords in source
    if (
      sourceText.includes('after') ||
      sourceText.includes('depends on') ||
      sourceText.includes('requires') ||
      sourceText.includes('need')
    ) {
      hasPrerequisiteSignal = true;
    }

    // Check for prerequisite keywords in target
    for (const keyword of this.prerequisiteKeywords) {
      if (targetText.includes(keyword)) {
        hasPrerequisiteSignal = true;
        break;
      }
    }

    // High confidence + prerequisite signals = blocks
    if (hasPrerequisiteSignal && score.total >= 0.5) {
      return 'blocks';
    }

    // Medium-high confidence = relates-to
    if (score.total >= 0.4) {
      return 'blocks';
    }

    // Lower confidence = relates-to
    return 'relates-to';
  }

  /**
   * Build human-readable reason for suggestion
   */
  private buildReason(score: SimilarityScore): string {
    const reasons: string[] = [];

    if (score.sharedTags.length > 0) {
      reasons.push(`Shared tag${score.sharedTags.length > 1 ? 's' : ''}: ${score.sharedTags.join(', ')}`);
    }

    if (score.sharedKeywords.length > 0) {
      const topKeywords = score.sharedKeywords.slice(0, 5);
      reasons.push(`Similar keywords: ${topKeywords.join(', ')}`);
    }

    if (reasons.length === 0) {
      return 'General similarity detected';
    }

    return reasons.join('; ');
  }
}

/**
 * Internal similarity score structure
 */
interface SimilarityScore {
  total: number;
  textScore: number;
  tagScore: number;
  sharedKeywords: string[];
  sharedTags: string[];
}
