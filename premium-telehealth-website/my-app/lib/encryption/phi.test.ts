/**
 * PHI Encryption Tests
 * 
 * Tests the HIPAA-compliant encryption layer:
 * - AES-256-GCM encryption/decryption
 * - Different IV each time
 * - Integrity verification (tamper detection)
 * - JSON field encryption
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  encryptPHI, 
  decryptPHI, 
  isEncrypted, 
  encryptJSON, 
  decryptJSON,
  generateEncryptionKey,
  validateEncryptionConfig
} from './phi';

// Set up test encryption key
process.env.PHI_ENCRYPTION_KEY = generateEncryptionKey();

describe('PHI Encryption', () => {
  beforeAll(() => {
    validateEncryptionConfig();
  });

  describe('encryptPHI', () => {
    it('should encrypt a string', () => {
      const plaintext = 'patient@example.com';
      const encrypted = encryptPHI(plaintext);
      
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
      expect(encrypted.startsWith('enc:')).toBe(true);
    });

    it('should handle empty strings', () => {
      expect(encryptPHI('')).toBe('');
    });

    it('should return already encrypted strings unchanged (idempotent)', () => {
      const plaintext = 'patient@example.com';
      const encrypted1 = encryptPHI(plaintext);
      const encrypted2 = encryptPHI(encrypted1);
      
      expect(encrypted1).toBe(encrypted2);
    });

    it('should handle null and undefined', () => {
      // @ts-expect-error testing null input
      expect(encryptPHI(null)).toBeNull();
      // @ts-expect-error testing undefined input
      expect(encryptPHI(undefined)).toBeUndefined();
    });
  });

  describe('decryptPHI', () => {
    it('should decrypt an encrypted string', () => {
      const plaintext = 'patient@example.com';
      const encrypted = encryptPHI(plaintext);
      const decrypted = decryptPHI(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should return non-encrypted strings unchanged', () => {
      const plaintext = 'not-encrypted';
      const decrypted = decryptPHI(plaintext);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      expect(decryptPHI('')).toBe('');
    });

    it('should handle null and undefined', () => {
      // @ts-expect-error testing null input
      expect(decryptPHI(null)).toBeNull();
      // @ts-expect-error testing undefined input
      expect(decryptPHI(undefined)).toBeUndefined();
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

    it('should return false for strings that look like encrypted but are not', () => {
      expect(isEncrypted('enc:v2:something')).toBe(false);
      expect(isEncrypted('encrypted:data')).toBe(false);
    });
  });

  describe('encryption format', () => {
    it('should use different IV each time (different ciphertexts)', () => {
      const plaintext = 'same-plaintext';
      const encrypted1 = encryptPHI(plaintext);
      const encrypted2 = encryptPHI(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      expect(decryptPHI(encrypted1)).toBe(plaintext);
      expect(decryptPHI(encrypted2)).toBe(plaintext);
    });

    it('should have correct format: enc:v1:salt:iv:authTag:ciphertext', () => {
      const encrypted = encryptPHI('test');
      const parts = encrypted.split(':');
      
      expect(parts).toHaveLength(6);
      expect(parts[0]).toBe('enc');
      expect(parts[1]).toBe('v1');
      // parts[2-5] are base64 encoded salt, iv, authTag, ciphertext
    });

    it('should detect tampering and throw error', () => {
      const plaintext = 'sensitive-data';
      const encrypted = encryptPHI(plaintext);
      
      // Tamper with the ciphertext
      const parts = encrypted.split(':');
      parts[5] = Buffer.from('tampered').toString('base64');
      const tampered = parts.join(':');
      
      expect(() => decryptPHI(tampered)).toThrow('integrity check failed');
    });
  });

  describe('encryptJSON / decryptJSON', () => {
    it('should encrypt and decrypt JSON objects', () => {
      const data = {
        name: 'John Doe',
        ssn: '123-45-6789',
        medicalRecord: {
          condition: 'Confidential',
          medications: ['Drug A', 'Drug B']
        }
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

    it('should handle empty objects', () => {
      const data = {};
      const encrypted = encryptJSON(data);
      const decrypted = decryptJSON(encrypted);
      expect(decrypted).toEqual(data);
    });
  });

  describe('error handling', () => {
    it('should return non-encrypted strings unchanged', () => {
      // Strings without proper encrypted format should be returned as-is
      expect(decryptPHI('not-encrypted')).toBe('not-encrypted');
    });

    it('should return strings with unsupported version unchanged', () => {
      // Strings with wrong version don't match isEncrypted() format (expects v1)
      const salt = Buffer.alloc(32).toString('base64');
      const iv = Buffer.alloc(16).toString('base64');
      const tag = Buffer.alloc(16).toString('base64');
      const ciphertext = Buffer.alloc(16).toString('base64');
      const encrypted = `enc:v9:${salt}:${iv}:${tag}:${ciphertext}`;
      // isEncrypted returns false for v9, so string is returned unchanged
      expect(decryptPHI(encrypted)).toBe(encrypted);
    });
  });
});

describe('Configuration', () => {
  it('should generate a valid encryption key', () => {
    const key = generateEncryptionKey();
    expect(typeof key).toBe('string');
    expect(key).toHaveLength(64); // 32 bytes hex encoded
    expect(/^[a-f0-9]{64}$/i.test(key)).toBe(true);
  });

  it('should validate configuration', () => {
    // Should not throw with valid key
    expect(() => validateEncryptionConfig()).not.toThrow();
  });

  it('should throw without encryption key', () => {
    const originalKey = process.env.PHI_ENCRYPTION_KEY;
    delete process.env.PHI_ENCRYPTION_KEY;
    
    expect(() => validateEncryptionConfig()).toThrow('PHI_ENCRYPTION_KEY environment variable is required');
    
    process.env.PHI_ENCRYPTION_KEY = originalKey;
  });

  it('should throw with invalid encryption key format', () => {
    const originalKey = process.env.PHI_ENCRYPTION_KEY;
    process.env.PHI_ENCRYPTION_KEY = 'too-short';
    
    expect(() => validateEncryptionConfig()).toThrow('must be a 64+ character hex string');
    
    process.env.PHI_ENCRYPTION_KEY = originalKey;
  });
});

// Export for use in other tests
export { };
