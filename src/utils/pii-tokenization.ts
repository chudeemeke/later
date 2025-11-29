/**
 * PII Tokenization & Detection
 * Automatically detects and tokenizes personally identifiable information
 * to prevent sensitive data exposure in model context
 */

export interface TokenizedData {
  text: string;
  tokens: Record<string, string>;
  detectedTypes: Record<string, number>;
}

export interface TokenizationOptions {
  sensitive?: boolean;
  preserveUrls?: boolean;
}

const PII_PATTERNS: Record<string, RegExp> = {
  apiKey:
    /\b(sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36}|api[_-]?key[:\s=]+[^\s]{20,})\b/gi,
  password: /\b(password|passwd|pwd|secret)[:\s=]+[^\s]{6,}\b/gi,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  phoneNumber: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  money: /\$\d{1,3}(,\d{3})*(\.\d{2})?/g,
  dbConnection: /\b(host|server|hostname|database|db)[:\s=]+[^\s]+\b/gi,
  credentials: /\b(user|username|login)[:\s=]+[^\s]+\b/gi,
  url: /\b(https?:\/\/[^\s]+)\b/g,
};

/**
 * Tokenize text by replacing PII with secure tokens
 */
export function tokenize(
  text: string,
  options: TokenizationOptions = {},
): TokenizedData {
  if (!text) {
    return { text: "", tokens: {}, detectedTypes: {} };
  }

  let tokenized = text;
  const tokens: Record<string, string> = {};
  const detectedTypes: Record<string, number> = {};
  let tokenCounter = 1;

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    // Skip URLs if preserveUrls is true
    if (options.preserveUrls && type === "url") continue;

    tokenized = tokenized.replace(pattern, (match) => {
      const tokenId = `PII_TOKEN_${tokenCounter++}`;
      tokens[tokenId] = match;
      detectedTypes[type] = (detectedTypes[type] || 0) + 1;
      return `[${tokenId}]`;
    });
  }

  return { text: tokenized, tokens, detectedTypes };
}

/**
 * Detokenize text by replacing tokens with original values
 */
export function detokenize(tokenized: TokenizedData): string {
  if (!tokenized || !tokenized.text) {
    return "";
  }

  let text = tokenized.text;

  if (tokenized.tokens) {
    for (const [tokenId, value] of Object.entries(tokenized.tokens)) {
      text = text.replace(`[${tokenId}]`, value);
    }
  }

  return text;
}

/**
 * Sanitize text for safe model consumption
 * More aggressive detection for sensitive contexts
 */
export function sanitizeForModel(text: string): TokenizedData {
  return tokenize(text, { sensitive: true });
}

/**
 * Check if text contains PII without tokenizing
 */
export function hasPII(text: string): boolean {
  if (!text) return false;

  for (const pattern of Object.values(PII_PATTERNS)) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Get summary of detected PII types
 */
export function getPIISummary(detectedTypes: Record<string, number>): string {
  if (!detectedTypes || Object.keys(detectedTypes).length === 0) {
    return "No PII detected";
  }

  const summary = Object.entries(detectedTypes)
    .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
    .join(", ");

  return `Detected: ${summary}`;
}
