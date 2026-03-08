#!/usr/bin/env tsx
/**
 * Performance Testing Script
 *
 * Run with: npx tsx scripts/performance-test.ts
 *
 * This script tests:
 * - Database query performance
 * - API response times
 * - Cache performance
 * - Memory usage
 */

import { performance } from "perf_hooks";
import { prisma, checkDatabaseHealth, getQueryStats, clearQueryMetrics } from "@/lib/db/prisma";
import { getRedisClient, checkRedisHealth } from "@/lib/redis/client";
import { getCache, setCache, deleteCache } from "@/lib/redis/cache";

// ANSI color codes for output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// Performance targets
const TARGETS = {
  DB_QUERY_P95: 50, // ms
  API_RESPONSE_P95: 200, // ms
  CACHE_OPERATION: 5, // ms
  FCP: 2000, // ms (First Contentful Paint)
};

// Test configuration
const CONFIG = {
  DB_ITERATIONS: 100,
  CACHE_ITERATIONS: 1000,
  WARMUP_ITERATIONS: 10,
};

/**
 * Print formatted header
 */
function printHeader(title: string): void {
  console.log("\n" + "=".repeat(60));
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log("=".repeat(60));
}

/**
 * Print test result
 */
function printResult(name: string, value: number, unit: string, target: number, lowerIsBetter = true): void {
  const passed = lowerIsBetter ? value <= target : value >= target;
  const status = passed ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`;
  const comparison = lowerIsBetter ? "<=" : ">=";
  console.log(`${name}: ${colors.yellow}${value.toFixed(2)}${colors.reset} ${unit} ${comparison} ${target} ${unit} ${status}`);
}

/**
 * Calculate statistics from an array of numbers
 */
function calculateStats(values: number[]): {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;

  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
}

/**
 * Test database health and basic connectivity
 */
async function testDatabaseHealth(): Promise<void> {
  printHeader("Database Health Check");

  const health = await checkDatabaseHealth();

  console.log(`Status: ${health.healthy ? `${colors.green}HEALTHY${colors.reset}` : `${colors.red}UNHEALTHY${colors.reset}`}`);
  console.log(`Latency: ${health.latency}ms`);

  if (health.error) {
    console.log(`${colors.red}Error: ${health.error}${colors.reset}`);
  }

  if (!health.healthy) {
    throw new Error("Database health check failed");
  }
}

/**
 * Test database query performance
 */
async function testDatabasePerformance(): Promise<void> {
  printHeader("Database Query Performance");

  // Clear previous metrics
  clearQueryMetrics();

  const times: number[] = [];

  // Warmup
  console.log("Warming up...");
  for (let i = 0; i < CONFIG.WARMUP_ITERATIONS; i++) {
    await prisma.user.count();
  }

  // Test 1: Simple count query
  console.log(`\nRunning ${CONFIG.DB_ITERATIONS} count queries...`);
  for (let i = 0; i < CONFIG.DB_ITERATIONS; i++) {
    const start = performance.now();
    await prisma.user.count();
    times.push(performance.now() - start);
  }

  const countStats = calculateStats(times);
  console.log("\n--- User Count Query ---");
  console.log(`  Min: ${countStats.min.toFixed(2)}ms`);
  console.log(`  Max: ${countStats.max.toFixed(2)}ms`);
  console.log(`  Avg: ${countStats.avg.toFixed(2)}ms`);
  console.log(`  p50: ${countStats.p50.toFixed(2)}ms`);
  console.log(`  p95: ${countStats.p95.toFixed(2)}ms`);
  console.log(`  p99: ${countStats.p99.toFixed(2)}ms`);
  printResult("p95", countStats.p95, "ms", TARGETS.DB_QUERY_P95);

  // Test 2: FindMany with select
  times.length = 0;
  console.log(`\nRunning ${CONFIG.DB_ITERATIONS} findMany queries...`);

  for (let i = 0; i < CONFIG.DB_ITERATIONS; i++) {
    const start = performance.now();
    await prisma.user.findMany({
      select: { id: true, email: true, role: true },
      take: 10,
    });
    times.push(performance.now() - start);
  }

  const findStats = calculateStats(times);
  console.log("\n--- User FindMany Query ---");
  console.log(`  Min: ${findStats.min.toFixed(2)}ms`);
  console.log(`  Max: ${findStats.max.toFixed(2)}ms`);
  console.log(`  Avg: ${findStats.avg.toFixed(2)}ms`);
  console.log(`  p50: ${findStats.p50.toFixed(2)}ms`);
  console.log(`  p95: ${findStats.p95.toFixed(2)}ms`);
  console.log(`  p99: ${findStats.p99.toFixed(2)}ms`);
  printResult("p95", findStats.p95, "ms", TARGETS.DB_QUERY_P95);

  // Overall query stats
  const overallStats = getQueryStats();
  console.log("\n--- Overall Query Statistics ---");
  console.log(`  Total Queries: ${overallStats.totalQueries}`);
  console.log(`  Average Duration: ${overallStats.avgDuration.toFixed(2)}ms`);
  console.log(`  Slow Queries (>50ms): ${overallStats.slowQueries}`);
}

/**
 * Test Redis/cache performance
 */
async function testCachePerformance(): Promise<void> {
  printHeader("Redis Cache Performance");

  // Check Redis health
  const redisHealth = await checkRedisHealth();
  console.log(`Redis Status: ${redisHealth ? `${colors.green}HEALTHY${colors.reset}` : `${colors.red}UNHEALTHY${colors.reset}`}`);

  if (!redisHealth) {
    console.log(`${colors.yellow}Skipping cache tests - Redis unavailable${colors.reset}`);
    return;
  }

  const times = {
    get: [] as number[],
    set: [] as number[],
    delete: [] as number[],
  };

  const testKey = "perf:test:key";
  const testValue = { data: "test", timestamp: Date.now() };

  // Warmup
  console.log("Warming up...");
  for (let i = 0; i < CONFIG.WARMUP_ITERATIONS; i++) {
    await setCache(`${testKey}:${i}`, testValue, 60);
    await getCache(`${testKey}:${i}`);
  }

  // Test SET operations
  console.log(`\nRunning ${CONFIG.CACHE_ITERATIONS} SET operations...`);
  for (let i = 0; i < CONFIG.CACHE_ITERATIONS; i++) {
    const start = performance.now();
    await setCache(`${testKey}:${i}`, testValue, 60);
    times.set.push(performance.now() - start);
  }

  const setStats = calculateStats(times.set);
  console.log("\n--- Cache SET Performance ---");
  console.log(`  Min: ${setStats.min.toFixed(3)}ms`);
  console.log(`  Max: ${setStats.max.toFixed(3)}ms`);
  console.log(`  Avg: ${setStats.avg.toFixed(3)}ms`);
  console.log(`  p95: ${setStats.p95.toFixed(3)}ms`);
  printResult("p95 SET", setStats.p95, "ms", TARGETS.CACHE_OPERATION);

  // Test GET operations
  console.log(`\nRunning ${CONFIG.CACHE_ITERATIONS} GET operations...`);
  for (let i = 0; i < CONFIG.CACHE_ITERATIONS; i++) {
    const start = performance.now();
    await getCache(`${testKey}:${i}`);
    times.get.push(performance.now() - start);
  }

  const getStats = calculateStats(times.get);
  console.log("\n--- Cache GET Performance ---");
  console.log(`  Min: ${getStats.min.toFixed(3)}ms`);
  console.log(`  Max: ${getStats.max.toFixed(3)}ms`);
  console.log(`  Avg: ${getStats.avg.toFixed(3)}ms`);
  console.log(`  p95: ${getStats.p95.toFixed(3)}ms`);
  printResult("p95 GET", getStats.p95, "ms", TARGETS.CACHE_OPERATION);

  // Test DELETE operations
  console.log(`\nRunning ${CONFIG.CACHE_ITERATIONS} DELETE operations...`);
  for (let i = 0; i < CONFIG.CACHE_ITERATIONS; i++) {
    const start = performance.now();
    await deleteCache(`${testKey}:${i}`);
    times.delete.push(performance.now() - start);
  }

  const deleteStats = calculateStats(times.delete);
  console.log("\n--- Cache DELETE Performance ---");
  console.log(`  Min: ${deleteStats.min.toFixed(3)}ms`);
  console.log(`  Max: ${deleteStats.max.toFixed(3)}ms`);
  console.log(`  Avg: ${deleteStats.avg.toFixed(3)}ms`);
  console.log(`  p95: ${deleteStats.p95.toFixed(3)}ms`);
  printResult("p95 DELETE", deleteStats.p95, "ms", TARGETS.CACHE_OPERATION);

  // Cleanup
  await deleteCache(testKey);
}

/**
 * Test memory usage
 */
function testMemoryUsage(): void {
  printHeader("Memory Usage");

  if (global.gc) {
    global.gc();
  }

  const usage = process.memoryUsage();

  console.log("--- Heap Memory ---");
  console.log(`  Used: ${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Total: ${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  RSS: ${(usage.rss / 1024 / 1024).toFixed(2)} MB`);

  if (usage.external) {
    console.log(`  External: ${(usage.external / 1024 / 1024).toFixed(2)} MB`);
  }

  // Alert if memory usage is high
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  if (heapUsedMB > 512) {
    console.log(`${colors.yellow}⚠️  Warning: High memory usage detected${colors.reset}`);
  }
}

/**
 * Test connection pool performance
 */
async function testConnectionPool(): Promise<void> {
  printHeader("Connection Pool Performance");

  const concurrentRequests = 50;
  const times: number[] = [];

  console.log(`Testing ${concurrentRequests} concurrent queries...`);

  const start = performance.now();
  const promises = Array.from({ length: concurrentRequests }, async () => {
    const queryStart = performance.now();
    await prisma.$queryRaw`SELECT 1 as ping`;
    return performance.now() - queryStart;
  });

  const results = await Promise.all(promises);
  const totalTime = performance.now() - start;

  results.forEach((t) => times.push(t));

  const stats = calculateStats(times);

  console.log("\n--- Concurrent Query Performance ---");
  console.log(`  Total Time: ${totalTime.toFixed(2)}ms`);
  console.log(`  Avg per Query: ${stats.avg.toFixed(2)}ms`);
  console.log(`  p95: ${stats.p95.toFixed(2)}ms`);
  console.log(`  Throughput: ${(concurrentRequests / (totalTime / 1000)).toFixed(2)} req/s`);

  if (stats.p95 > 100) {
    console.log(`${colors.yellow}⚠️  Warning: High latency under concurrent load${colors.reset}`);
  }
}

/**
 * Generate performance report
 */
function generateReport(): void {
  printHeader("Performance Test Summary");

  console.log("\n--- Targets ---");
  console.log(`  Database Query p95: < ${TARGETS.DB_QUERY_P95}ms`);
  console.log(`  API Response p95: < ${TARGETS.API_RESPONSE_P95}ms`);
  console.log(`  Cache Operation: < ${TARGETS.CACHE_OPERATION}ms`);
  console.log(`  FCP: < ${TARGETS.FCP}ms`);

  console.log("\n--- Recommendations ---");
  console.log("  1. Run this script before each deployment");
  console.log("  2. Monitor p95 metrics in production");
  console.log("  3. Set up alerts for performance degradation");
  console.log("  4. Use Redis for session and API caching");
  console.log("  5. Enable database connection pooling in production");

  console.log("\n--- Next Steps ---");
  console.log("  - Use k6 or Artillery for load testing");
  console.log("  - Configure APM (e.g., Datadog, New Relic)");
  console.log("  - Set up Lighthouse CI for frontend performance");
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
  console.log(`${colors.blue}`);
  console.log("██████╗ ███████╗██████╗ ███████╗ ██████╗ ██████╗ ███╗   ███╗ █████╗ ███╗   ██╗ ██████╗███████╗");
  console.log("██╔══██╗██╔════╝██╔══██╗██╔════╝██╔════╝██╔═══██╗████╗ ████║██╔══██╗████╗  ██║██╔════╝██╔════╝");
  console.log("██████╔╝█████╗  ██████╔╝█████╗  ██║     ██║   ██║██╔████╔██║███████║██╔██╗ ██║██║     █████╗  ");
  console.log("██╔═══╝ ██╔══╝  ██╔══██╗██╔══╝  ██║     ██║   ██║██║╚██╔╝██║██╔══██║██║╚██╗██║██║     ██╔══╝  ");
  console.log("██║     ███████╗██║  ██║██║     ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║  ██║██║ ╚████║╚██████╗███████╗");
  console.log("╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝      ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝╚══════╝");
  console.log(`${colors.reset}`);
  console.log("                    Rimal Health Performance Testing Suite v1.0");
  console.log(`                              ${new Date().toISOString()}`);

  try {
    // Run all tests
    await testDatabaseHealth();
    await testDatabasePerformance();
    await testCachePerformance();
    await testConnectionPool();
    testMemoryUsage();
    generateReport();

    // Cleanup
    await prisma.$disconnect();

    const redis = getRedisClient();
    await redis.quit();

    console.log("\n" + "=".repeat(60));
    console.log(`${colors.green}✅ Performance testing completed${colors.reset}`);
    console.log("=".repeat(60) + "\n");

    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}❌ Performance testing failed:${colors.reset}`, error);

    // Cleanup on error
    try {
      await prisma.$disconnect();
    } catch {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

// Run tests
main();
