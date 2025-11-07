/**
 * Tool Registry for Progressive Disclosure
 * Central registry for all MCP tools with metadata
 */

import type { ToolMetadata } from './types/tool-metadata.js';

class ToolRegistry {
  private tools: Map<string, ToolMetadata> = new Map();

  register(tool: ToolMetadata): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolMetadata | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolMetadata[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: string): ToolMetadata[] {
    return this.getAll().filter(t => t.category === category);
  }

  search(query: string): ToolMetadata[] {
    const queryLower = query.toLowerCase().trim();

    // Empty query returns no results
    if (queryLower.length === 0) {
      return [];
    }

    return this.getAll()
      .filter(t => !t.hidden)
      .map(tool => ({
        tool,
        score: this.calculateRelevance(queryLower, tool)
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ tool }) => tool);
  }

  private calculateRelevance(query: string, tool: ToolMetadata): number {
    let score = 0;

    // Keyword matching
    score += tool.keywords.filter(kw =>
      query.includes(kw.toLowerCase())
    ).length * tool.priority;

    // Name matching
    if (query.includes(tool.name.toLowerCase().replace('later_', ''))) {
      score += 10;
    }

    // Description matching
    if (tool.description.toLowerCase().includes(query)) {
      score += 5;
    }

    return score;
  }

  clear(): void {
    this.tools.clear();
  }
}

export const toolRegistry = new ToolRegistry();
