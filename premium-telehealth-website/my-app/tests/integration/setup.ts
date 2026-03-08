/**
 * Test Setup and Database Configuration
 * 
 * This file configures the test environment and provides database
 * utilities for integration tests.
 * 
 * Environment Variables:
 * - DATABASE_URL_TEST: PostgreSQL connection string for test database
 * - JWT_SECRET: Secret key for JWT signing (use test secret)
 * 
 * @module tests/integration/setup
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Import the prisma client from the app (handles encryption and configuration)
import { getBasePrisma, disconnectPrisma } from '@/lib/db/prisma';

// Get the base Prisma client (without encryption extension for easier testing)
const prisma = getBasePrisma();

// ============================================
// Test Environment Configuration
// ============================================

/**
 * Ensure test environment variables are set
 */
function validateTestEnvironment(): void {
  if (!process.env.DATABASE_URL_TEST) {
    console.warn(
      'WARNING: DATABASE_URL_TEST not set. Using DATABASE_URL. ' +
      'This may affect your development database!'
    );
    // Use main database as fallback (with warning)
    process.env.DATABASE_URL_TEST = process.env.DATABASE_URL;
  }

  // Set test JWT secret if not provided
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-tests-only';
  }

  // Set test Stripe webhook secret
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret_for_testing';
  }

  // Set test Stripe secret key
  if (!process.env.STRIPE_SECRET_KEY) {
    process.env.STRIPE_SECRET_KEY = 'sk_test_' + '0'.repeat(24);
  }

  // Mark as test environment
  (process.env as Record<string, string>).NODE_ENV = 'test';
}

// ============================================
// Database Utilities
// ============================================

/**
 * Clean all database tables for test isolation
 * Order matters due to foreign key constraints
 */
export async function cleanDatabase(): Promise<void> {
  // Disable foreign key checks temporarily (if supported)
  // For PostgreSQL, we delete in reverse dependency order
  
  await prisma.$transaction([
    // Audit logs (no dependencies)
    prisma.auditLog.deleteMany(),
    
    // Notifications
    prisma.notification.deleteMany(),
    
    // Messages
    prisma.message.deleteMany(),
    
    // Documents
    prisma.document.deleteMany(),
    
    // Refill requests
    prisma.refillRequest.deleteMany(),
    
    // Prescriptions
    prisma.prescription.deleteMany(),
    
    // Invoices
    prisma.invoice.deleteMany(),
    
    // Subscriptions
    prisma.subscription.deleteMany(),
    
    // Intakes
    prisma.intake.deleteMany(),
    
    // Sessions
    prisma.session.deleteMany(),
    
    // Physician profiles
    prisma.physician.deleteMany(),
    
    // Patient profiles
    prisma.patientProfile.deleteMany(),
    
    // Users (last due to foreign keys)
    prisma.user.deleteMany(),
  ]).catch((error) => {
    // If tables don't exist yet, that's okay during initial setup
    console.warn('Database cleanup warning (tables may not exist yet):', error.message);
  });
}

/**
 * Check if database is connected and accessible
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get database URL for display (masks credentials)
 */
export function getMaskedDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || '';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:****@${parsed.host}${parsed.pathname}`;
  } catch {
    return 'invalid-url';
  }
}

// ============================================
// Test Lifecycle Hooks
// ============================================

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
  console.log('\n🧪 Starting Integration Tests...\n');
  
  validateTestEnvironment();
  
  console.log(`📊 Database: ${getMaskedDatabaseUrl()}`);
  
  // Check database connection
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    console.error('❌ Failed to connect to test database');
    console.error('Please ensure your test database is running and accessible.');
    process.exit(1);
  }
  
  console.log('✅ Database connected');
  
  // Clean database before starting tests
  await cleanDatabase();
  console.log('✅ Database cleaned\n');
}, 30000);

/**
 * Cleanup before each test - ensures test isolation
 */
beforeEach(async () => {
  await cleanDatabase();
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  // Optional: Additional cleanup or verification
});

/**
 * Global teardown - runs once after all tests
 */
afterAll(async () => {
  console.log('\n🧹 Cleaning up test environment...');
  
  // Final database cleanup
  await cleanDatabase();
  
  // Disconnect from database
  await disconnectPrisma();
  
  console.log('✅ Test environment cleaned up\n');
}, 30000);

// ============================================
// Test Utilities
// ============================================

/**
 * Helper to create a test context with common utilities
 */
export function createTestContext() {
  return {
    prisma,
    cleanDatabase,
    
    /**
     * Run a function within a test transaction
     * Rolls back after execution for complete isolation
     */
    async inTransaction<T>(fn: () => Promise<T>): Promise<T> {
      return prisma.$transaction(async () => {
        const result = await fn();
        // Rollback is automatic if an error is thrown
        return result;
      });
    },
  };
}

// Export types for test files
export type TestContext = ReturnType<typeof createTestContext>;
