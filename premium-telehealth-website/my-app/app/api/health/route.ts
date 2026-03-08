/**
 * Health Check API Endpoint
 *
 * GET /api/health
 *
 * Returns system health status including:
 * - Database connectivity
 * - Redis connectivity
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
import { checkRedisHealth, getRedisStatus } from "@/lib/redis/client";
import { getHealthMetrics } from "@/lib/middleware/performance-monitor";

// ============================================================================
// Types
// ============================================================================

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
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

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET handler for health checks
 *
 * Returns comprehensive health status of the application.
 * Cached for 5 seconds to prevent excessive database calls.
 */
export async function GET(request: NextRequest): Promise<NextResponse<HealthResponse | ErrorResponse>> {
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
    // Check all services in parallel
    const [dbHealth, redisHealthy, performance] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      Promise.resolve(getHealthMetrics()),
    ]);

    // Get memory usage
    const memUsage = process.memoryUsage();

    // Determine overall status
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (!dbHealth.healthy || !redisHealthy) {
      status = "unhealthy";
    } else if (performance.status !== "healthy") {
      status = "degraded";
    }

    // Build response
    const health: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      version: VERSION,
      services: {
        database: {
          status: dbHealth.healthy ? "healthy" : "unhealthy",
          latency: dbHealth.latency,
          ...(dbHealth.error && { error: dbHealth.error }),
        },
        cache: {
          status: redisHealthy ? "healthy" : "unhealthy",
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
    const statusCode = status === "healthy" ? 200 : status === "degraded" ? 200 : 503;

    return NextResponse.json(health, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-cache",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);

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
    const [dbHealth, redisHealthy] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

    const isHealthy = dbHealth.healthy && redisHealthy;
    const statusCode = isHealthy ? 200 : 503;

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
