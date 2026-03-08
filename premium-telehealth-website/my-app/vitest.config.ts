/**
 * Vitest Configuration for Integration Tests
 * 
 * @module vitest.config
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test file patterns
    include: ['tests/integration/**/*.test.ts'],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      '.next',
      'dist',
      'tests/e2e/**/*',
    ],
    
    // Setup files to run before tests
    setupFiles: ['./tests/integration/setup.ts'],
    
    // Test timeout (30 seconds for database operations)
    testTimeout: 30000,
    
    // Hook timeout
    hookTimeout: 30000,
    
    // Enable type checking in tests
    typecheck: {
      enabled: false, // Set to true to enable type checking
    },
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '.next/',
      ],
    },
    
    // Global test utilities
    globals: true,
    
    // Reporters
    reporters: ['verbose'],
    
    // Parallel execution
    // Use 1 for database tests to avoid conflicts
    pool: 'forks',
  },
  
  // Resolve aliases (must match tsconfig.json)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/app': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@/types': path.resolve(__dirname, './types'),
      '@/public': path.resolve(__dirname, './public'),
      '@/tests': path.resolve(__dirname, './tests'),
    },
  },
  
  // TypeScript configuration
  esbuild: {
    target: 'es2022',
  },
});
