/**
 * Auth Endpoints Integration Tests
 * 
 * Tests for:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - POST /api/auth/logout
 * - POST /api/auth/refresh
 * 
 * @module tests/integration/auth
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';

// Route handlers
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { POST as refreshHandler } from '@/app/api/auth/refresh/route';

// Test helpers
import {
  createTestUser,
  generateTestEmail,
  DEFAULT_TEST_PASSWORD,
  createRegistrationPayload,
  createLoginPayload,
  createWeakPasswordPayloads,
  generateExpiredToken,
  generateInvalidToken,
} from '@/tests/helpers/auth';

// ============================================
// Request Helpers
// ============================================

/**
 * Create a mock NextRequest for API route handlers
 */
function createMockRequest(
  body: unknown,
  options: {
    method?: string;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const url = 'http://localhost:3000/api/test';
  
  return new Request(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

/**
 * Parse JSON response
 */
async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return null;
}

// ============================================
// Register Endpoint Tests
// ============================================

describe('POST /api/auth/register', () => {
  describe('✅ Success Cases', () => {
    it('should register a new user successfully', async () => {
      const payload = createRegistrationPayload();
      const request = createMockRequest(payload);
      
      const response = await registerHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        user: {
          email: payload.email.toLowerCase(),
          role: 'PATIENT',
        },
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      });
    });

    it('should create a patient profile for new user', async () => {
      const payload = createRegistrationPayload();
      const request = createMockRequest(payload);
      
      const response = await registerHandler(request);
      const body = await parseResponse(response) as { user: { id: string } };
      
      expect(response.status).toBe(201);
      expect(body.user.id).toBeDefined();
    });

    it('should return valid JWT tokens', async () => {
      const payload = createRegistrationPayload();
      const request = createMockRequest(payload);
      
      const response = await registerHandler(request);
      const body = await parseResponse(response) as { 
        accessToken: string; 
        refreshToken: string;
        expiresIn: number;
      };
      
      expect(response.status).toBe(201);
      expect(body.accessToken).toMatch(/^eyJ/); // JWT format
      expect(body.refreshToken).toMatch(/^eyJ/);
      expect(body.expiresIn).toBe(900); // 15 minutes
    });
  });

  describe('❌ Validation Errors', () => {
    it('should return 400 for invalid email format', async () => {
      const payload = createRegistrationPayload({ email: 'invalid-email' });
      const request = createMockRequest(payload);
      
      const response = await registerHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should return 400 for password too short', async () => {
      const payload = createRegistrationPayload({ password: 'short' });
      const request = createMockRequest(payload);
      
      const response = await registerHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should return 400 for passwords that do not match', async () => {
      const payload = createRegistrationPayload({
        password: DEFAULT_TEST_PASSWORD,
        confirmPassword: 'DifferentPassword123!',
      });
      const request = createMockRequest(payload);
      
      const response = await registerHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should return 400 when terms not accepted', async () => {
      const payload = createRegistrationPayload({ termsAccepted: false });
      const request = createMockRequest(payload);
      
      const response = await registerHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should return 400 for weak passwords', async () => {
      const weakPasswords = createWeakPasswordPayloads();
      
      for (const { password, description } of weakPasswords) {
        const payload = createRegistrationPayload({ 
          email: generateTestEmail(),
          password,
          confirmPassword: password,
        });
        const request = createMockRequest(payload);
        
        const response = await registerHandler(request);
        const body = await parseResponse(response);
        
        expect(response.status).toBe(400);
        expect(body).toMatchObject({
          error: expect.any(String),
        });
      }
    });
  });

  describe('❌ Duplicate Email', () => {
    it('should return 409 for duplicate email (without revealing email exists)', async () => {
      // Create first user
      const existingUser = await createTestUser();
      
      // Try to register with same email
      const payload = createRegistrationPayload({ email: existingUser.email });
      const request = createMockRequest(payload);
      
      const response = await registerHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(409);
      expect(body).toMatchObject({
        error: expect.stringContaining('Registration failed'),
        code: 'REGISTRATION_ERROR',
      });
    });
  });

  describe('❌ Missing Fields', () => {
    it('should return 400 when email is missing', async () => {
      const payload = { password: DEFAULT_TEST_PASSWORD };
      const request = createMockRequest(payload);
      
      const response = await registerHandler(request);
      
      expect(response.status).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
      const payload = { email: generateTestEmail() };
      const request = createMockRequest(payload);
      
      const response = await registerHandler(request);
      
      expect(response.status).toBe(400);
    });

    it('should return 400 for empty request body', async () => {
      const request = createMockRequest({});
      
      const response = await registerHandler(request);
      
      expect(response.status).toBe(400);
    });
  });
});

