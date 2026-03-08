/**
 * Authentication Test Helpers
 * 
 * Provides utilities for creating test users, logging in,
 * and generating authentication tokens for API tests.
 * 
 * @module tests/helpers/auth
 */

import { Role } from '@prisma/client';
import { getBasePrisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { generateTokenPair } from '@/lib/auth/jwt';

// Use base Prisma client without encryption extension for tests
const prisma = getBasePrisma();

// ============================================
// Types
// ============================================

export interface TestUser {
  id: string;
  email: string;
  password: string;
  passwordHash: string;
  role: Role;
  tokenVersion: number;
  emailVerified: boolean;
  accessToken: string;
  refreshToken: string;
}

export interface CreateUserOptions {
  email?: string;
  password?: string;
  role?: Role;
  emailVerified?: boolean;
  tokenVersion?: number;
  createProfile?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ============================================
// User Creation Helpers
// ============================================

/**
 * Default test user password - meets strength requirements
 */
export const DEFAULT_TEST_PASSWORD = 'TestPassword123!';

/**
 * Generate a unique email for test users
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@example.com`;
}

/**
 * Create a test user in the database
 * 
 * @param options - User creation options
 * @returns Created test user with tokens
 * 
 * @example
 * ```typescript
 * const patient = await createTestUser({ role: 'PATIENT' });
 * const physician = await createTestUser({ role: 'PHYSICIAN' });
 * ```
 */
export async function createTestUser(options: CreateUserOptions = {}): Promise<TestUser> {
  const {
    email = generateTestEmail(),
    password = DEFAULT_TEST_PASSWORD,
    role = Role.PATIENT,
    emailVerified = true,
    tokenVersion = 0,
    createProfile = true,
  } = options;

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      role,
      emailVerified,
      tokenVersion,
    },
  });

  // Create profile if requested
  if (createProfile) {
    if (role === Role.PATIENT) {
      await prisma.patientProfile.create({
        data: {
          userId: user.id,
          firstName: 'Test',
          lastName: 'Patient',
          dateOfBirth: '1990-01-01',
          phone: '555-555-5555',
          addressStreet: '123 Test St',
          addressCity: 'Los Angeles',
          addressState: 'CA',
          addressZip: '90210',
          termsAccepted: true,
          termsAcceptedDate: new Date(),
        },
      });
    } else if (role === Role.PHYSICIAN) {
      await prisma.physician.create({
        data: {
          userId: user.id,
          firstName: 'Test',
          lastName: 'Doctor',
          licenseNumber: 'MD123456',
          licenseState: 'CA',
          npiNumber: '1234567890',
          specialty: 'Addiction Medicine',
        },
      });
    }
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateTokenPair(
    user.id,
    user.email,
    user.role,
    user.tokenVersion
  );

  // Create session
  await prisma.session.create({
    data: {
      userId: user.id,
      token: accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    },
  });

  return {
    id: user.id,
    email: user.email,
    password,
    passwordHash,
    role: user.role,
    tokenVersion: user.tokenVersion,
    emailVerified: user.emailVerified,
    accessToken,
    refreshToken,
  };
}

/**
 * Create multiple test users at once
 * 
 * @param count - Number of users to create
 * @param options - Options applied to all users
 * @returns Array of created test users
 */
export async function createTestUsers(
  count: number,
  options: CreateUserOptions = {}
): Promise<TestUser[]> {
  const users: TestUser[] = [];
  for (let i = 0; i < count; i++) {
    users.push(await createTestUser(options));
  }
  return users;
}

/**
 * Create a test user for each role
 * 
 * @returns Object with users for each role
 */
export async function createUsersForRoles(): Promise<Record<Role, TestUser>> {
  return {
    [Role.PATIENT]: await createTestUser({ role: Role.PATIENT }),
    [Role.PHYSICIAN]: await createTestUser({ role: Role.PHYSICIAN }),
    [Role.ADMIN]: await createTestUser({ role: Role.ADMIN }),
  };
}

// ============================================
// Token Helpers
// ============================================

