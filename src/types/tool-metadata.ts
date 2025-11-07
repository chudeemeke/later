/**
 * Tool Metadata for Progressive Disclosure
 * Enables efficient tool discovery and on-demand loading
 */

import type { Storage } from '../storage/interface.js';

export interface ToolMetadata {
  name: string;
  category: 'core' | 'workflow' | 'batch' | 'search' | 'meta';
  keywords: string[];
  priority: number;
  description: string;
  inputSchema: any;
  hidden?: boolean;
  handler: (args: any, storage: Storage) => Promise<any>;
}

export interface ToolSearchResult {
  name: string;
  category: string;
  description: string;
  score: number;
  inputSchema?: any;
}
