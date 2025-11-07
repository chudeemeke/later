/**
 * Configuration Management for CLI
 *
 * Stores user preferences in ~/.later/cli-config.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * CLI Configuration Interface
 */
export interface CliConfig {
  // Output preferences
  defaultOutputFormat?: 'text' | 'json';
  colorEnabled?: boolean;

  // Display preferences
  defaultListLimit?: number;
  tableStyle?: 'compact' | 'full';

  // MCP server preferences
  mcpServerPath?: string;
  mcpTimeout?: number;

  // Version tracking
  configVersion?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CliConfig = {
  defaultOutputFormat: 'text',
  colorEnabled: true,
  defaultListLimit: 20,
  tableStyle: 'full',
  mcpTimeout: 30000, // 30 seconds
  configVersion: '1.0.0',
};

/**
 * Configuration Manager
 */
export class ConfigManager {
  private static configPath: string = path.join(
    os.homedir(),
    '.later',
    'cli-config.json'
  );

  private static config: CliConfig | null = null;

  /**
   * Get configuration directory
   */
  static getConfigDir(): string {
    return path.dirname(this.configPath);
  }

  /**
   * Get configuration file path
   */
  static getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Load configuration from disk
   */
  static load(): CliConfig {
    if (this.config !== null) {
      return this.config;
    }

    let loadedConfig: CliConfig;

    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(data);

        // Merge with defaults (in case new fields were added)
        loadedConfig = { ...DEFAULT_CONFIG, ...loaded };
      } else {
        // No config file, use defaults
        loadedConfig = { ...DEFAULT_CONFIG };
      }
    } catch (error) {
      // Config file corrupted or unreadable, use defaults
      console.error(`Warning: Could not load config file, using defaults`);
      loadedConfig = { ...DEFAULT_CONFIG };
    }

    this.config = loadedConfig;
    return loadedConfig;
  }

  /**
   * Save configuration to disk
   */
  static save(config: CliConfig): void {
    try {
      // Ensure config directory exists
      const dir = this.getConfigDir();
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write config
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      // Cache the config
      this.config = { ...config };
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a configuration value
   */
  static get<K extends keyof CliConfig>(key: K): CliConfig[K] {
    const config = this.load();
    return config[key];
  }

  /**
   * Set a configuration value
   */
  static set<K extends keyof CliConfig>(key: K, value: CliConfig[K]): void {
    const config = this.load();
    config[key] = value;
    this.save(config);
  }

  /**
   * Reset configuration to defaults
   */
  static reset(): void {
    this.save({ ...DEFAULT_CONFIG });
  }

  /**
   * Check if config file exists
   */
  static exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Get the full current configuration
   */
  static getAll(): CliConfig {
    return this.load();
  }

  /**
   * Update multiple configuration values
   */
  static update(updates: Partial<CliConfig>): void {
    const config = this.load();
    Object.assign(config, updates);
    this.save(config);
  }

  /**
   * Validate configuration
   */
  static validate(config: CliConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate defaultOutputFormat
    if (
      config.defaultOutputFormat &&
      !['text', 'json'].includes(config.defaultOutputFormat)
    ) {
      errors.push(
        `Invalid defaultOutputFormat: ${config.defaultOutputFormat} (must be 'text' or 'json')`
      );
    }

    // Validate colorEnabled
    if (
      config.colorEnabled !== undefined &&
      typeof config.colorEnabled !== 'boolean'
    ) {
      errors.push(`Invalid colorEnabled: must be boolean`);
    }

    // Validate defaultListLimit
    if (
      config.defaultListLimit !== undefined &&
      (typeof config.defaultListLimit !== 'number' || config.defaultListLimit < 1)
    ) {
      errors.push(`Invalid defaultListLimit: must be a positive number`);
    }

    // Validate tableStyle
    if (
      config.tableStyle &&
      !['compact', 'full'].includes(config.tableStyle)
    ) {
      errors.push(
        `Invalid tableStyle: ${config.tableStyle} (must be 'compact' or 'full')`
      );
    }

    // Validate mcpTimeout
    if (
      config.mcpTimeout !== undefined &&
      (typeof config.mcpTimeout !== 'number' || config.mcpTimeout < 1000)
    ) {
      errors.push(`Invalid mcpTimeout: must be >= 1000ms`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export configuration as JSON string
   */
  static export(): string {
    const config = this.load();
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from JSON string
   */
  static import(jsonString: string): void {
    try {
      const config = JSON.parse(jsonString);
      const validation = this.validate(config);

      if (!validation.valid) {
        throw new Error(
          `Invalid configuration:\n${validation.errors.join('\n')}`
        );
      }

      this.save(config);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON: ${error.message}`);
      }
      throw error;
    }
  }
}
