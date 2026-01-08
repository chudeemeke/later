import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  updateConfig,
} from '../../src/utils/config.js';
import type { Config } from '../../src/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_DIR = path.join(homedir(), '.later-config-test');

describe('Config Management Utilities', () => {
  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('getDefaultConfig', () => {
    test('returns default config with correct values', () => {
      const config = getDefaultConfig(TEST_DIR);

      expect(config.version).toBe('1.0.0');
      expect(config.backend).toBe('mcp-server');
      expect(config.storage).toBe('jsonl');
      expect(config.data_dir).toBe(TEST_DIR);
    });

    test('includes installed_at timestamp', () => {
      const config = getDefaultConfig(TEST_DIR);

      expect(config.installed_at).toBeDefined();
      expect(typeof config.installed_at).toBe('string');

      // Should be valid ISO 8601 date
      const date = new Date(config.installed_at!);
      expect(date.toISOString()).toBe(config.installed_at);
    });

    test('does not include upgrade fields by default', () => {
      const config = getDefaultConfig(TEST_DIR);

      expect(config.upgraded_at).toBeUndefined();
      expect(config.previous_version).toBeUndefined();
    });
  });

  describe('saveConfig', () => {
    test('creates config file with correct content', async () => {
      const config: Config = {
        version: '1.0.0',
        backend: 'mcp-server',
        storage: 'jsonl',
        data_dir: TEST_DIR,
      };

      await saveConfig(config, TEST_DIR);

      const configPath = path.join(TEST_DIR, 'config.json');
      const content = await fs.readFile(configPath, 'utf-8');
      const loaded = JSON.parse(content);

      expect(loaded).toEqual(config);
    });

    test('overwrites existing config file', async () => {
      const config1: Config = {
        version: '1.0.0',
        backend: 'mcp-server',
        storage: 'jsonl',
        data_dir: TEST_DIR,
      };

      const config2: Config = {
        version: '2.0.0',
        backend: 'mcp-server',
        storage: 'sqlite',
        data_dir: TEST_DIR,
      };

      await saveConfig(config1, TEST_DIR);
      await saveConfig(config2, TEST_DIR);

      const loaded = await loadConfig(TEST_DIR);
      expect(loaded.version).toBe('2.0.0');
      expect(loaded.storage).toBe('sqlite');
    });

    test('creates directory if it does not exist', async () => {
      const newDir = path.join(TEST_DIR, 'nested', 'directory');
      const config = getDefaultConfig(newDir);

      await saveConfig(config, newDir);

      const configPath = path.join(newDir, 'config.json');
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    // Skip on Windows - Unix file permissions don't apply
    const testFn = process.platform === 'win32' ? test.skip : test;
    testFn('sets secure file permissions (600)', async () => {
      const config = getDefaultConfig(TEST_DIR);
      await saveConfig(config, TEST_DIR);

      const configPath = path.join(TEST_DIR, 'config.json');
      const stats = await fs.stat(configPath);

      // Check that only owner can read/write (600)
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });

  describe('loadConfig', () => {
    test('loads config from file', async () => {
      const config: Config = {
        version: '1.5.0',
        backend: 'mcp-server',
        storage: 'jsonl',
        data_dir: TEST_DIR,
        installed_at: new Date().toISOString(),
      };

      await saveConfig(config, TEST_DIR);

      const loaded = await loadConfig(TEST_DIR);
      expect(loaded).toEqual(config);
    });

    test('returns default config if file does not exist', async () => {
      const loaded = await loadConfig(TEST_DIR);
      const defaultConfig = getDefaultConfig(TEST_DIR);

      expect(loaded.version).toBe(defaultConfig.version);
      expect(loaded.backend).toBe(defaultConfig.backend);
      expect(loaded.storage).toBe(defaultConfig.storage);
    });

    test('creates config file if it does not exist', async () => {
      await loadConfig(TEST_DIR);

      const configPath = path.join(TEST_DIR, 'config.json');
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    test('handles corrupted config file gracefully', async () => {
      const configPath = path.join(TEST_DIR, 'config.json');
      await fs.writeFile(configPath, 'invalid json{{{');

      const loaded = await loadConfig(TEST_DIR);
      const defaultConfig = getDefaultConfig(TEST_DIR);

      expect(loaded.version).toBe(defaultConfig.version);
    });
  });

  describe('updateConfig', () => {
    test('updates specific config fields', async () => {
      const initial = getDefaultConfig(TEST_DIR);
      await saveConfig(initial, TEST_DIR);

      const updated = await updateConfig(
        { storage: 'sqlite', upgraded_at: new Date().toISOString() },
        TEST_DIR
      );

      expect(updated.storage).toBe('sqlite');
      expect(updated.upgraded_at).toBeDefined();
      expect(updated.version).toBe(initial.version);
      expect(updated.backend).toBe(initial.backend);
    });

    test('preserves existing fields when updating', async () => {
      const initial: Config = {
        version: '1.0.0',
        backend: 'mcp-server',
        storage: 'jsonl',
        data_dir: TEST_DIR,
        installed_at: '2025-01-01T00:00:00Z',
      };

      await saveConfig(initial, TEST_DIR);

      const updated = await updateConfig({ version: '2.0.0' }, TEST_DIR);

      expect(updated.version).toBe('2.0.0');
      expect(updated.installed_at).toBe('2025-01-01T00:00:00Z');
    });

    test('creates config if it does not exist', async () => {
      const updated = await updateConfig(
        { version: '1.5.0' },
        TEST_DIR
      );

      expect(updated.version).toBe('1.5.0');

      const loaded = await loadConfig(TEST_DIR);
      expect(loaded.version).toBe('1.5.0');
    });

    test('tracks version upgrade', async () => {
      const initial: Config = {
        version: '1.0.0',
        backend: 'mcp-server',
        storage: 'jsonl',
        data_dir: TEST_DIR,
      };

      await saveConfig(initial, TEST_DIR);

      const updated = await updateConfig({
        version: '2.0.0',
        previous_version: '1.0.0',
        upgraded_at: new Date().toISOString(),
      }, TEST_DIR);

      expect(updated.version).toBe('2.0.0');
      expect(updated.previous_version).toBe('1.0.0');
      expect(updated.upgraded_at).toBeDefined();
    });
  });

  describe('config validation', () => {
    test('validates backend type', async () => {
      const config: any = {
        version: '1.0.0',
        backend: 'invalid-backend',
        storage: 'jsonl',
        data_dir: TEST_DIR,
      };

      await saveConfig(config, TEST_DIR);
      const loaded = await loadConfig(TEST_DIR);

      // Should fall back to default for invalid backend
      expect(loaded.backend).toBe('mcp-server');
    });

    test('validates storage type', async () => {
      const config: any = {
        version: '1.0.0',
        backend: 'mcp-server',
        storage: 'invalid-storage',
        data_dir: TEST_DIR,
      };

      await saveConfig(config, TEST_DIR);
      const loaded = await loadConfig(TEST_DIR);

      // Should fall back to default for invalid storage
      expect(loaded.storage).toBe('jsonl');
    });
  });

  describe('additional utilities', () => {
    test('configExists returns false when no config', async () => {
      const { configExists } = await import('../../src/utils/config.js');
      const exists = await configExists(TEST_DIR);
      expect(exists).toBe(false);
    });

    test('configExists returns true after creating config', async () => {
      const { configExists, saveConfig, getDefaultConfig } = await import('../../src/utils/config.js');
      await saveConfig(getDefaultConfig(TEST_DIR), TEST_DIR);
      const exists = await configExists(TEST_DIR);
      expect(exists).toBe(true);
    });

    test('getVersion returns version from config', async () => {
      const { getVersion, saveConfig } = await import('../../src/utils/config.js');
      await saveConfig({
        version: '2.5.0',
        backend: 'mcp-server',
        storage: 'jsonl',
        data_dir: TEST_DIR,
      }, TEST_DIR);

      const version = await getVersion(TEST_DIR);
      expect(version).toBe('2.5.0');
    });

    test('needsMigration returns true for slash-command backend', async () => {
      const { needsMigration, saveConfig } = await import('../../src/utils/config.js');
      await saveConfig({
        version: '1.0.0',
        backend: 'slash-command',
        storage: 'jsonl',
        data_dir: TEST_DIR,
      }, TEST_DIR);

      const needs = await needsMigration(TEST_DIR);
      expect(needs).toBe(true);
    });

    test('needsMigration returns false for mcp-server backend', async () => {
      const { needsMigration, saveConfig } = await import('../../src/utils/config.js');
      await saveConfig({
        version: '1.0.0',
        backend: 'mcp-server',
        storage: 'jsonl',
        data_dir: TEST_DIR,
      }, TEST_DIR);

      const needs = await needsMigration(TEST_DIR);
      expect(needs).toBe(false);
    });
  });
});
