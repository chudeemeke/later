/**
 * PII Tokenization Tests
 * Comprehensive testing of PII detection, tokenization, and detokenization
 */

import { describe, it, expect } from '@jest/globals';
import {
  tokenize,
  detokenize,
  sanitizeForModel,
  hasPII,
  getPIISummary,
} from '../../src/utils/pii-tokenization.js';

describe('PII Tokenization', () => {
  describe('API Key Detection', () => {
    it('should detect OpenAI API keys', () => {
      const text = 'My API key is sk-1234567890abcdefghijklmnopqrstuv and I use it often';
      const result = tokenize(text);

      expect(result.detectedTypes.apiKey).toBe(1);
      expect(result.text).toContain('[PII_TOKEN_');
      expect(result.text).not.toContain('sk-1234567890');
      expect(Object.keys(result.tokens).length).toBeGreaterThan(0);
    });

    it('should detect GitHub personal access tokens', () => {
      const text = 'Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const result = tokenize(text);

      expect(result.detectedTypes.apiKey).toBe(1);
      expect(result.text).not.toContain('ghp_');
    });

    it('should detect generic API keys', () => {
      const text = 'api_key=abcdefghij1234567890xyz';
      const result = tokenize(text);

      expect(result.detectedTypes.apiKey).toBe(1);
    });
  });

  describe('Password Detection', () => {
    it('should detect password fields', () => {
      const text = 'My password: secretpass123';
      const result = tokenize(text);

      expect(result.detectedTypes.password).toBe(1);
      expect(result.text).not.toContain('secretpass123');
    });

    it('should detect various password formats', () => {
      const texts = [
        'password=mypass123',
        'passwd: test1234',
        'pwd=secure_password',
        'secret: topsecret999'
      ];

      texts.forEach(text => {
        const result = tokenize(text);
        expect(result.detectedTypes.password).toBe(1);
      });
    });
  });

  describe('SSN Detection', () => {
    it('should detect SSNs', () => {
      const text = 'SSN: 123-45-6789';
      const result = tokenize(text);

      expect(result.detectedTypes.ssn).toBe(1);
      expect(result.text).not.toContain('123-45-6789');
    });

    it('should detect multiple SSNs', () => {
      const text = 'SSNs: 123-45-6789, 987-65-4321';
      const result = tokenize(text);

      expect(result.detectedTypes.ssn).toBe(2);
    });
  });

  describe('Credit Card Detection', () => {
    it('should detect credit card numbers', () => {
      const text = 'Card: 1234 5678 9012 3456';
      const result = tokenize(text);

      expect(result.detectedTypes.creditCard).toBe(1);
      expect(result.text).not.toContain('1234 5678 9012 3456');
    });

    it('should detect various credit card formats', () => {
      const formats = [
        '1234567890123456',
        '1234-5678-9012-3456',
        '1234 5678 9012 3456'
      ];

      formats.forEach(card => {
        const result = tokenize(card);
        expect(result.detectedTypes.creditCard).toBe(1);
      });
    });
  });

  describe('Email Detection', () => {
    it('should detect email addresses', () => {
      const text = 'Contact me at john.doe@example.com';
      const result = tokenize(text);

      expect(result.detectedTypes.email).toBe(1);
      expect(result.text).not.toContain('john.doe@example.com');
    });

    it('should detect multiple emails', () => {
      const text = 'Emails: user1@test.com, user2@example.org';
      const result = tokenize(text);

      expect(result.detectedTypes.email).toBe(2);
    });
  });

  describe('IP Address Detection', () => {
    it('should detect IP addresses', () => {
      const text = 'Server IP: 192.168.1.100';
      const result = tokenize(text);

      expect(result.detectedTypes.ipAddress).toBe(1);
      expect(result.text).not.toContain('192.168.1.100');
    });

    it('should detect multiple IPs', () => {
      const text = 'IPs: 10.0.0.1, 172.16.0.1, 192.168.1.1';
      const result = tokenize(text);

      expect(result.detectedTypes.ipAddress).toBe(3);
    });
  });

  describe('Phone Number Detection', () => {
    it('should detect phone numbers', () => {
      const text = 'Call 555-123-4567';
      const result = tokenize(text);

      expect(result.detectedTypes.phoneNumber).toBe(1);
      expect(result.text).not.toContain('555-123-4567');
    });

    it('should detect various phone formats', () => {
      const formats = [
        '555-123-4567',
        '555.123.4567',
        '5551234567'
      ];

      formats.forEach(phone => {
        const result = tokenize(phone);
        expect(result.detectedTypes.phoneNumber).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Money Detection', () => {
    it('should detect money amounts', () => {
      const text = 'Price: $1,234.56';
      const result = tokenize(text);

      expect(result.detectedTypes.money).toBe(1);
      expect(result.text).not.toContain('$1,234.56');
    });

    it('should detect various money formats', () => {
      const amounts = ['$100', '$1,000.00', '$99.99'];

      amounts.forEach(amount => {
        const result = tokenize(amount);
        expect(result.detectedTypes.money).toBe(1);
      });
    });
  });

  describe('Database Connection Detection', () => {
    it('should detect database hosts', () => {
      const text = 'host=database.example.com';
      const result = tokenize(text);

      expect(result.detectedTypes.dbConnection).toBe(1);
    });

    it('should detect various DB connection strings', () => {
      const connections = [
        'server=db.local',
        'hostname=prod-db-01',
        'database=myapp'
      ];

      connections.forEach(conn => {
        const result = tokenize(conn);
        expect(result.detectedTypes.dbConnection).toBe(1);
      });
    });
  });

  describe('Credentials Detection', () => {
    it('should detect usernames', () => {
      const text = 'user=admin';
      const result = tokenize(text);

      expect(result.detectedTypes.credentials).toBe(1);
    });

    it('should detect various credential formats', () => {
      const creds = [
        'username=johndoe',
        'login=admin123'
      ];

      creds.forEach(cred => {
        const result = tokenize(cred);
        expect(result.detectedTypes.credentials).toBe(1);
      });
    });
  });

  describe('URL Detection', () => {
    it('should detect URLs', () => {
      const text = 'Visit https://example.com';
      const result = tokenize(text);

      expect(result.detectedTypes.url).toBe(1);
      expect(result.text).not.toContain('https://example.com');
    });

    it('should preserve URLs when preserveUrls is true', () => {
      const text = 'Visit https://example.com';
      const result = tokenize(text, { preserveUrls: true });

      expect(result.detectedTypes.url).toBeUndefined();
      expect(result.text).toContain('https://example.com');
    });

    it('should detect http and https URLs', () => {
      const text = 'Sites: http://test.com and https://secure.com';
      const result = tokenize(text);

      expect(result.detectedTypes.url).toBe(2);
    });
  });

  describe('Detokenization', () => {
    it('should correctly detokenize text', () => {
      const original = 'My email is john@example.com and phone is 555-1234';
      const tokenized = tokenize(original);
      const detokenized = detokenize(tokenized);

      expect(detokenized).toBe(original);
    });

    it('should handle multiple PII types', () => {
      const original = 'Email: test@test.com, SSN: 123-45-6789, Card: 1234567890123456';
      const tokenized = tokenize(original);
      const detokenized = detokenize(tokenized);

      expect(detokenized).toBe(original);
    });

    it('should handle empty tokenized data', () => {
      const result = detokenize({ text: '', tokens: {}, detectedTypes: {} });
      expect(result).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(detokenize(null as any)).toBe('');
      expect(detokenize(undefined as any)).toBe('');
    });
  });

  describe('Round-trip Testing', () => {
    it('should preserve text through tokenization and detokenization', () => {
      const texts = [
        'Simple text with no PII',
        'Email: user@example.com',
        'SSN: 123-45-6789 and phone 555-1234',
        'API key: sk-1234567890abcdefghijklmnopqrstuv',
        'Complex: email@test.com, $100.00, 192.168.1.1'
      ];

      texts.forEach(text => {
        const tokenized = tokenize(text);
        const detokenized = detokenize(tokenized);
        expect(detokenized).toBe(text);
      });
    });
  });

  describe('hasPII', () => {
    it('should detect text with PII', () => {
      expect(hasPII('Email: test@example.com')).toBe(true);
      expect(hasPII('SSN: 123-45-6789')).toBe(true);
      expect(hasPII('sk-1234567890abcdefghijklmnopqrstuv')).toBe(true);
    });

    it('should return false for text without PII', () => {
      expect(hasPII('Just some normal text')).toBe(false);
      expect(hasPII('No sensitive data here')).toBe(false);
      expect(hasPII('')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(hasPII(null as any)).toBe(false);
      expect(hasPII(undefined as any)).toBe(false);
    });
  });

  describe('getPIISummary', () => {
    it('should generate summary for detected PII', () => {
      const summary = getPIISummary({ email: 2, ssn: 1, phone: 3 });
      expect(summary).toContain('2 emails');
      expect(summary).toContain('1 ssn');
      expect(summary).toContain('3 phones');
    });

    it('should handle single items', () => {
      const summary = getPIISummary({ email: 1 });
      expect(summary).toContain('1 email');
      expect(summary).not.toContain('emails');
    });

    it('should handle empty detection', () => {
      const summary = getPIISummary({});
      expect(summary).toBe('No PII detected');
    });

    it('should handle null/undefined', () => {
      expect(getPIISummary(null as any)).toBe('No PII detected');
      expect(getPIISummary(undefined as any)).toBe('No PII detected');
    });
  });

  describe('sanitizeForModel', () => {
    it('should use sensitive mode', () => {
      const text = 'Email: test@test.com, phone: 555-123-4567';
      const result = sanitizeForModel(text);

      expect(result.detectedTypes.email).toBe(1);
      expect(result.detectedTypes.phoneNumber).toBeGreaterThanOrEqual(1);
      expect(result.text).not.toContain('test@test.com');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const result = tokenize('');
      expect(result.text).toBe('');
      expect(Object.keys(result.tokens).length).toBe(0);
      expect(Object.keys(result.detectedTypes).length).toBe(0);
    });

    it('should handle very long text with multiple PII', () => {
      const text = 'A'.repeat(1000) + ' email@test.com ' + 'B'.repeat(1000) + ' 123-45-6789';
      const result = tokenize(text);

      expect(result.detectedTypes.email).toBe(1);
      expect(result.detectedTypes.ssn).toBe(1);
      // Verify PII was tokenized (tokens exist)
      expect(Object.keys(result.tokens).length).toBe(2);
      expect(result.text).toContain('[PII_TOKEN_');
    });

    it('should handle special characters around PII', () => {
      const text = '"email@test.com", <123-45-6789>, [555-1234]';
      const result = tokenize(text);

      expect(result.detectedTypes.email).toBe(1);
      expect(result.detectedTypes.ssn).toBe(1);
    });

    it('should handle duplicate PII', () => {
      const text = 'email@test.com and email@test.com again';
      const result = tokenize(text);

      expect(result.detectedTypes.email).toBe(2);
      expect(Object.keys(result.tokens).length).toBe(2);
    });
  });

  describe('Security Validation', () => {
    it('should not leak PII in tokenized text', () => {
      const sensitiveData = [
        'sk-1234567890abcdefghijklmnopqrstuv',
        '123-45-6789',
        'password=secret123',
        'john@example.com',
        '1234567890123456'
      ];

      sensitiveData.forEach(pii => {
        const result = tokenize(`Text with ${pii} in it`);
        expect(result.text).not.toContain(pii);
      });
    });

    it('should use unique tokens for each PII instance', () => {
      const text = 'email1@test.com and email2@test.com';
      const result = tokenize(text);

      const tokens = Object.keys(result.tokens);
      expect(tokens.length).toBe(2);
      expect(tokens[0]).not.toBe(tokens[1]);
    });
  });

  describe('Options Parameter Coverage', () => {
    it('should handle sensitive option (currently unused but defined)', () => {
      const text = 'Email: test@test.com';
      const result1 = tokenize(text, { sensitive: true });
      const result2 = tokenize(text, { sensitive: false });

      // Both should tokenize the same way since sensitive is not implemented yet
      expect(result1.detectedTypes.email).toBe(1);
      expect(result2.detectedTypes.email).toBe(1);
    });

    it('should handle empty options object', () => {
      const text = 'Email: test@test.com';
      const result = tokenize(text, {});

      expect(result.detectedTypes.email).toBe(1);
    });

    it('should handle undefined options', () => {
      const text = 'Email: test@test.com';
      const result = tokenize(text, undefined);

      expect(result.detectedTypes.email).toBe(1);
    });

    it('should handle combination of options', () => {
      const text = 'Visit https://example.com and email test@test.com';
      const result = tokenize(text, { preserveUrls: true, sensitive: true });

      expect(result.detectedTypes.url).toBeUndefined();
      expect(result.detectedTypes.email).toBe(1);
      expect(result.text).toContain('https://example.com');
      expect(result.text).not.toContain('test@test.com');
    });
  });

  describe('Boundary and Edge Cases', () => {
    it('should handle text with only PII', () => {
      const result = tokenize('test@example.com');
      expect(result.text).toBe('[PII_TOKEN_1]');
      expect(result.detectedTypes.email).toBe(1);
    });

    it('should handle text with PII at boundaries', () => {
      const result = tokenize('test@example.com and 123-45-6789');
      expect(result.detectedTypes.email).toBe(1);
      expect(result.detectedTypes.ssn).toBe(1);
    });

    it('should handle whitespace-only text', () => {
      const result = tokenize('   ');
      expect(result.text).toBe('   ');
      expect(Object.keys(result.tokens).length).toBe(0);
    });

    it('should handle newlines and tabs', () => {
      const text = 'Line1\nEmail: test@test.com\tSSN: 123-45-6789';
      const result = tokenize(text);

      expect(result.detectedTypes.email).toBe(1);
      expect(result.detectedTypes.ssn).toBe(1);
    });

    it('should handle very short text', () => {
      const result = tokenize('x');
      expect(result.text).toBe('x');
      expect(Object.keys(result.tokens).length).toBe(0);
    });
  });

  describe('Pattern Matching Edge Cases', () => {
    it('should handle malformed API keys', () => {
      const text = 'sk-123'; // Too short
      const result = tokenize(text);
      expect(result.detectedTypes.apiKey).toBeUndefined();
    });

    it('should handle passwords with exactly 6 characters', () => {
      const text = 'password:pass12';
      const result = tokenize(text);
      expect(result.detectedTypes.password).toBe(1);
    });

    it('should handle passwords shorter than 6 characters', () => {
      const text = 'password:pass';
      const result = tokenize(text);
      expect(result.detectedTypes.password).toBeUndefined();
    });

    it('should handle malformed SSNs', () => {
      const text = '12-45-6789'; // Invalid format
      const result = tokenize(text);
      expect(result.detectedTypes.ssn).toBeUndefined();
    });

    it('should handle credit cards with extra spaces', () => {
      const text = '1234  5678  9012  3456'; // Double spaces
      const result = tokenize(text);
      // Should not match due to extra spaces
      expect(result.detectedTypes.creditCard).toBeUndefined();
    });

    it('should handle edge case IP addresses', () => {
      const texts = [
        '0.0.0.0',
        '255.255.255.255',
        '192.168.1.1',
      ];

      texts.forEach(ip => {
        const result = tokenize(ip);
        expect(result.detectedTypes.ipAddress).toBe(1);
      });
    });

    it('should handle invalid IP addresses', () => {
      const texts = [
        '999.999.999.999',
        '192.168.1',
        '192.168.1.1.1',
      ];

      texts.forEach(ip => {
        const result = tokenize(ip);
        // Pattern still matches format, doesn't validate ranges
        if (ip === '192.168.1') {
          expect(result.detectedTypes.ipAddress).toBeUndefined();
        } else if (ip === '192.168.1.1.1') {
          expect(result.detectedTypes.ipAddress).toBeGreaterThanOrEqual(1);
        }
      });
    });

    it('should handle money without cents', () => {
      const result = tokenize('$100');
      expect(result.detectedTypes.money).toBe(1);
    });

    it('should handle money with zero cents', () => {
      const result = tokenize('$100.00');
      expect(result.detectedTypes.money).toBe(1);
    });

    it('should handle large money amounts', () => {
      const result = tokenize('$1,000,000.00');
      expect(result.detectedTypes.money).toBe(1);
    });
  });

  describe('Multiple PII Types', () => {
    it('should handle all PII types in one text', () => {
      const text = `
        API: sk-1234567890abcdefghijklmnopqrstuv
        Password: password123456
        SSN: 123-45-6789
        Card: 1234567890123456
        Email: test@test.com
        IP: 192.168.1.1
        Phone: 555-123-4567
        Money: $1,234.56
        DB: host=db.local
        User: user=admin
        URL: https://example.com
      `;

      const result = tokenize(text);

      expect(result.detectedTypes.apiKey).toBe(1);
      expect(result.detectedTypes.password).toBe(1);
      expect(result.detectedTypes.ssn).toBe(1);
      expect(result.detectedTypes.creditCard).toBe(1);
      expect(result.detectedTypes.email).toBe(1);
      expect(result.detectedTypes.ipAddress).toBe(1);
      expect(result.detectedTypes.phoneNumber).toBeGreaterThanOrEqual(1);
      expect(result.detectedTypes.money).toBe(1);
      expect(result.detectedTypes.dbConnection).toBe(1);
      expect(result.detectedTypes.credentials).toBe(1);
      expect(result.detectedTypes.url).toBe(1);

      expect(Object.keys(result.tokens).length).toBeGreaterThan(10);
    });

    it('should preserve order of non-PII text', () => {
      const text = 'Start test@test.com Middle 123-45-6789 End';
      const result = tokenize(text);

      expect(result.text).toMatch(/^Start.*Middle.*End$/);
    });
  });

  describe('hasPII Branch Coverage', () => {
    it('should test each pattern type individually', () => {
      const patterns = [
        { text: 'sk-1234567890abcdefghijklmnopqrstuv', hasPII: true },
        { text: 'password:secret123', hasPII: true },
        { text: '123-45-6789', hasPII: true },
        { text: '1234567890123456', hasPII: true },
        { text: 'test@test.com', hasPII: true },
        { text: '192.168.1.1', hasPII: true },
        { text: '555-123-4567', hasPII: true },
        { text: '$100.00', hasPII: true },
        { text: 'host=db.local', hasPII: true },
        { text: 'user=admin', hasPII: true },
        { text: 'https://example.com', hasPII: true },
        { text: 'no pii here', hasPII: false },
      ];

      patterns.forEach(({ text, hasPII: expected }) => {
        expect(hasPII(text)).toBe(expected);
      });
    });

    it('should return false immediately for empty string', () => {
      expect(hasPII('')).toBe(false);
    });

    it('should handle pattern that matches first', () => {
      // API key pattern is first in the list
      expect(hasPII('sk-1234567890abcdefghijklmnopqrstuv')).toBe(true);
    });

    it('should continue checking if first patterns don\'t match', () => {
      // URL is last in the pattern list
      expect(hasPII('https://example.com')).toBe(true);
    });
  });

  describe('getPIISummary Branch Coverage', () => {
    it('should handle single type with count > 1', () => {
      const summary = getPIISummary({ email: 3 });
      expect(summary).toContain('3 emails');
    });

    it('should handle multiple types with mixed counts', () => {
      const summary = getPIISummary({ email: 1, ssn: 3, phone: 2 });
      expect(summary).toContain('1 email');
      expect(summary).toContain('3 ssns');
      expect(summary).toContain('2 phones');
    });

    it('should format with commas for multiple types', () => {
      const summary = getPIISummary({ email: 1, ssn: 2 });
      expect(summary).toMatch(/Detected: \d+ \w+, \d+ \w+/);
    });
  });
});
