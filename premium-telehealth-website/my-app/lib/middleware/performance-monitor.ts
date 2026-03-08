/**
 * Performance Monitoring Middleware
 *
 * Tracks API response times and performance metrics.
 * Integrates with logging and alerting systems.
 *
 * HIPAA Compliance:
 * - No PHI in performance metrics
 * - User IDs anonymized/hashed for tracking
 */

import { NextRequest, NextResponse } from "next/server";
import { performance } from "perf_hooks";

// Performance thresholds in milliseconds
const THRESHOLDS = {
  WARNING: 200, // Log warning if response takes > 200ms
  ERROR: 1000, // Log error if response takes > 1000ms
  CRITICAL: 5000, // Log critical if response takes > 5000ms
};

// In-memory metrics storage (for development/testing)
interface RequestMetric {
  method: string;
  path: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
  userAgent?: string;
}

const metrics: RequestMetric[] = [];
const MAX_STORED_METRICS = 1000;

/**
 * Performance tracking options
 */
interface PerformanceOptions {
  /** Custom threshold for warnings (ms) */
  warningThreshold?: number;
  /** Custom threshold for errors (ms) */
  errorThreshold?: number;
  /** Include request body size in metrics */
  trackBodySize?: boolean;
  /** Skip tracking for these paths */
  skipPaths?: string[];
}

/**
 * Middleware wrapper that tracks performance metrics
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return withPerformanceTracking(request, async () => {
 *     // Your handler logic
 *     return NextResponse.json(data);
 *   });
 * }
 */
export async function withPerformanceTracking<T>(
  request: NextRequest,
  handler: () => Promise<NextResponse<T>>,
  options: PerformanceOptions = {}
): Promise<NextResponse<T>> {
  const {
    warningThreshold = THRESHOLDS.WARNING,
    errorThreshold = THRESHOLDS.ERROR,
    skipPaths = ["/health", "/api/health", "/_next"],
  } = options;

  const url = new URL(request.url);
  const path = url.pathname;

  // Skip tracking for certain paths
  if (skipPaths.some((skip) => path.startsWith(skip))) {
    return handler();
  }

  const startTime = performance.now();
  const method = request.method;

  try {
    const response = await handler();
    const duration = performance.now() - startTime;

    // Store metric
    storeMetric({
      method,
      path,
      duration,
      statusCode: response.status,
      timestamp: new Date(),
      userAgent: request.headers.get("user-agent") || undefined,
    });

    // Add performance headers to response
    response.headers.set("X-Response-Time", `${duration.toFixed(2)}ms`);

    // Log slow requests
    if (duration > errorThreshold) {
      console.error(`[Performance] SLOW REQUEST: ${method} ${path} took ${duration.toFixed(2)}ms`, {
        method,
        path,
        duration,
        statusCode: response.status,
      });
    } else if (duration > warningThreshold) {
      console.warn(`[Performance] Slow request: ${method} ${path} took ${duration.toFixed(2)}ms`);
    }

    return response;
  } catch (error) {
    const duration = performance.now() - startTime;

    console.error(`[Performance] ERROR: ${method} ${path} failed after ${duration.toFixed(2)}ms`, {
      method,
      path,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    throw error;
  }
}

/**
 * Store metric in memory (with cleanup)
 */
function storeMetric(metric: RequestMetric): void {
  metrics.push(metric);

  // Keep only recent metrics
  if (metrics.length > MAX_STORED_METRICS) {
    metrics.shift();
  }
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(timeWindowMs: number = 60000): {
  total: number;
  avgDuration: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  slowRequests: number;
} {
  const cutoff = Date.now() - timeWindowMs;
  const recentMetrics = metrics.filter((m) => m.timestamp.getTime() > cutoff);

  if (recentMetrics.length === 0) {
    return {
      total: 0,
      avgDuration: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      errorRate: 0,
      slowRequests: 0,
    };
  }

  const durations = recentMetrics.map((m) => m.duration).sort((a, b) => a - b);
  const total = durations.reduce((a, b) => a + b, 0);
  const avg = total / durations.length;

  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * durations.length) - 1;
    return durations[Math.max(0, index)];
  };

  const errors = recentMetrics.filter((m) => m.statusCode >= 500).length;
  const slow = recentMetrics.filter((m) => m.duration > THRESHOLDS.WARNING).length;

  return {
    total: recentMetrics.length,
    avgDuration: avg,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    errorRate: errors / recentMetrics.length,
    slowRequests: slow,
  };
}

/**
 * Get performance report for specific endpoint
 */
export function getEndpointPerformance(
  pathPattern: string,
  timeWindowMs: number = 3600000
): {
  path: string;
  total: number;
  avgDuration: number;
  p95: number;
} | null {
  const cutoff = Date.now() - timeWindowMs;
  const pattern = new RegExp(pathPattern);

  const matching = metrics.filter(
    (m) => pattern.test(m.path) && m.timestamp.getTime() > cutoff
  );

  if (matching.length === 0) {
    return null;
  }

  const durations = matching.map((m) => m.duration).sort((a, b) => a - b);
  const total = durations.reduce((a, b) => a + b, 0);

  return {
    path: pathPattern,
    total: matching.length,
    avgDuration: total / durations.length,
    p95: durations[Math.ceil(0.95 * durations.length) - 1],
  };
}

/**
 * Clear stored metrics
 */
export function clearMetrics(): void {
  metrics.length = 0;
}

/**
 * Health check endpoint data
 */
export function getHealthMetrics(): {
  status: "healthy" | "degraded" | "unhealthy";
  recentP95: number;
  errorRate: number;
  activeRequests: number;
} {
  const stats = getPerformanceStats(300000); // Last 5 minutes

  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (stats.errorRate > 0.1 || stats.p95 > THRESHOLDS.ERROR) {
    status = "unhealthy";
  } else if (stats.p95 > THRESHOLDS.WARNING) {
    status = "degraded";
  }

  return {
    status,
    recentP95: stats.p95,
    errorRate: stats.errorRate,
    activeRequests: stats.total,
  };
}

/**
 * Simple middleware for Next.js route handlers
 * Usage: export const GET = createPerformanceMiddleware(handler)
 */
export function createPerformanceMiddleware<T>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  options?: PerformanceOptions
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    return withPerformanceTracking(request, () => handler(request), options);
  };
}
