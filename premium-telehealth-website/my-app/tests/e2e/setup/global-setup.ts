import { FullConfig } from '@playwright/test';

/**
 * Global Setup for E2E Tests
 * 
 * This runs once before all test suites.
 * Used to set up test environment, database state, etc.
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test suite...');
  
  // Set test environment variables
  (process.env as Record<string, string>).NODE_ENV = 'test';
  
  // You can add database seeding here if needed
  // Example:
  // await seedTestDatabase();
  
  // Create test users if they don't exist
  // await createTestUsers();
  
  console.log('✅ Global setup complete');
}

export default globalSetup;
