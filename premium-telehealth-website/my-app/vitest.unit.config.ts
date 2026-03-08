/**
 * Vitest Configuration for Unit Tests
 * 
 * @module vitest.unit.config
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test file patterns - unit tests only
    include: ['tests/unit/**/*.test.ts', 'lib/**/*.test.ts'],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      '.next',
      'dist',
      'tests/integration/**/*',
      'tests/e2e/**/*',
    ],
    
    // Test timeout (10 seconds for unit tests)
    testTimeout: 10000,
    
    // Hook timeout
    hookTimeout: 10000,
    
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
        '**/*.test.ts',
      ],
    },
    
    // Global test utilities
    globals: true,
    
    // Reporters
    reporters: ['verbose'],
    
    // Parallel execution for faster unit tests
    pool: 'threads',
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
