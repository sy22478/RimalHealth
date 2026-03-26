/**
 * Prisma Client Singleton with Performance Optimizations
 *
 * This file provides a singleton instance of the PrismaClient to ensure
 * efficient connection pooling and prevent multiple instances in development.
 *
 * Performance Features:
 * - Query logging in development for debugging
 * - Connection pooling configuration
 * - Query performance monitoring
 * - Automatic query batching hints
 *
 * For AWS deployment:
 * - Use RDS Proxy for connection pooling in production
 * - Configure appropriate connection limits based on RDS instance size
 * - Enable SSL for secure connections to RDS
 *
 * HIPAA Compliance:
 * - Client extension automatically encrypts/decrypts PHI fields
 * - All PHI is encrypted at rest using AES-256-GCM
 * - See lib/encryption/phi.ts for encryption implementation
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createEncryptionExtension } from "./encryption-extension";

// Global type declaration for hot reload support
declare global {
  // eslint-disable-next-line no-var
  var __prismaBase: PrismaClient | undefined;
}

// Query performance tracking type
interface QueryMetrics {
  query: string;
  params: string;
  duration: number;
  timestamp: Date;
}

// Performance monitoring storage (development only)
const queryMetrics: QueryMetrics[] = [];
const MAX_METRICS_STORED = 100;

/**
 * Log slow queries in development for optimization
 */
function logSlowQuery(query: string, params: string, duration: number): void {
  if (process.env.NODE_ENV === "development" && duration > 50) {
    console.warn(`[Prisma Slow Query] ${duration.toFixed(2)}ms:`, query);

    // Store metrics for analysis
    queryMetrics.push({
      query: query.substring(0, 200), // Truncate long queries
      params: params.substring(0, 100),
      duration,
      timestamp: new Date(),
    });

    // Keep only recent metrics
    if (queryMetrics.length > MAX_METRICS_STORED) {
      queryMetrics.shift();
    }
  }
}

/**
 * Get query performance metrics (development only)
 */
export function getQueryMetrics(): QueryMetrics[] {
  return [...queryMetrics];
}

/**
 * Clear query performance metrics
 */
export function clearQueryMetrics(): void {
  queryMetrics.length = 0;
}

/**
 * Get query statistics summary
 */
export function getQueryStats(): {
  totalQueries: number;
  avgDuration: number;
  slowQueries: number;
  slowThreshold: number;
} {
  if (queryMetrics.length === 0) {
    return {
      totalQueries: 0,
      avgDuration: 0,
      slowQueries: 0,
      slowThreshold: 50,
    };
  }

  const total = queryMetrics.reduce((sum, m) => sum + m.duration, 0);
  const slow = queryMetrics.filter((m) => m.duration > 50).length;

  return {
    totalQueries: queryMetrics.length,
    avgDuration: total / queryMetrics.length,
    slowQueries: slow,
    slowThreshold: 50,
  };
}

// Create PostgreSQL connection pool
//
// PRODUCTION NOTE (Neon Serverless):
// For serverless environments (e.g., Netlify Functions), the DATABASE_URL
// should use Neon's pooled connection endpoint with the `-pooler` suffix.
// Example: postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require
// The `-pooler` suffix routes connections through Neon's built-in PgBouncer
// proxy, which is critical for serverless workloads where each request may
// open a new connection. Without it, cold starts can exhaust the direct
// connection limit quickly.
//
// Non-pooler (direct) connections should only be used for migrations and
// Prisma Studio: postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname
//
const connectionString = process.env.DATABASE_URL;

// Lazy initialization of PrismaClient
// This prevents connection attempts during build time
let prismaBaseInstance: PrismaClient | null = null;
let prismaExtendedInstance: PrismaClient | null = null;

/**
 * Create the base Prisma client without extensions
 */
function createBasePrismaClient(): PrismaClient {
  const dbUrl = connectionString || 'postgresql://localhost:5432/dummy';
  const pool = new Pool({
    connectionString: dbUrl,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
  const adapter = new PrismaPg(pool);
  
  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "warn" },
          ]
        : [{ emit: "stdout", level: "error" }],
  });
  
  // Attach query performance monitoring in development
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).$on?.("query", (e: { query: string; params: string; duration: number }) => {
      logSlowQuery(e.query, e.params, e.duration);
    });
  }
  
  return client;
}

/**
 * Create the extended Prisma client with encryption
 */
function createExtendedPrismaClient(): PrismaClient {
  if (!prismaBaseInstance) {
    prismaBaseInstance = createBasePrismaClient();
  }
  // Apply encryption extension for PHI fields
  // The $extends method returns an extended client with encryption
  return prismaBaseInstance.$extends(createEncryptionExtension()) as unknown as PrismaClient;
}

