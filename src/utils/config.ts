import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import type { Config } from '../types.js';

const DEFAULT_VERSION = '1.0.0';
const CONFIG_FILENAME = 'config.json';

/**
 * Gets the default configuration
 * @param dataDir - Data directory path (defaults to ~/.later)
 * @returns Default configuration object
 */
export function getDefaultConfig(dataDir?: string): Config {
  return {
    version: DEFAULT_VERSION,
    backend: 'mcp-server',
    storage: 'jsonl',
    data_dir: dataDir || path.join(homedir(), '.later'),
    installed_at: new Date().toISOString(),
  };
}

/**
 * Validates and sanitizes a config object
 * @param config - Config to validate
 * @returns Validated config with defaults for invalid values
 */
function validateConfig(config: any): Config {
  const defaults = getDefaultConfig(config.data_dir);

  // Validate backend
  const validBackends = ['slash-command', 'mcp-server'];
  if (!validBackends.includes(config.backend)) {
    config.backend = defaults.backend;
  }

  // Validate storage
  const validStorage = ['jsonl', 'sqlite'];
  if (!validStorage.includes(config.storage)) {
    config.storage = defaults.storage;
  }

  return config as Config;
}

/**
 * Saves configuration to file
 * @param config - Configuration to save
 * @param dataDir - Data directory path (defaults to ~/.later)
 */
export async function saveConfig(
  config: Config,
  dataDir?: string
): Promise<void> {
  const dir = dataDir || path.join(homedir(), '.later');
  const configPath = path.join(dir, CONFIG_FILENAME);

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });

  // Write config file
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

/**
 * Loads configuration from file
 * If file doesn't exist or is corrupted, creates a new default config
 * @param dataDir - Data directory path (defaults to ~/.later)
 * @returns Configuration object
 */
export async function loadConfig(dataDir?: string): Promise<Config> {
  const dir = dataDir || path.join(homedir(), '.later');
  const configPath = path.join(dir, CONFIG_FILENAME);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    return validateConfig(config);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, create default config
      const defaultConfig = getDefaultConfig(dir);
      await saveConfig(defaultConfig, dir);
      return defaultConfig;
    } else if (error instanceof SyntaxError) {
      // Corrupted JSON, create new config
      console.warn('Config file corrupted, creating new config');
      const defaultConfig = getDefaultConfig(dir);
      await saveConfig(defaultConfig, dir);
      return defaultConfig;
    } else {
      throw error;
    }
  }
}

/**
 * Updates specific fields in the configuration
 * @param updates - Partial config with fields to update
 * @param dataDir - Data directory path (defaults to ~/.later)
 * @returns Updated configuration
 */
export async function updateConfig(
  updates: Partial<Config>,
  dataDir?: string
): Promise<Config> {
  const currentConfig = await loadConfig(dataDir);

  const updatedConfig: Config = {
    ...currentConfig,
    ...updates,
  };

  await saveConfig(updatedConfig, dataDir);
  return updatedConfig;
}

/**
 * Checks if config exists
 * @param dataDir - Data directory path (defaults to ~/.later)
 * @returns True if config file exists
 */
export async function configExists(dataDir?: string): Promise<boolean> {
  const dir = dataDir || path.join(homedir(), '.later');
  const configPath = path.join(dir, CONFIG_FILENAME);

  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the current version from config
 * @param dataDir - Data directory path (defaults to ~/.later)
 * @returns Version string
 */
export async function getVersion(dataDir?: string): Promise<string> {
  const config = await loadConfig(dataDir);
  return config.version;
}

/**
 * Checks if a migration is needed based on config
 * @param dataDir - Data directory path (defaults to ~/.later)
 * @returns True if migration needed (version mismatch or backend change)
 */
export async function needsMigration(dataDir?: string): Promise<boolean> {
  const config = await loadConfig(dataDir);

  // Check if using old slash-command backend
  if (config.backend === 'slash-command') {
    return true;
  }

  // Check if version is outdated (in future, when we have version 2.0)
  // For now, always return false for version check
  return false;
}
