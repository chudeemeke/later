/**
 * Full-text search with TF-IDF relevance scoring
 * Provides powerful search capabilities across all text fields
 */

import type { Storage } from '../storage/interface.js';
import type { DeferredItem } from '../types.js';
import { extractKeywords } from '../utils/duplicate.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('later:search');

export interface SearchArgs {
  query: string;
  fields?: Array<'decision' | 'context' | 'tags'>;
  limit?: number;
  minScore?: number;
}

export interface SearchResult {
  item: DeferredItem;
  score: number;
  matches: {
    decision?: number;
    context?: number;
    tags?: number;
  };
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  query: string;
  totalFound: number;
  searchTime: number;
}

/**
 * Calculate TF-IDF score for a document
 */
function calculateTFIDF(
  queryKeywords: string[],
  docKeywords: string[],
  totalDocs: number,
  docsWithTerm: Map<string, number>
): number {
  if (queryKeywords.length === 0 || docKeywords.length === 0) {
    return 0;
  }

  const docKeywordSet = new Set(docKeywords);
  let score = 0;

  for (const term of queryKeywords) {
    // Term Frequency: how often term appears in document
    const termFreq = docKeywords.filter(k => k === term).length / docKeywords.length;

    // Inverse Document Frequency: how rare the term is across all documents
    const docsWithTermCount = docsWithTerm.get(term) || 0;
    const idf = docsWithTermCount > 0
      ? Math.log(totalDocs / docsWithTermCount)
      : 0;

    // TF-IDF score
    if (docKeywordSet.has(term)) {
      score += termFreq * idf;
    }
  }

  return score;
}

/**
 * Build inverted index for IDF calculation
 */
function buildInvertedIndex(items: DeferredItem[]): Map<string, number> {
  const index = new Map<string, number>();

  for (const item of items) {
    const text = `${item.decision} ${item.context} ${item.tags.join(' ')}`;
    const keywords = new Set(extractKeywords(text));

    for (const keyword of keywords) {
      index.set(keyword, (index.get(keyword) || 0) + 1);
    }
  }

  return index;
}

/**
 * Search for items matching query with relevance scoring
 */
export async function handleSearch(
  args: SearchArgs,
  storage: Storage
): Promise<SearchResponse> {
  const startTime = Date.now();

  try {
    // Default parameters
    const fields = args.fields || ['decision', 'context', 'tags'];
    const limit = args.limit || 10;
    const minScore = args.minScore || 0.01;

    // Extract query keywords
    const queryKeywords = extractKeywords(args.query);

    if (queryKeywords.length === 0) {
      log.info('search_empty_query', { query: args.query });
      return {
        success: true,
        results: [],
        query: args.query,
        totalFound: 0,
        searchTime: Date.now() - startTime,
      };
    }

    // Get all items
    const allItems = await storage.readAll();

    // Only search active items (pending, in-progress)
    const activeItems = allItems.filter(
      item => item.status === 'pending' || item.status === 'in-progress'
    );

    // Build inverted index for IDF calculation
    const invertedIndex = buildInvertedIndex(activeItems);
    const totalDocs = activeItems.length;

    // Score each item
    const results: SearchResult[] = [];

    for (const item of activeItems) {
      let totalScore = 0;
      const matches: SearchResult['matches'] = {};

      // Score decision field
      if (fields.includes('decision')) {
        const keywords = extractKeywords(item.decision);
        const score = calculateTFIDF(queryKeywords, keywords, totalDocs, invertedIndex);
        if (score > 0) {
          matches.decision = Math.round(score * 100) / 100;
          totalScore += score * 2; // Weight decision higher
        }
      }

      // Score context field
      if (fields.includes('context')) {
        const keywords = extractKeywords(item.context);
        const score = calculateTFIDF(queryKeywords, keywords, totalDocs, invertedIndex);
        if (score > 0) {
          matches.context = Math.round(score * 100) / 100;
          totalScore += score;
        }
      }

      // Score tags field
      if (fields.includes('tags')) {
        const keywords = extractKeywords(item.tags.join(' '));
        const score = calculateTFIDF(queryKeywords, keywords, totalDocs, invertedIndex);
        if (score > 0) {
          matches.tags = Math.round(score * 100) / 100;
          totalScore += score * 1.5; // Weight tags higher than context
        }
      }

      // Add to results if score meets threshold
      if (totalScore >= minScore) {
        results.push({
          item,
          score: Math.round(totalScore * 100) / 100,
          matches,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limitedResults = results.slice(0, limit);

    const searchTime = Date.now() - startTime;

    log.info('search_completed', {
      query: args.query,
      totalFound: results.length,
      returned: limitedResults.length,
      searchTime,
    });

    return {
      success: true,
      results: limitedResults,
      query: args.query,
      totalFound: results.length,
      searchTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('search_failed', { query: args.query, error: errorMessage });

    return {
      success: false,
      results: [],
      query: args.query,
      totalFound: 0,
      searchTime: Date.now() - startTime,
    };
  }
}
