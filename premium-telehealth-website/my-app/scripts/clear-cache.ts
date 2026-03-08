#!/usr/bin/env tsx
/**
 * Cache Management Script
 *
 * Run with: npx tsx scripts/clear-cache.ts [pattern]
 *
 * Examples:
 *   npx tsx scripts/clear-cache.ts              # Clear all API cache
 *   npx tsx scripts/clear-cache.ts physician    # Clear physician cache
 *   npx tsx scripts/clear-cache.ts patient      # Clear patient cache
 *   npx tsx scripts/clear-cache.ts user:123     # Clear specific user cache
 */

import { getRedisClient } from "@/lib/redis/client";
import { clearCachePattern } from "@/lib/redis/cache";

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

async function main(): Promise<void> {
  const pattern = process.argv[2];

  console.log(`${colors.cyan}=== Rimal Health Cache Management ===${colors.reset}\n`);

  try {
    const redis = getRedisClient();

    // Test connection
    const pong = await redis.ping();
    if (pong !== "PONG") {
      throw new Error("Redis connection failed");
    }

    console.log(`${colors.green}✓ Redis connected${colors.reset}\n`);

    if (!pattern) {
      // Clear all API cache
      console.log(`${colors.yellow}Clearing all API cache...${colors.reset}`);
      const count = await clearCachePattern("api:*");
      console.log(`${colors.green}✓ Cleared ${count} API cache entries${colors.reset}`);
    } else if (pattern.includes(":")) {
      // Specific pattern (e.g., user:123)
      console.log(`${colors.yellow}Clearing cache for pattern: ${pattern}...${colors.reset}`);
      const count = await clearCachePattern(`*${pattern}*`);
      console.log(`${colors.green}✓ Cleared ${count} cache entries${colors.reset}`);
    } else {
      // Prefix pattern (e.g., physician, patient)
      console.log(`${colors.yellow}Clearing cache for prefix: ${pattern}...${colors.reset}`);
      const count = await clearCachePattern(`api:*${pattern}*`);
      console.log(`${colors.green}✓ Cleared ${count} cache entries${colors.reset}`);
    }

    // Get cache stats
    const info = await redis.info("keyspace");
    console.log(`\n${colors.cyan}Cache Info:${colors.reset}`);
    console.log(info.split("\r\n").slice(0, 5).join("\n"));

    // Close connection
    await redis.quit();

    console.log(`\n${colors.green}✓ Cache management completed${colors.reset}`);
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}✗ Cache management failed:${colors.reset}`, error);
    process.exit(1);
  }
}

main();