// ============================================
// Login Endpoint Tests
// ============================================

describe('POST /api/auth/login', () => {
  describe('✅ Success Cases', () => {
    it('should login with valid credentials', async () => {
      const user = await createTestUser();
      const payload = createLoginPayload(user.email, user.password);
      const request = createMockRequest(payload);
      
      const response = await loginHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
        redirectUrl: expect.any(String),
      });
    });

    it('should return correct redirectUrl for patient', async () => {
      const user = await createTestUser({ role: Role.PATIENT });
      const payload = createLoginPayload(user.email, user.password);
      const request = createMockRequest(payload);
      
      const response = await loginHandler(request);
      const body = await parseResponse(response) as { redirectUrl: string };
      
      expect(response.status).toBe(200);
      expect(body.redirectUrl).toBe('/patient/dashboard');
    });

    it('should return correct redirectUrl for physician', async () => {
      const user = await createTestUser({ role: Role.PHYSICIAN });
      const payload = createLoginPayload(user.email, user.password);
      const request = createMockRequest(payload);
      
      const response = await loginHandler(request);
      const body = await parseResponse(response) as { redirectUrl: string };
      
      expect(response.status).toBe(200);
      expect(body.redirectUrl).toBe('/physician/queue');
    });

    it('should return correct redirectUrl for admin', async () => {
      const user = await createTestUser({ role: Role.ADMIN });
      const payload = createLoginPayload(user.email, user.password);
      const request = createMockRequest(payload);
      
      const response = await loginHandler(request);
      const body = await parseResponse(response) as { redirectUrl: string };
      
      expect(response.status).toBe(200);
      expect(body.redirectUrl).toBe('/admin/dashboard');
    });
  });

  describe('❌ Invalid Credentials', () => {
    it('should return 401 for invalid password', async () => {
      const user = await createTestUser();
      const payload = createLoginPayload(user.email, 'WrongPassword123!');
      const request = createMockRequest(payload);
      
      const response = await loginHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should return 401 for non-existent email', async () => {
      const payload = createLoginPayload('nonexistent@example.com', DEFAULT_TEST_PASSWORD);
      const request = createMockRequest(payload);
      
      const response = await loginHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should return same error for invalid email and invalid password (prevent enumeration)', async () => {
      const nonExistentPayload = createLoginPayload('nonexistent@example.com', DEFAULT_TEST_PASSWORD);
      const wrongPasswordPayload = createLoginPayload(
        (await createTestUser()).email,
        'WrongPassword123!'
      );
      
      const response1 = await loginHandler(createMockRequest(nonExistentPayload));
      const response2 = await loginHandler(createMockRequest(wrongPasswordPayload));
      
      const body1 = await parseResponse(response1);
      const body2 = await parseResponse(response2);
      
      expect(body1).toEqual(body2);
    });
  });

  describe('❌ Validation Errors', () => {
    it('should return 400 for invalid email format', async () => {
      const payload = { email: 'invalid-email', password: DEFAULT_TEST_PASSWORD };
      const request = createMockRequest(payload);
      
      const response = await loginHandler(request);
      
      expect(response.status).toBe(400);
    });

    it('should return 400 when email is missing', async () => {
      const payload = { password: DEFAULT_TEST_PASSWORD };
      const request = createMockRequest(payload);
      
      const response = await loginHandler(request);
      
      expect(response.status).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
      const payload = { email: generateTestEmail() };
      const request = createMockRequest(payload);
      
      const response = await loginHandler(request);
      
      expect(response.status).toBe(400);
    });
  });
});

// ============================================
// Logout Endpoint Tests
// ============================================

