/**
 * Meta Tools - Tool discovery and system operations
 */

import { toolRegistry } from '../../registry.js';
import { handleSearchTools, searchToolsSchema } from './search-tools.js';

// Register search_tools meta-tool
toolRegistry.register({
  name: 'search_tools',
  category: 'meta',
  keywords: ['search', 'find', 'discover', 'tools', 'help', 'what', 'how'],
  priority: 15, // Highest priority for meta operations
  description: 'Discover available tools based on what you want to do. This enables progressive disclosure - only loading tools you need. Example: "search_tools: create a new decision" returns later_capture.',
  inputSchema: searchToolsSchema,
  handler: handleSearchTools
});

export { handleSearchTools };
