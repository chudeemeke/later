export type SecretType =
  | 'openai-api-key'
  | 'anthropic-api-key'
  | 'github-token'
  | 'slack-token'
  | 'aws-access-key'
  | 'generic-token';

export interface DetectedSecret {
  type: SecretType;
  value: string;
  start: number;
  end: number;
}

interface SecretPattern {
  type: SecretType;
  regex: RegExp;
  replacement: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    type: 'anthropic-api-key',
    regex: /sk-ant-api\d+-[a-zA-Z0-9-_]{95,}/g,
    replacement: '[REDACTED-ANTHROPIC-KEY]',
  },
  {
    type: 'openai-api-key',
    regex: /sk-[a-zA-Z0-9]{32,}/g,
    replacement: '[REDACTED-OPENAI-KEY]',
  },
  {
    type: 'github-token',
    regex: /ghp_[a-zA-Z0-9]{36}/g,
    replacement: '[REDACTED-GITHUB-TOKEN]',
  },
  {
    type: 'slack-token',
    regex: /xox[baprs]-[a-zA-Z0-9-]{10,}/g,
    replacement: '[REDACTED-SLACK-TOKEN]',
  },
  {
    type: 'aws-access-key',
    regex: /AKIA[0-9A-Z]{16}/g,
    replacement: '[REDACTED-AWS-KEY]',
  },
  {
    type: 'generic-token',
    regex: /[a-zA-Z0-9]{40,}/g,
    replacement: '[REDACTED-TOKEN]',
  },
];

/**
 * Detects secrets in text using pattern matching
 * @param text - Text to scan for secrets
 * @returns Array of detected secrets with metadata
 */
export function detectSecrets(text: string): DetectedSecret[] {
  const detected: DetectedSecret[] = [];

  for (const pattern of SECRET_PATTERNS) {
    const matches = text.matchAll(pattern.regex);

    for (const match of matches) {
      if (match.index !== undefined) {
        // Skip generic tokens that are part of other detected secrets
        if (pattern.type === 'generic-token') {
          const overlaps = detected.some(
            (d) =>
              match.index! >= d.start &&
              match.index! < d.end
          );
          if (overlaps) continue;
        }

        detected.push({
          type: pattern.type,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  return detected.sort((a, b) => a.start - b.start);
}

/**
 * Sanitizes secrets in text by replacing them with redaction placeholders
 * @param text - Text containing potential secrets
 * @returns Sanitized text with secrets replaced
 */
export function sanitizeSecrets(text: string): string {
  if (!text) return text;

  let sanitized = text;

  // Process patterns in order (most specific first)
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern.regex, pattern.replacement);
  }

  return sanitized;
}

/**
 * Checks if text contains any secrets
 * @param text - Text to check
 * @returns True if secrets detected, false otherwise
 */
export function hasSecrets(text: string): boolean {
  return detectSecrets(text).length > 0;
}

/**
 * Gets a summary of detected secrets for user display
 * @param text - Text to scan
 * @returns Human-readable summary of detected secret types
 */
export function getSecretsSummary(text: string): string {
  const detected = detectSecrets(text);

  if (detected.length === 0) {
    return 'No secrets detected';
  }

  const types = new Set(detected.map((d) => d.type));
  const typeLabels: Record<SecretType, string> = {
    'openai-api-key': 'OpenAI API key',
    'anthropic-api-key': 'Anthropic API key',
    'github-token': 'GitHub token',
    'slack-token': 'Slack token',
    'aws-access-key': 'AWS access key',
    'generic-token': 'Generic token',
  };

  const labels = Array.from(types).map((type) => typeLabels[type]);

  return `Detected: ${labels.join(', ')} (${detected.length} total)`;
}
