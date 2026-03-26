/**
 * Health Check API Endpoint
 *
 * GET /api/health
 *
 * Returns system health status including:
 * - Database connectivity
 * - Redis connectivity (with 2-second ping timeout)
 * - Performance metrics
 * - Memory usage
 *
 * Used by:
 * - Load balancers for health checks
 * - Monitoring systems (Datadog, etc.)
 * - Deployment validation
 *
 * @module app/api/health
 */

import { NextRequest, NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db/prisma";
import {
  checkRedisHealth,
  getRedisStatus,
  getRedisClient,
} from "@/lib/redis/client";
import { getHealthMetrics } from "@/lib/middleware/performance-monitor";

// ============================================================================
// Types
// ============================================================================

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  database: "connected" | "disconnected";
  redis: "connected" | "disconnected";
  services: {
    database: {
      status: "healthy" | "unhealthy";
      latency: number;
      error?: string;
    };
    cache: {
      status: "healthy" | "unhealthy";
      connected: boolean;
      ready: boolean;
    };
  };
  performance: {
    recentP95: number;
    errorRate: number;
    activeRequests: number;
  };
  memory: {
    used: number;
    total: number;
    rss: number;
  };
}

interface ErrorResponse {
  status: "unhealthy";
  error: string;
  timestamp: string;
}

// ============================================================================
// Constants
// ============================================================================

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";

// Health check cache (avoid excessive DB calls)
let cachedHealth: HealthResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds
const REDIS_HEALTH_TIMEOUT = 2000; // 2-second timeout for Redis ping

// ============================================================================
// Helpers
// ============================================================================

/**
 * Ping Redis with a 2-second timeout.
 * Returns true if Redis responds with PONG within the timeout, false otherwise.
 */
async function redisPingWithTimeout(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await Promise.race([
      client.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Redis ping timeout")),
          REDIS_HEALTH_TIMEOUT
        )
      ),
    ]);
    return result === "PONG";
  } catch {
    return false;
  }
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET handler for health checks
 *
 * Returns comprehensive health status of the application.
 * Cached for 5 seconds to prevent excessive database calls.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<HealthResponse | ErrorResponse>> {
  // Check for cached result
  const now = Date.now();
  if (cachedHealth && now - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json(cachedHealth, {
      headers: {
        "Cache-Control": "no-cache",
        "X-Cache": "HIT",
      },
    });
  }

  try {
    // Check all services in parallel (Redis ping uses 2-second timeout)
    const [dbHealth, redisHealthy, redisPingOk, performance] =
      await Promise.all([
        checkDatabaseHealth(),
        checkRedisHealth(),
        redisPingWithTimeout(),
        Promise.resolve(getHealthMetrics()),
      ]);

    const redisConnected = redisHealthy && redisPingOk;

    // Get memory usage
    const memUsage = process.memoryUsage();

    // Determine overall status
    // Redis is optional — only DB failures make the service unhealthy
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (!dbHealth.healthy) {
      status = "unhealthy";
    } else if (!redisConnected) {
      status = "degraded";
    } else if (performance.status !== "healthy") {
      status = "degraded";
    }

    // Build response
    const health: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      version: VERSION,
      database: dbHealth.healthy ? "connected" : "disconnected",
      redis: redisConnected ? "connected" : "disconnected",
      services: {
        database: {
          status: dbHealth.healthy ? "healthy" : "unhealthy",
          latency: dbHealth.latency,
          ...(dbHealth.error && { error: dbHealth.error }),
        },
        cache: {
          status: redisConnected ? "healthy" : "unhealthy",
          ...getRedisStatus(),
        },
      },
      performance: {
        recentP95: performance.recentP95,
        errorRate: performance.errorRate,
        activeRequests: performance.activeRequests,
      },
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      },
    };

    // Cache result
    cachedHealth = health;
    cacheTimestamp = now;

    // Return with appropriate status code
    // Redis failure returns 200 (degraded) — only DB failure returns 503
    const statusCode = status === "unhealthy" ? 503 : 200;

    return NextResponse.json(health, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-cache",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Health check failed:", error instanceof Error ? error.message : 'Unknown error');

    const errorResponse: ErrorResponse = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  }
}

/**
 * HEAD handler for lightweight health checks
 *
 * Used by load balancers that only need a status code
 */
export async function HEAD(): Promise<NextResponse> {
  try {
    const [dbHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    // Only DB health determines the status code (Redis is optional)
    const statusCode = dbHealth.healthy ? 200 : 503;

    return new NextResponse(null, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