/**
 * Generate authentication headers for API requests
 * 
 * @param accessToken - JWT access token
 * @returns Headers object with Authorization
 */
export function getAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Generate an expired token for testing
 * 
 * @param user - Test user to generate token for
 * @returns Expired JWT token
 */
export async function generateExpiredToken(user: TestUser): Promise<string> {
  // Create a token with immediate expiration
  const { SignJWT } = await import('jose');
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret');
  
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600) // Issued 1 hour ago
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1800) // Expired 30 minutes ago
    .setSubject(user.id)
    .setAudience('telehealth-api')
    .setIssuer('telehealth-platform')
    .sign(secret);
  
  return token;
}

/**
 * Generate an invalid token for testing
 * 
 * @returns Invalid JWT token
 */
export function generateInvalidToken(): string {
  return 'invalid.token.here';
}

/**
 * Generate a tampered token for testing
 * 
 * @param user - Test user base
 * @returns Tampered JWT token
 */
export async function generateTamperedToken(user: TestUser): Promise<string> {
  const { SignJWT } = await import('jose');
  const wrongSecret = new TextEncoder().encode('wrong-secret-key');
  
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setSubject(user.id)
    .setAudience('telehealth-api')
    .setIssuer('telehealth-platform')
    .sign(wrongSecret);
  
  return token;
}

// ============================================
// Authentication Helpers
// ============================================

/**
 * Login a test user and return tokens
 * 
 * @param credentials - Login credentials
 * @returns Object with tokens or null if login fails
 */
export async function loginTestUser(
  credentials: LoginCredentials
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email: credentials.email.toLowerCase() },
  });

  if (!user) {
    return null;
  }

  const { verifyPassword } = await import('@/lib/auth/password');
  const isValid = await verifyPassword(credentials.password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  const { accessToken, refreshToken } = await generateTokenPair(
    user.id,
    user.email,
    user.role,
    user.tokenVersion
  );

  // Update session
  await prisma.session.create({
    data: {
      userId: user.id,
      token: accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    },
  });

  return { accessToken, refreshToken };
}

/**
 * Logout a test user by invalidating their session
 * 
 * @param refreshToken - Refresh token to invalidate
 */
export async function logoutTestUser(refreshToken: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { refreshToken },
  });
}

/**
 * Refresh tokens for a test user
 * 
 * @param refreshToken - Current refresh token
 * @returns New token pair or null if refresh fails
 */
export async function refreshTestUserTokens(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const { verifyRefreshToken, generateTokenPair } = await import('@/lib/auth/jwt');
    const payload = await verifyRefreshToken(refreshToken);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return null;
    }

    const tokens = await generateTokenPair(
      user.id,
      user.email,
      user.role,
      user.tokenVersion
    );

    // Update session with new tokens
    await prisma.session.update({
      where: { refreshToken },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return tokens;
  } catch {
    return null;
  }
}

// ============================================
// Test Data Factories
// ============================================

/**
 * Create a valid registration payload
 */
export function createRegistrationPayload(
  overrides: Partial<{
    email: string;
    password: string;
    confirmPassword: string;
    termsAccepted: boolean;
  }> = {}
): {
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
} {
  const password = overrides.password || DEFAULT_TEST_PASSWORD;
  return {
    email: overrides.email || generateTestEmail(),
    password,
    confirmPassword: overrides.confirmPassword || password,
    termsAccepted: overrides.termsAccepted ?? true,
  };
}

/**
 * Create a valid login payload
 */
export function createLoginPayload(
  email: string,
  password: string = DEFAULT_TEST_PASSWORD
): {
  email: string;
  password: string;
} {
  return { email, password };
}

/**
 * Create weak password payloads for testing validation
 */
export function createWeakPasswordPayloads(): Array<{
  password: string;
  description: string;
}> {
  return [
    { password: 'short', description: 'too short' },
    { password: 'lowercase123!', description: 'no uppercase' },
    { password: 'UPPERCASE123!', description: 'no lowercase' },
    { password: 'Uppercase!!!', description: 'no numbers' },
    { password: 'Uppercase123', description: 'no special characters' },
  ];
}