/**
 * Get or create the Prisma client instance with encryption extension
 * This is the recommended way to access the client for PHI-safe operations
 */
export function getPrisma(): PrismaClient {
  if (!prismaExtendedInstance) {
    prismaExtendedInstance = createExtendedPrismaClient();
  }
  return prismaExtendedInstance;
}

/**
 * Get the base Prisma client (without encryption extension)
 * Use only when you need raw access without encryption/decryption
 * WARNING: This bypasses PHI encryption - use with caution!
 */
export function getBasePrisma(): PrismaClient {
  if (!prismaBaseInstance) {
    prismaBaseInstance = createBasePrismaClient();
  }
  return prismaBaseInstance;
}

/**
 * Check if we're in a build environment where DB access isn't available
 */
function isBuildTime(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build' || 
         process.env.NEXT_PHASE === 'phase-export' ||
         process.env.NEXT_PHASE === 'phase-generate-static-params' ||
         process.env.NEXT_PHASE === 'phase-development-static-generation';
}

/**
 * Build-time safe proxy that returns mock during build
 * and properly bound methods at runtime
 */
function createBuildSafeProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      // During build time, return a mock that prevents actual DB calls
      if (isBuildTime()) {
        const mockFn = () => Promise.resolve({});
        // For $ methods, return a mock function
        if (typeof prop === 'string' && prop.startsWith('$')) {
          return mockFn;
        }
        // For model methods, return an object with CRUD methods
        if (typeof prop === 'string' && !prop.startsWith('_')) {
          return {
            findUnique: mockFn,
            findFirst: mockFn,
            findMany: mockFn,
            create: mockFn,
            update: mockFn,
            upsert: mockFn,
            delete: mockFn,
            count: mockFn,
            aggregate: mockFn,
            groupBy: mockFn,
          };
        }
        return undefined;
      }

      // Runtime: initialize if needed
      if (!prismaExtendedInstance) {
        prismaExtendedInstance = createExtendedPrismaClient();
      }

      const value = prismaExtendedInstance[prop as keyof PrismaClient];
      
      // Bind methods to the instance to preserve `this` context
      if (typeof value === 'function') {
        return value.bind(prismaExtendedInstance);
      }
      
      return value;
    },
  });
}

/**
 * Prisma client export - uses proxy for lazy initialization
 * 
 * Note: For build-time safety, this returns mock objects during static generation.
 * For actual database operations, use getPrisma() or ensure you're in a request context.
 */
export const prisma: PrismaClient = createBuildSafeProxy();

/**
 * Disconnect Prisma client
 * Call this when shutting down the application
 */
export async function disconnectPrisma(): Promise<void> {
  // Disconnect base instance (which also handles extended)
  if (prismaBaseInstance) {
    await prismaBaseInstance.$disconnect();
    prismaBaseInstance = null;
    prismaExtendedInstance = null;
  }
}

/**
 * Connect Prisma client explicitly
 * Usually not needed as Prisma connects lazily, but useful for health checks
 */
export async function connectPrisma(): Promise<void> {
  const client = getPrisma();
  await client.$connect();
}

/**
 * Execute a batch of Prisma operations in a transaction
 * This improves performance by reducing round-trips
 */
export async function executeBatch<T>(
  operations: ((tx: PrismaClient) => Promise<T>)[]
): Promise<T[]> {
  const client = getPrisma();
  return await client.$transaction(async (tx) => {
    const results: T[] = [];
    for (const operation of operations) {
      results.push(await operation(tx as unknown as PrismaClient));
    }
    return results;
  });
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const start = performance.now();
  try {
    const client = getPrisma();
    await client.$queryRaw`SELECT 1`;
    return {
      healthy: true,
      latency: Math.round(performance.now() - start),
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Optimized query helper with field selection
 * Use this to ensure you're only fetching needed fields
 *
 * @example
 * const user = await selectFields(
 *   prisma.user.findUnique({ where: { id } }),
 *   { id: true, email: true, role: true }
 * );
 */
export function selectFields<T, K extends keyof T>(
  queryPromise: Promise<T | null>,
  _fieldSelection: Record<K, true>
): Promise<Pick<T, K> | null> {
  // This is a type helper - the actual field selection should be done in the query
  // This function serves as a reminder and type enforcer
  return queryPromise as Promise<Pick<T, K> | null>;
}

/**
 * Pagination helper for consistent pagination across the app
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function paginate<T>(
  query: { count: () => Promise<number>; findMany: (args: { skip: number; take: number }) => Promise<T[]> },
  params: PaginationParams = {}
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20)); // Max 100 items per page
  const skip = (page - 1) * limit;

  const [total, data] = await Promise.all([query.count(), query.findMany({ skip, take: limit })]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export default prisma;
