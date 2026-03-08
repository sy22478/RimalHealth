/**
 * PHI Encryption Unit Tests
 * Tests PHI encryption/decryption functions
 * 
 * @module tests/unit/encryption
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  encryptPHI,
  decryptPHI,
  isEncrypted,
  encryptJSON,
  decryptJSON,
  generateEncryptionKey,
  validateEncryptionConfig,
} from '@/lib/encryption/phi';

describe('PHI Encryption', () => {
  // Set up test encryption key before all tests
  beforeAll(() => {
    process.env.PHI_ENCRYPTION_KEY = generateEncryptionKey();
  });

  beforeEach(() => {
    // Ensure key is set before each test
    if (!process.env.PHI_ENCRYPTION_KEY) {
      process.env.PHI_ENCRYPTION_KEY = generateEncryptionKey();
    }
  });

  describe('encryptPHI', () => {
    it('should encrypt plaintext string', () => {
      const plaintext = 'Sensitive patient data';
      const encrypted = encryptPHI(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.startsWith('enc:')).toBe(true);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'Same text';
      const encrypted1 = encryptPHI(plaintext);
      const encrypted2 = encryptPHI(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty strings', () => {
      expect(encryptPHI('')).toBe('');
    });

    it('should be idempotent for already encrypted data', () => {
      const plaintext = 'Test data';
      const encrypted1 = encryptPHI(plaintext);
      const encrypted2 = encryptPHI(encrypted1);
      
      expect(encrypted1).toBe(encrypted2);
    });

    it('should handle special characters', () => {
      const plaintext = 'Special: chars!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encryptPHI(plaintext);
      const decrypted = decryptPHI(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Unicode: ñ, é, 中, 🏥';
      const encrypted = encryptPHI(plaintext);
      const decrypted = decryptPHI(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encryptPHI(plaintext);
      const decrypted = decryptPHI(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('decryptPHI', () => {
    it('should decrypt encrypted string', () => {
      const plaintext = 'Patient Name: John Doe';
      const encrypted = encryptPHI(plaintext);
      const decrypted = decryptPHI(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should return non-encrypted strings unchanged', () => {
      const plaintext = 'Not encrypted data';
      const result = decryptPHI(plaintext);
      
      expect(result).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      expect(decryptPHI('')).toBe('');
    });

    it('should throw on tampered data', () => {
      const plaintext = 'Sensitive data';
      const encrypted = encryptPHI(plaintext);
      
      // Tamper with the ciphertext portion
      const parts = encrypted.split(':');
      parts[5] = Buffer.from('tampered').toString('base64');
      const tampered = parts.join(':');
      
      expect(() => decryptPHI(tampered)).toThrow();
    });

    it('should return non-encrypted strings unchanged', () => {
      // Strings that don't match encrypted format should be returned as-is
      expect(decryptPHI('invalid:format')).toBe('invalid:format');
    });

    it('should return strings with unsupported version unchanged (not matching encrypted format)', () => {
      // Strings with wrong version don't match isEncrypted() format
      const salt = Buffer.alloc(32).toString('base64');
      const iv = Buffer.alloc(16).toString('base64');
      const tag = Buffer.alloc(16).toString('base64');
      const ciphertext = Buffer.alloc(16).toString('base64');
      const invalidVersion = `enc:v9:${salt}:${iv}:${tag}:${ciphertext}`;
      // isEncrypted returns false for v9, so string is returned unchanged
      expect(decryptPHI(invalidVersion)).toBe(invalidVersion);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted strings', () => {
      const encrypted = encryptPHI('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plaintext strings', () => {
      expect(isEncrypted('plaintext')).toBe(false);
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
      expect(isEncrypted(123)).toBe(false);
      expect(isEncrypted({})).toBe(false);
      expect(isEncrypted([])).toBe(false);
    });

    it('should return false for strings that look encrypted but are not', () => {
      expect(isEncrypted('enc:v2:something')).toBe(false);
      expect(isEncrypted('encrypted:data')).toBe(false);
      expect(isEncrypted('enc:v1:incomplete')).toBe(false);
    });
  });

  describe('encryptJSON / decryptJSON', () => {
    it('should encrypt and decrypt JSON objects', () => {
      const data = {
        name: 'John Doe',
        ssn: '123-45-6789',
        medicalRecord: {
          condition: 'Confidential',
          medications: ['Drug A', 'Drug B'],
        },
      };
      
      const encrypted = encryptJSON(data);
      expect(typeof encrypted).toBe('string');
      expect(isEncrypted(encrypted!)).toBe(true);
      
      const decrypted = decryptJSON(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('should handle null JSON', () => {
      expect(encryptJSON(null)).toBeNull();
      expect(decryptJSON(null)).toBeNull();
    });

    it('should handle undefined JSON', () => {
      expect(encryptJSON(undefined as unknown as null)).toBeNull();
    });

    it('should handle empty objects', () => {
      const data = {};
      const encrypted = encryptJSON(data);
      const decrypted = decryptJSON(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('should handle nested objects', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              sensitive: 'data',
            },
          },
        },
      };
      
      const encrypted = encryptJSON(data);
      const decrypted = decryptJSON(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('should handle arrays', () => {
      const data = {
        items: [1, 2, 3, 'four', { five: 5 }],
      };
      
      const encrypted = encryptJSON(data);
      const decrypted = decryptJSON(encrypted);
      expect(decrypted).toEqual(data);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate 64-character hex string', () => {
      const key = generateEncryptionKey();
      
      expect(typeof key).toBe('string');
      expect(key).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/i.test(key)).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('validateEncryptionConfig', () => {
    it('should not throw with valid key', () => {
      expect(() => validateEncryptionConfig()).not.toThrow();
    });

    it('should throw without encryption key', () => {
      const originalKey = process.env.PHI_ENCRYPTION_KEY;
      delete process.env.PHI_ENCRYPTION_KEY;
      
      expect(() => validateEncryptionConfig()).toThrow('PHI_ENCRYPTION_KEY environment variable is required');
      
      process.env.PHI_ENCRYPTION_KEY = originalKey;
    });

    it('should throw with invalid key format', () => {
      const originalKey = process.env.PHI_ENCRYPTION_KEY;
      process.env.PHI_ENCRYPTION_KEY = 'too-short';
      
      expect(() => validateEncryptionConfig()).toThrow('must be a 64+ character hex string');
      
      process.env.PHI_ENCRYPTION_KEY = originalKey;
    });
  });

  describe('encryption format', () => {
    it('should use format: enc:v1:salt:iv:authTag:ciphertext', () => {
      const encrypted = encryptPHI('test');
      const parts = encrypted.split(':');
      
      expect(parts).toHaveLength(6);
      expect(parts[0]).toBe('enc');
      expect(parts[1]).toBe('v1');
    });

    it('should use base64 encoding for components', () => {
      const encrypted = encryptPHI('test');
      const parts = encrypted.split(':');
      
      // Try to decode each base64 component (salt, iv, authTag, ciphertext)
      for (let i = 2; i < parts.length; i++) {
        const decoded = Buffer.from(parts[i], 'base64');
        expect(decoded.toString('base64')).toBe(parts[i]);
      }
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'same-plaintext';
      const encrypted1 = encryptPHI(plaintext);
      const encrypted2 = encryptPHI(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      expect(decryptPHI(encrypted1)).toBe(plaintext);
      expect(decryptPHI(encrypted2)).toBe(plaintext);
    });
  });
});
