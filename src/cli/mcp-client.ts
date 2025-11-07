import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';
import * as os from 'os';

/**
 * MCP Client for communicating with the MCP server via stdio
 *
 * This client uses the official MCP SDK to communicate with the server.
 * It spawns the server as a subprocess and uses the stdio transport.
 *
 * Design: Short-lived client - spawns server, makes one request, terminates.
 * This mirrors Git's command isolation model and avoids state management complexity.
 */
export class McpClient {
  private serverPath: string;
  private dataDir: string;
  private timeout: number;
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private closed: boolean = false;

  /**
   * Create a new MCP client
   * @param serverPath - Path to MCP server entry point (defaults to dist/index.js)
   * @param dataDir - Data directory for storage (defaults to ~/.later)
   * @param timeout - Request timeout in milliseconds (default: 5000)
   */
  constructor(serverPath?: string, dataDir?: string, timeout: number = 5000) {
    // Default to compiled MCP server in project root
    this.serverPath = serverPath || path.join(process.cwd(), 'dist', 'index.js');
    this.dataDir = dataDir || path.join(os.homedir(), '.later');
    this.timeout = timeout;
  }

  /**
   * Call an MCP tool
   * @param toolName - Name of the MCP tool (e.g., 'later_capture')
   * @param args - Tool arguments
   * @returns Tool result
   * @throws Error if server fails, timeout occurs, or tool returns error
   */
  async callTool(toolName: string, args: any): Promise<any> {
    if (this.closed) {
      throw new Error('MCP client has been closed');
    }

    try {
      // Create transport
      this.transport = new StdioClientTransport({
        command: 'node',
        args: [this.serverPath],
        env: {
          ...process.env,
          HOME: path.dirname(this.dataDir), // Set HOME so MCP server uses correct data dir
        },
      });

      // Create client
      this.client = new Client(
        {
          name: 'later-cli',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Set timeout for the operation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`MCP operation timeout after ${this.timeout}ms`));
        }, this.timeout);
      });

      // Connect and call tool
      const resultPromise = (async () => {
        // Connect to server
        await this.client!.connect(this.transport!);

        // Call the tool with __raw flag to get JSON response
        const result = await this.client!.callTool({
          name: toolName,
          arguments: { ...args, __raw: true },
        });

        // Check if result itself indicates error (check BEFORE parsing)
        if ((result as any).isError) {
          const content = (result as any).content;
          throw new Error(content?.[0]?.text || 'Tool execution failed');
        }

        // Parse result
        // MCP returns result with content array containing text responses
        if (result.content && Array.isArray(result.content)) {
          const textContent = result.content.find((c: any) => c.type === 'text');
          if (textContent && textContent.text) {
            // Try to parse JSON from text content
            try {
              const parsed = JSON.parse(textContent.text);

              // Check if the parsed result indicates an error
              if (parsed.success === false && parsed.error) {
                throw new Error(parsed.error);
              }

              return parsed;
            } catch (err) {
              // If JSON parse fails or error was thrown, handle appropriately
              if (err instanceof SyntaxError) {
                // Not JSON, return as-is
                return { success: true, message: textContent.text };
              }
              // Re-throw actual errors
              throw err;
            }
          }
        }

        return result;
      })();

      // Race between timeout and actual call
      return await Promise.race([resultPromise, timeoutPromise]);
    } finally {
      // Always cleanup
      await this.close();
    }
  }

  /**
   * Close the client and clean up resources
   */
  async close(): Promise<void> {
    this.closed = true;
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.client = null;
  }
}
