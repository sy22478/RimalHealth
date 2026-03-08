/**
 * Authentication Unit Tests
 * Tests JWT and Password functions
 * 
 * @module tests/unit/auth
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { Role } from '@prisma/client';

// Import password functions
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  generateSecurePassword,
  BCRYPT_SALT_ROUNDS,
  MIN_PASSWORD_LENGTH,
} from '@/lib/auth/password';

// Import JWT functions
import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeTokenUnsafe,
  ACCESS_TOKEN_EXPIRY_SECONDS,
  REFRESH_TOKEN_EXPIRY_SECONDS,
} from '@/lib/auth/jwt';

// ============================================
// Password Tests
// ============================================

describe('Password', () => {
  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(typeof hash).toBe('string');
      // bcrypt hashes start with $2b$ (or $2a$)
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'Test123!@#';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      // Same password should produce different hashes (due to salt)
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should handle long passwords', async () => {
      const longPassword = 'A'.repeat(100);
      const hash = await hashPassword(longPassword);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'Test123!@#';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    it('should reject empty password against non-empty hash', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('', hash);
      
      expect(isValid).toBe(false);
    });

    it('should verify password with special characters', async () => {
      const password = 'P@$$w0rd!#%&*()_+-=[]{}|;:,.<>?';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const result = validatePasswordStrength('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.requirements).toHaveLength(0);
    });

    it('should reject password too short', () => {
      const result = validatePasswordStrength('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.requirements).toContain('At least 12 characters');
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.requirements).toContain('At least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = validatePasswordStrength('UPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.requirements).toContain('At least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePasswordStrength('NoNumbersHere!');
      expect(result.isValid).toBe(false);
      expect(result.requirements).toContain('At least one number');
    });

    it('should reject password without special character', () => {
      const result = validatePasswordStrength('NoSpecial123');
      expect(result.isValid).toBe(false);
      expect(result.requirements).toContain('At least one special character');
    });

    it('should report all missing requirements', () => {
      const result = validatePasswordStrength('short');
      expect(result.isValid).toBe(false);
      expect(result.requirements).toHaveLength(4); // length, uppercase, number, special
    });

    it('should use minimum password length constant', () => {
      expect(MIN_PASSWORD_LENGTH).toBe(12);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password of default length', () => {
      const password = generateSecurePassword();
      expect(password.length).toBeGreaterThanOrEqual(12);
    });

    it('should generate password of specified length', () => {
      const password = generateSecurePassword(20);
      expect(password.length).toBe(20);
    });

    it('should generate password meeting strength requirements', () => {
      const password = generateSecurePassword();
      const validation = validatePasswordStrength(password);
      expect(validation.isValid).toBe(true);
    });

    it('should generate unique passwords each time', () => {
      const password1 = generateSecurePassword();
      const password2 = generateSecurePassword();
      expect(password1).not.toBe(password2);
    });

    it('should enforce minimum length of 12', () => {
      const password = generateSecurePassword(5);
      expect(password.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('constants', () => {
    it('should export bcrypt salt rounds', () => {
      expect(BCRYPT_SALT_ROUNDS).toBe(12);
    });
  });
});

// ============================================
// JWT Tests
// ============================================

describe('JWT', () => {
  const testUser = {
    userId: 'user_123',
    email: 'test@example.com',
    role: Role.PATIENT,
    tokenVersion: 1,
  };

  beforeAll(() => {
    // Set up JWT secret for testing
    process.env.JWT_SECRET = 'test-secret-key-that-is-32-characters-long';
  });

  describe('generateAccessToken', () => {
    it('should generate access token', async () => {
      const token = await generateAccessToken(
        testUser.userId,
        testUser.email,
        testUser.role
      );
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      // JWT format: header.payload.signature
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct claims in token', async () => {
      const token = await generateAccessToken(
        testUser.userId,
        testUser.email,
        testUser.role
      );
      
      const decoded = decodeTokenUnsafe(token);
      expect(decoded).toMatchObject({
        userId: testUser.userId,
        email: testUser.email,
        role: testUser.role,
        type: 'access',
      });
    });

    it('should generate different tokens for different users', async () => {
      const token1 = await generateAccessToken('user1', 'user1@test.com', Role.PATIENT);
      const token2 = await generateAccessToken('user2', 'user2@test.com', Role.PATIENT);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token', async () => {
      const token = await generateRefreshToken(testUser.userId, testUser.tokenVersion);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct claims in token', async () => {
      const token = await generateRefreshToken(testUser.userId, testUser.tokenVersion);
      
      const decoded = decodeTokenUnsafe(token);
      expect(decoded).toMatchObject({
        userId: testUser.userId,
        type: 'refresh',
        tokenVersion: testUser.tokenVersion,
      });
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', async () => {
      const tokens = await generateTokenPair(
        testUser.userId,
        testUser.email,
        testUser.role,
        testUser.tokenVersion
      );
      
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should generate valid tokens in pair', async () => {
      const tokens = await generateTokenPair(
        testUser.userId,
        testUser.email,
        testUser.role,
        testUser.tokenVersion
      );
      
      // Verify access token
      const accessPayload = await verifyAccessToken(tokens.accessToken);
      expect(accessPayload.userId).toBe(testUser.userId);
      
      // Verify refresh token
      const refreshPayload = await verifyRefreshToken(tokens.refreshToken);
      expect(refreshPayload.userId).toBe(testUser.userId);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const token = await generateAccessToken(
        testUser.userId,
        testUser.email,
        testUser.role
      );
      
      const payload = await verifyAccessToken(token);
      expect(payload.userId).toBe(testUser.userId);
      expect(payload.email).toBe(testUser.email);
      expect(payload.role).toBe(testUser.role);
      expect(payload.type).toBe('access');
    });

    it('should reject refresh token as access token', async () => {
      const refreshToken = await generateRefreshToken(testUser.userId, testUser.tokenVersion);
      
      await expect(verifyAccessToken(refreshToken)).rejects.toThrow('Invalid token type');
    });

    it('should reject tampered token', async () => {
      const token = await generateAccessToken(
        testUser.userId,
        testUser.email,
        testUser.role
      );
      
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      
      await expect(verifyAccessToken(tamperedToken)).rejects.toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const token = await generateRefreshToken(testUser.userId, testUser.tokenVersion);
      
      const payload = await verifyRefreshToken(token);
      expect(payload.userId).toBe(testUser.userId);
      expect(payload.tokenVersion).toBe(testUser.tokenVersion);
      expect(payload.type).toBe('refresh');
    });

    it('should reject access token as refresh token', async () => {
      const accessToken = await generateAccessToken(
        testUser.userId,
        testUser.email,
        testUser.role
      );
      
      await expect(verifyRefreshToken(accessToken)).rejects.toThrow('Invalid token type');
    });
  });

  describe('decodeTokenUnsafe', () => {
    it('should decode token without verification', async () => {
      const token = await generateAccessToken(
        testUser.userId,
        testUser.email,
        testUser.role
      );
      
      const decoded = decodeTokenUnsafe(token);
      expect(decoded).toMatchObject({
        userId: testUser.userId,
        email: testUser.email,
        role: testUser.role,
        type: 'access',
      });
    });

    it('should return null for invalid token format', () => {
      const decoded = decodeTokenUnsafe('invalid-token');
      expect(decoded).toBeNull();
    });

    it('should return null for empty string', () => {
      const decoded = decodeTokenUnsafe('');
      expect(decoded).toBeNull();
    });
  });

  describe('constants', () => {
    it('should export access token expiry seconds', () => {
      expect(ACCESS_TOKEN_EXPIRY_SECONDS).toBe(900); // 15 minutes
    });

    it('should export refresh token expiry seconds', () => {
      expect(REFRESH_TOKEN_EXPIRY_SECONDS).toBe(604800); // 7 days
    });
  });
});
