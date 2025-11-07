import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfigManager, CliConfig } from '../../src/cli/config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigManager', () => {
  const testConfigPath = path.join(os.homedir(), '.later', 'cli-config.json');
  let backupExists = false;
  let backupConfig: string | null = null;

  beforeEach(() => {
    // Backup existing config if it exists
    if (fs.existsSync(testConfigPath)) {
      backupExists = true;
      backupConfig = fs.readFileSync(testConfigPath, 'utf-8');
    }

    // Reset ConfigManager's internal state by clearing the config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }

    // Force ConfigManager to reload
    (ConfigManager as any).config = null;
  });

  afterEach(() => {
    // Restore backup if it existed
    if (backupExists && backupConfig) {
      const dir = path.dirname(testConfigPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(testConfigPath, backupConfig, 'utf-8');
    } else if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }

    // Reset internal state
    (ConfigManager as any).config = null;
  });

  describe('load', () => {
    it('should load default config when file does not exist', () => {
      const config = ConfigManager.load();

      expect(config.defaultOutputFormat).toBe('text');
      expect(config.colorEnabled).toBe(true);
      expect(config.defaultListLimit).toBe(20);
      expect(config.tableStyle).toBe('full');
      expect(config.mcpTimeout).toBe(30000);
      expect(config.configVersion).toBe('1.0.0');
    });

    it('should load config from file when it exists', () => {
      const testConfig: CliConfig = {
        defaultOutputFormat: 'json',
        colorEnabled: false,
        defaultListLimit: 50,
      };

      ConfigManager.save(testConfig);
      (ConfigManager as any).config = null; // Force reload

      const loaded = ConfigManager.load();

      expect(loaded.defaultOutputFormat).toBe('json');
      expect(loaded.colorEnabled).toBe(false);
      expect(loaded.defaultListLimit).toBe(50);
    });

    it('should merge with defaults when loading partial config', () => {
      const partialConfig = {
        defaultOutputFormat: 'json' as const,
      };

      fs.mkdirSync(path.dirname(testConfigPath), { recursive: true });
      fs.writeFileSync(testConfigPath, JSON.stringify(partialConfig), 'utf-8');
      (ConfigManager as any).config = null; // Force reload

      const loaded = ConfigManager.load();

      expect(loaded.defaultOutputFormat).toBe('json');
      expect(loaded.colorEnabled).toBe(true); // Should use default
      expect(loaded.defaultListLimit).toBe(20); // Should use default
    });

    it('should handle corrupted config file gracefully', () => {
      fs.mkdirSync(path.dirname(testConfigPath), { recursive: true });
      fs.writeFileSync(testConfigPath, 'invalid json{', 'utf-8');
      (ConfigManager as any).config = null; // Force reload

      const config = ConfigManager.load();

      // Should fall back to defaults
      expect(config.defaultOutputFormat).toBe('text');
      expect(config.colorEnabled).toBe(true);
    });

    it('should cache loaded config', () => {
      const config1 = ConfigManager.load();
      const config2 = ConfigManager.load();

      expect(config1).toBe(config2); // Same object reference
    });
  });

  describe('save', () => {
    it('should save config to file', () => {
      const config: CliConfig = {
        defaultOutputFormat: 'json',
        colorEnabled: false,
        defaultListLimit: 100,
      };

      ConfigManager.save(config);

      expect(fs.existsSync(testConfigPath)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(testConfigPath, 'utf-8'));
      expect(saved.defaultOutputFormat).toBe('json');
      expect(saved.colorEnabled).toBe(false);
      expect(saved.defaultListLimit).toBe(100);
    });

    it('should create directory if it does not exist', () => {
      const dir = path.dirname(testConfigPath);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
      }

      const config: CliConfig = {
        defaultOutputFormat: 'text',
      };

      ConfigManager.save(config);

      expect(fs.existsSync(testConfigPath)).toBe(true);
    });
  });

  describe('get', () => {
    it('should get config value', () => {
      const config: CliConfig = {
        defaultOutputFormat: 'json',
        colorEnabled: false,
      };

      ConfigManager.save(config);
      (ConfigManager as any).config = null; // Force reload

      expect(ConfigManager.get('defaultOutputFormat')).toBe('json');
      expect(ConfigManager.get('colorEnabled')).toBe(false);
    });

    it('should get default value for missing keys', () => {
      const config: CliConfig = {
        defaultOutputFormat: 'json',
      };

      ConfigManager.save(config);
      (ConfigManager as any).config = null; // Force reload

      expect(ConfigManager.get('colorEnabled')).toBe(true);
      expect(ConfigManager.get('defaultListLimit')).toBe(20);
    });
  });

  describe('set', () => {
    it('should set config value', () => {
      ConfigManager.set('defaultOutputFormat', 'json');
      expect(ConfigManager.get('defaultOutputFormat')).toBe('json');
    });

    it('should persist changes', () => {
      ConfigManager.set('colorEnabled', false);
      (ConfigManager as any).config = null; // Force reload

      const loaded = ConfigManager.load();
      expect(loaded.colorEnabled).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to default config', () => {
      ConfigManager.set('defaultOutputFormat', 'json');
      ConfigManager.set('colorEnabled', false);

      ConfigManager.reset();

      const config = ConfigManager.load();
      expect(config.defaultOutputFormat).toBe('text');
      expect(config.colorEnabled).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return false when config file does not exist', () => {
      expect(ConfigManager.exists()).toBe(false);
    });

    it('should return true when config file exists', () => {
      ConfigManager.save({ defaultOutputFormat: 'text' });
      expect(ConfigManager.exists()).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return full config', () => {
      const config: CliConfig = {
        defaultOutputFormat: 'json',
        colorEnabled: false,
        defaultListLimit: 50,
      };

      ConfigManager.save(config);
      (ConfigManager as any).config = null; // Force reload

      const all = ConfigManager.getAll();
      expect(all.defaultOutputFormat).toBe('json');
      expect(all.colorEnabled).toBe(false);
      expect(all.defaultListLimit).toBe(50);
    });
  });

  describe('update', () => {
    it('should update multiple values', () => {
      ConfigManager.update({
        defaultOutputFormat: 'json',
        colorEnabled: false,
      });

      expect(ConfigManager.get('defaultOutputFormat')).toBe('json');
      expect(ConfigManager.get('colorEnabled')).toBe(false);
    });

    it('should preserve unmodified values', () => {
      ConfigManager.set('defaultListLimit', 100);
      ConfigManager.update({ defaultOutputFormat: 'json' });

      expect(ConfigManager.get('defaultOutputFormat')).toBe('json');
      expect(ConfigManager.get('defaultListLimit')).toBe(100);
    });
  });

  describe('validate', () => {
    it('should validate correct config', () => {
      const config: CliConfig = {
        defaultOutputFormat: 'text',
        colorEnabled: true,
        defaultListLimit: 20,
        tableStyle: 'full',
        mcpTimeout: 30000,
      };

      const result = ConfigManager.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid defaultOutputFormat', () => {
      const config: CliConfig = {
        defaultOutputFormat: 'invalid' as any,
      };

      const result = ConfigManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('defaultOutputFormat');
    });

    it('should reject invalid colorEnabled', () => {
      const config: CliConfig = {
        colorEnabled: 'yes' as any,
      };

      const result = ConfigManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('colorEnabled');
    });

    it('should reject invalid defaultListLimit', () => {
      const config: CliConfig = {
        defaultListLimit: -5,
      };

      const result = ConfigManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('defaultListLimit');
    });

    it('should reject invalid tableStyle', () => {
      const config: CliConfig = {
        tableStyle: 'invalid' as any,
      };

      const result = ConfigManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('tableStyle');
    });

    it('should reject invalid mcpTimeout', () => {
      const config: CliConfig = {
        mcpTimeout: 500, // Too low
      };

      const result = ConfigManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('mcpTimeout');
    });

    it('should report multiple errors', () => {
      const config: CliConfig = {
        defaultOutputFormat: 'invalid' as any,
        colorEnabled: 'yes' as any,
        defaultListLimit: -5,
      };

      const result = ConfigManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('export/import', () => {
    it('should export config as JSON', () => {
      ConfigManager.update({
        defaultOutputFormat: 'json',
        colorEnabled: false,
      });

      const exported = ConfigManager.export();
      const parsed = JSON.parse(exported);

      expect(parsed.defaultOutputFormat).toBe('json');
      expect(parsed.colorEnabled).toBe(false);
    });

    it('should import config from JSON', () => {
      const config = {
        defaultOutputFormat: 'json' as const,
        colorEnabled: false,
        defaultListLimit: 100,
      };

      ConfigManager.import(JSON.stringify(config));

      expect(ConfigManager.get('defaultOutputFormat')).toBe('json');
      expect(ConfigManager.get('colorEnabled')).toBe(false);
      expect(ConfigManager.get('defaultListLimit')).toBe(100);
    });

    it('should reject invalid JSON on import', () => {
      expect(() => {
        ConfigManager.import('invalid json{');
      }).toThrow('Invalid JSON');
    });

    it('should reject invalid config on import', () => {
      const invalid = {
        defaultOutputFormat: 'invalid',
      };

      expect(() => {
        ConfigManager.import(JSON.stringify(invalid));
      }).toThrow('Invalid configuration');
    });
  });

  describe('getConfigPath', () => {
    it('should return config file path', () => {
      const path = ConfigManager.getConfigPath();
      expect(path).toContain('.later');
      expect(path).toContain('cli-config.json');
    });
  });

  describe('getConfigDir', () => {
    it('should return config directory', () => {
      const dir = ConfigManager.getConfigDir();
      expect(dir).toContain('.later');
    });
  });
});
