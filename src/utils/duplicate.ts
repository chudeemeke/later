import type { DeferredItem } from '../types.js';

// Stop words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'should', 'could', 'may', 'might', 'must',
  'this', 'that', 'these', 'those', 'of', 'to', 'in', 'for', 'on',
  'at', 'by', 'with', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'can', 'just',
]);

/**
 * Calculates Levenshtein distance between two strings
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Minimum number of edits required to transform s1 into s2
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;

  // Create matrix
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first column and row
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Extracts keywords from text (lowercase, no stop words, no punctuation)
 * @param text - Text to extract keywords from
 * @returns Array of keywords
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  // Convert to lowercase and remove punctuation
  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')     // Collapse multiple spaces
    .trim();

  // Split into words and filter stop words
  const words = cleaned.split(' ').filter((word) => {
    return word.length > 0 && !STOP_WORDS.has(word);
  });

  return words;
}

/**
 * Calculates keyword overlap percentage between two texts
 * @param text1 - First text
 * @param text2 - Second text
 * @returns Percentage overlap (0-100)
 */
export function keywordOverlap(text1: string, text2: string): number {
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  if (keywords1.length === 0 && keywords2.length === 0) {
    return 0;
  }

  if (keywords1.length === 0 || keywords2.length === 0) {
    return 0;
  }

  // Count common keywords
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);

  let common = 0;
  for (const keyword of set1) {
    if (set2.has(keyword)) {
      common++;
    }
  }

  // Jaccard similarity: intersection / union
  const union = set1.size + set2.size - common;
  const overlap = union > 0 ? (common / union) * 100 : 0;

  return Math.round(overlap);
}

/**
 * Calculates similarity score between two deferred items
 * Uses weighted combination: 60% title similarity, 40% keyword overlap
 * @param item1 - First item
 * @param item2 - Second item
 * @returns Similarity percentage (0-100)
 */
export function calculateSimilarity(
  item1: DeferredItem,
  item2: DeferredItem
): number {
  // Title similarity using Levenshtein distance
  const titleDistance = levenshteinDistance(
    item1.decision.toLowerCase(),
    item2.decision.toLowerCase()
  );
  const maxTitleLen = Math.max(item1.decision.length, item2.decision.length);
  const titleSimilarity = maxTitleLen > 0
    ? Math.round(((maxTitleLen - titleDistance) / maxTitleLen) * 100)
    : 100;

  // Keyword overlap for full content (title + context)
  const text1 = `${item1.decision} ${item1.context}`;
  const text2 = `${item2.decision} ${item2.context}`;
  const keywordSimilarity = keywordOverlap(text1, text2);

  // Weighted average: 60% title, 40% keywords
  const totalScore = Math.round(
    titleSimilarity * 0.6 + keywordSimilarity * 0.4
  );

  return totalScore;
}

export interface SimilarItem {
  item: DeferredItem;
  similarity: number;
}

/**
 * Finds similar items from a list of existing items
 * @param newItem - Item to compare against
 * @param existingItems - List of existing items
 * @param threshold - Minimum similarity percentage to consider (default 80)
 * @returns Array of similar items sorted by similarity (highest first)
 */
export function findSimilarItems(
  newItem: DeferredItem,
  existingItems: DeferredItem[],
  threshold: number = 80
): SimilarItem[] {
  const similar: SimilarItem[] = [];

  // Only check pending and in-progress items (skip done/archived)
  const activeItems = existingItems.filter(
    (item) => item.status === 'pending' || item.status === 'in-progress'
  );

  for (const existingItem of activeItems) {
    const similarity = calculateSimilarity(newItem, existingItem);

    if (similarity >= threshold) {
      similar.push({ item: existingItem, similarity });
    }
  }

  // Sort by similarity (highest first)
  similar.sort((a, b) => b.similarity - a.similarity);

  return similar;
}