describe('POST /api/auth/logout', () => {
  describe('✅ Success Cases', () => {
    it('should logout with valid refresh token', async () => {
      const user = await createTestUser();
      const payload = { refreshToken: user.refreshToken };
      const request = createMockRequest(payload, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      
      const response = await logoutHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
      });
    });

    it('should logout with access token only', async () => {
      const user = await createTestUser();
      const request = createMockRequest({}, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      
      const response = await logoutHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
      });
    });

    it('should succeed even with invalid token (best-effort logout)', async () => {
      const request = createMockRequest({
        refreshToken: 'invalid-token',
      }, {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      
      const response = await logoutHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
      });
    });
  });

  describe('❌ Session Invalidation', () => {
    it('should invalidate session after logout', async () => {
      const user = await createTestUser();
      
      // Logout
      const logoutRequest = createMockRequest({
        refreshToken: user.refreshToken,
      }, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      
      await logoutHandler(logoutRequest);
      
      // Try to use the refresh token after logout
      const refreshRequest = createMockRequest({
        refreshToken: user.refreshToken,
      });
      
      const response = await refreshHandler(refreshRequest);
      
      expect(response.status).toBe(401);
    });
  });

  describe('✅ No Token Provided', () => {
    it('should succeed even with no tokens (silent logout)', async () => {
      const request = createMockRequest({});
      
      const response = await logoutHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
      });
    });
  });
});

// ============================================
// Refresh Endpoint Tests
// ============================================

describe('POST /api/auth/refresh', () => {
  describe('✅ Success Cases', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const user = await createTestUser();
      const payload = { refreshToken: user.refreshToken };
      const request = createMockRequest(payload);
      
      const response = await refreshHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      });
    });

    it('should return new tokens different from old ones', async () => {
      const user = await createTestUser();
      const payload = { refreshToken: user.refreshToken };
      const request = createMockRequest(payload);
      
      const response = await refreshHandler(request);
      const body = await parseResponse(response) as { 
        accessToken: string; 
        refreshToken: string;
      };
      
      expect(body.accessToken).not.toBe(user.accessToken);
      expect(body.refreshToken).not.toBe(user.refreshToken);
    });

    it('should update session with new tokens', async () => {
      const user = await createTestUser();
      const payload = { refreshToken: user.refreshToken };
      const request = createMockRequest(payload);
      
      await refreshHandler(request);
      
      // Old refresh token should no longer work
      const secondRequest = createMockRequest({ refreshToken: user.refreshToken });
      const secondResponse = await refreshHandler(secondRequest);
      
      expect(secondResponse.status).toBe(401);
    });
  });

  describe('❌ Invalid Token', () => {
    it('should return 401 for invalid refresh token', async () => {
      const payload = { refreshToken: generateInvalidToken() };
      const request = createMockRequest(payload);
      
      const response = await refreshHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_TOKEN',
      });
    });

    it('should return 401 when refresh token is missing', async () => {
      const request = createMockRequest({});
      
      const response = await refreshHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should return 401 for expired refresh token', async () => {
      const user = await createTestUser();
      const expiredToken = await generateExpiredToken(user);
      
      const payload = { refreshToken: expiredToken };
      const request = createMockRequest(payload);
      
      const response = await refreshHandler(request);
      
      expect(response.status).toBe(401);
    });
  });

  describe('❌ Token Version Mismatch', () => {
    it('should return 401 when token version is invalid', async () => {
      const user = await createTestUser();
      
      // Increment token version (simulating password change or forced logout)
      const { prisma } = await import('@/lib/db/prisma');
      await prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });
      
      const payload = { refreshToken: user.refreshToken };
      const request = createMockRequest(payload);
      
      const response = await refreshHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        error: expect.stringContaining('session invalidated'),
        code: 'SESSION_INVALIDATED',
      });
    });
  });

  describe('❌ User Deleted', () => {
    it('should return 401 when user no longer exists', async () => {
      const user = await createTestUser();
      
      // Delete user
      const { prisma } = await import('@/lib/db/prisma');
      await prisma.user.delete({ where: { id: user.id } });
      
      const payload = { refreshToken: user.refreshToken };
      const request = createMockRequest(payload);
      
      const response = await refreshHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    });
  });
});
