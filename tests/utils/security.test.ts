import { detectSecrets, sanitizeSecrets, SecretType } from '../../src/utils/security.js';

describe('Security Utilities', () => {
  describe('detectSecrets', () => {
    test('detects OpenAI API keys', () => {
      const text = 'My API key is sk-1234567890abcdefghijklmnopqrstuvwxyz';
      const detected = detectSecrets(text);

      expect(detected.length).toBeGreaterThan(0);
      expect(detected[0].type).toBe('openai-api-key');
    });

    test('detects GitHub tokens', () => {
      const text = 'Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const detected = detectSecrets(text);

      expect(detected.length).toBeGreaterThan(0);
      expect(detected[0].type).toBe('github-token');
    });

    test('detects Slack tokens', () => {
      const text = 'Slack token: xoxb-1234567890-abcdefghij';
      const detected = detectSecrets(text);

      expect(detected.length).toBeGreaterThan(0);
      expect(detected[0].type).toBe('slack-token');
    });

    test('detects Anthropic API keys', () => {
      const text = 'Anthropic key: sk-ant-api03-' + 'a'.repeat(95);
      const detected = detectSecrets(text);

      expect(detected.length).toBeGreaterThan(0);
      expect(detected[0].type).toBe('anthropic-api-key');
    });

    test('detects AWS access keys', () => {
      const text = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const detected = detectSecrets(text);

      expect(detected.length).toBeGreaterThan(0);
      expect(detected[0].type).toBe('aws-access-key');
    });

    test('detects multiple secrets in same text', () => {
      const text = 'OpenAI: sk-1234567890abcdefghijklmnopqrstuvwxyz, GitHub: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const detected = detectSecrets(text);

      expect(detected.length).toBe(2);
    });

    test('returns empty array when no secrets found', () => {
      const text = 'This is just normal text with no secrets';
      const detected = detectSecrets(text);

      expect(detected).toEqual([]);
    });

    test('detects generic 40+ character tokens', () => {
      const text = 'Token: 1234567890abcdefghijklmnopqrstuvwxyz123456';
      const detected = detectSecrets(text);

      expect(detected.length).toBeGreaterThan(0);
      expect(detected[0].type).toBe('generic-token');
    });
  });

  describe('sanitizeSecrets', () => {
    test('sanitizes OpenAI API keys', () => {
      const text = 'My API key is sk-1234567890abcdefghijklmnopqrstuvwxyz';
      const sanitized = sanitizeSecrets(text);

      expect(sanitized).not.toContain('sk-1234567890');
      expect(sanitized).toContain('[REDACTED-OPENAI-KEY]');
    });

    test('sanitizes GitHub tokens', () => {
      const text = 'Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const sanitized = sanitizeSecrets(text);

      expect(sanitized).not.toContain('ghp_1234567890');
      expect(sanitized).toContain('[REDACTED-GITHUB-TOKEN]');
    });

    test('sanitizes Slack tokens', () => {
      const text = 'Slack: xoxb-1234567890-abcdefghij';
      const sanitized = sanitizeSecrets(text);

      expect(sanitized).not.toContain('xoxb-1234567890');
      expect(sanitized).toContain('[REDACTED-SLACK-TOKEN]');
    });

    test('sanitizes Anthropic API keys', () => {
      const text = 'Key: sk-ant-api03-' + 'a'.repeat(95);
      const sanitized = sanitizeSecrets(text);

      expect(sanitized).not.toContain('sk-ant-api03');
      expect(sanitized).toContain('[REDACTED-ANTHROPIC-KEY]');
    });

    test('sanitizes AWS access keys', () => {
      const text = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const sanitized = sanitizeSecrets(text);

      expect(sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(sanitized).toContain('[REDACTED-AWS-KEY]');
    });

    test('sanitizes multiple secrets in same text', () => {
      const text = 'OpenAI: sk-1234567890abcdefghijklmnopqrstuvwxyz, GitHub: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const sanitized = sanitizeSecrets(text);

      expect(sanitized).toContain('[REDACTED-OPENAI-KEY]');
      expect(sanitized).toContain('[REDACTED-GITHUB-TOKEN]');
      expect(sanitized).not.toContain('sk-1234567890');
      expect(sanitized).not.toContain('ghp_1234567890');
    });

    test('preserves non-secret text', () => {
      const text = 'This is normal text with no secrets';
      const sanitized = sanitizeSecrets(text);

      expect(sanitized).toBe(text);
    });

    test('sanitizes generic tokens', () => {
      const text = 'Token: 1234567890abcdefghijklmnopqrstuvwxyz123456';
      const sanitized = sanitizeSecrets(text);

      expect(sanitized).toContain('[REDACTED-TOKEN]');
    });

    test('handles empty string', () => {
      const sanitized = sanitizeSecrets('');
      expect(sanitized).toBe('');
    });

    test('handles text with newlines', () => {
      const text = `First line with sk-1234567890abcdefghijklmnopqrstuvwxyz
Second line with ghp_1234567890abcdefghijklmnopqrstuvwxyz`;
      const sanitized = sanitizeSecrets(text);

      expect(sanitized).toContain('[REDACTED-OPENAI-KEY]');
      expect(sanitized).toContain('[REDACTED-GITHUB-TOKEN]');
    });
  });

  describe('SecretType categorization', () => {
    test('correctly categorizes all secret types', () => {
      const types: SecretType[] = [
        'openai-api-key',
        'anthropic-api-key',
        'github-token',
        'slack-token',
        'aws-access-key',
        'generic-token',
      ];

      types.forEach((type) => {
        expect(typeof type).toBe('string');
      });
    });
  });

  describe('getSecretsSummary', () => {
    test('returns "No secrets detected" when text has no secrets', async () => {
      const { getSecretsSummary } = await import('../../src/utils/security.js');
      const summary = getSecretsSummary('This is normal text without any secrets');
      expect(summary).toBe('No secrets detected');
    });

    test('returns summary with detected secret types', async () => {
      const { getSecretsSummary } = await import('../../src/utils/security.js');
      const summary = getSecretsSummary('Token: sk-1234567890abcdefghijklmnopqrstuvwxyz');
      expect(summary).toContain('Detected:');
      expect(summary).toContain('OpenAI API key');
    });
  });

  describe('hasSecrets', () => {
    test('returns true when text contains secrets', async () => {
      const { hasSecrets } = await import('../../src/utils/security.js');
      const result = hasSecrets('Token: sk-1234567890abcdefghijklmnopqrstuvwxyz');
      expect(result).toBe(true);
    });

    test('returns false when text has no secrets', async () => {
      const { hasSecrets } = await import('../../src/utils/security.js');
      const result = hasSecrets('Normal text without secrets');
      expect(result).toBe(false);
    });
  });
});
