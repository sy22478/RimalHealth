/**
 * Audit Middleware
 * Automatically logs PHI access and modifications for HIPAA compliance
 * 
 * Features:
 * - Request context extraction
 * - Automatic PHI access logging
 * - Higher-order function for wrapping API handlers
 * - Break-glass emergency access support
 * - Next.js middleware integration
 * 
 * @module lib/audit/middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  auditLogger,
  auditPHIAccess,
  auditDataModification,
  auditLogin,
  auditLogout,
  auditLog,
} from './logger';
import {
  AuditContext,
  AuditEventType,
  PHIResourceType,
  DataModificationAction,
  PHIAccessMetadata,
  AuditSeverity,
  AuditMiddlewareOptions,
} from './types';
import { getClientIP, sanitizeMetadata } from './utils';

/**
 * Create audit context from request
 * Extracts IP, user agent, and generates request ID
 * 
 * @param request - Next.js request
 * @param userId - Optional user ID
 * @param userRole - Optional user role
 * @returns Audit context object
 */
export function createAuditContext(
  request: NextRequest,
  userId?: string,
  userRole?: string
): AuditContext {
  return {
    userId,
    userRole,
    ipAddress: getClientIP(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    requestId: crypto.randomUUID(),
  };
}

/**
 * Create audit context from headers
 * For use in server actions or where NextRequest is not available
 * 
 * @param headers - Request headers
 * @param userId - Optional user ID
 * @param userRole - Optional user role
 * @returns Audit context object
 */
export function createAuditContextFromHeaders(
  headers: Headers,
  userId?: string,
  userRole?: string
): AuditContext {
  return {
    userId,
    userRole,
    ipAddress: getClientIP(new Request('http://localhost', { headers })),
    userAgent: headers.get('user-agent') || 'unknown',
    requestId: crypto.randomUUID(),
  };
}

/**
 * Extract audit context from request
 * Helper function for extracting audit context from any request type
 * 
 * @param request - Standard Request or NextRequest
 * @param userId - Optional user ID
 * @param userRole - Optional user role
 * @returns Audit context object
 * 
 * @example
 * ```typescript
 * const context = extractAuditContext(request, user.id, user.role);
 * ```
 */
export function extractAuditContext(
  request: Request | NextRequest,
  userId?: string,
  userRole?: string
): AuditContext {
  const headers = request.headers;
  
  return {
    userId,
    userRole,
    ipAddress: getClientIP(request),
    userAgent: headers.get('user-agent') || 'unknown',
    requestId: crypto.randomUUID(),
  };
}

/**
 * Middleware to audit PHI access
 * Call this after authentication in API routes
 * 
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const user = await authenticate(request);
 *   await auditMiddleware(request, user.id, 'PatientProfile', patientId, 'view');
 *   // ... fetch and return data
 * }
 * ```
 */
export async function auditMiddleware(
  request: NextRequest,
  userId: string,
  resourceType: PHIResourceType | string,
  resourceId: string,
  action: string,
  metadata?: PHIAccessMetadata
): Promise<void> {
  const context = createAuditContext(request, userId);
  await auditPHIAccess(userId, resourceType, resourceId, action, context, metadata);
}

/**
 * Middleware to audit PHI access with user role
 */
export async function auditMiddlewareWithRole(
  request: NextRequest,
  userId: string,
  userRole: string,
  resourceType: PHIResourceType | string,
  resourceId: string,
  action: string,
  metadata?: PHIAccessMetadata
): Promise<void> {
  const context = createAuditContext(request, userId, userRole);
  await auditPHIAccess(userId, resourceType, resourceId, action, context, metadata);
}

/**
 * Higher-order function to wrap API handlers with automatic audit logging
 * 
 * This is the main middleware function for API routes that automatically logs
 * PHI access before executing the handler.
 * 
 * @param handler - API route handler function
 * @param options - Audit logging options
 * @returns Wrapped handler with audit logging
 * 
 * @example
 * ```typescript
 * import { withAuditLogging } from '@/lib/audit';
 * 
 * export const GET = withAuditLogging(
 *   async (request: Request, { params }: { params: { id: string } }) => {
 *     const patient = await prisma.patientProfile.findUnique({ 
 *       where: { userId: params.id } 
 *     });
 *     return NextResponse.json(patient);
 *   },
 *   {
 *     resourceType: 'PatientProfile',
 *     action: 'VIEW',
 *     getResourceId: (req, params) => params.id,
 *   }
 * );
 * ```
 */
export function withAuditLogging<T extends (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>>(
  handler: T,
  options: {
    resourceType: PHIResourceType | string;
    action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE';
    getResourceId?: (request: NextRequest, params?: Record<string, string>) => string | undefined;
    getUserId?: (request: NextRequest) => Promise<string | undefined>;
    getUserRole?: (request: NextRequest) => Promise<string | undefined>;
    metadata?: PHIAccessMetadata;
  }
) {
  return (async (request: NextRequest, context: { params: Promise<Record<string, string>> }): Promise<Response> => {
    const params = await context?.params;
    
    // Get user info if available
    let userId: string | undefined;
    let userRole: string | undefined;
    
    if (options.getUserId) {
      userId = await options.getUserId(request);
    }
    if (options.getUserRole) {
      userRole = await options.getUserRole(request);
    }
    
    // Create audit context
    const auditContext = extractAuditContext(request, userId, userRole);
    
    // Get resource ID
    const resourceId = options.getResourceId?.(request, params) || 
                       params?.id || 
                       'unknown';
    
    // Log the access before executing handler (for read operations)
    if (userId && options.action === 'VIEW') {
      await auditLogger.logPHIAccess(
        options.action,
        userId,
        userRole || 'unknown',
        options.resourceType,
        resourceId,
        auditContext,
        options.metadata
      );
    }
    
    // Execute the handler
    let response: Response;
    let error: Error | undefined;
    
    try {
      response = await handler(request, context);
    } catch (e) {
      error = e as Error;
      response = new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Log modification operations after successful execution
    if (userId && options.action !== 'VIEW' && response.status >= 200 && response.status < 300) {
      await auditLogger.logPHIAccess(
        options.action,
        userId,
        userRole || 'unknown',
        options.resourceType,
        resourceId,
        auditContext,
        options.metadata
      );
    }
    
    // Log failed operations
    if (error || (response.status >= 400 && userId)) {
      await auditLogger.log({
        eventType: AuditEventType.PATIENT_DATA_VIEWED,
        userId,
        userRole,
        resourceType: options.resourceType,
        resourceId,
        action: `${options.action}_FAILED`,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: false,
        severity: AuditSeverity.WARNING,
        errorMessage: error?.message || `HTTP ${response.status}`,
        timestamp: new Date(),
      });
    }
    
    if (error) {
      throw error;
    }
    
    return response;
  }) as T;
}

/**
 * Create Next.js middleware for audit logging
 * This integrates with Next.js middleware chain
 * 
 * @param options - Middleware configuration options
 * @returns Next.js middleware function
 * 
 * @example
 * ```typescript
 * // middleware.ts
 * import { createAuditMiddleware } from '@/lib/audit';
 * 
 * export const middleware = createAuditMiddleware({
 *   logAllRequests: true,
 *   excludePaths: ['/api/health', '/_next'],
 * });
 * ```
 */
export function createAuditMiddleware(
  options: AuditMiddlewareOptions = {}
): (request: NextRequest) => Promise<NextResponse | void> {
  const {
    logAllRequests = false,
    excludePaths = [],
    phiPaths = ['/api/patients', '/api/intake', '/api/prescriptions', '/api/messages'],
    getUserFromRequest,
  } = options;

  return async (request: NextRequest): Promise<NextResponse | void> => {
    const pathname = request.nextUrl.pathname;
    
    // Skip excluded paths
    if (excludePaths.some(path => pathname.startsWith(path))) {
      return;
    }
    
    // Check if this is a PHI path that should be logged
    const isPHIPath = phiPaths.some(path => pathname.startsWith(path));
    
    if (!isPHIPath && !logAllRequests) {
      return;
    }
    
    // Get user info if available
    let userId: string | undefined;
    let userRole: string | undefined;
    
    if (getUserFromRequest) {
      const user = await getUserFromRequest(request);
      userId = user?.id;
      userRole = user?.role;
    }
    
    // Create audit context
    const auditContext = createAuditContext(request, userId, userRole);
    
    // Log the request
    if (isPHIPath && userId) {
      await auditLogger.log({
        eventType: AuditEventType.PATIENT_DATA_VIEWED,
        userId,
        userRole,
        resourceType: 'API_REQUEST',
        resourceId: pathname,
        action: `${request.method} ${pathname}`,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: true,
        metadata: {
          isPHIPath: true,
          queryParams: Object.fromEntries(request.nextUrl.searchParams),
        },
        timestamp: new Date(),
      });
    } else if (logAllRequests) {
      // Log non-PHI requests if enabled
      await auditLogger.log({
        eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
        userId,
        userRole,
        resourceType: 'API_REQUEST',
        resourceId: pathname,
        action: `${request.method} ${pathname}`,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: true,
        severity: AuditSeverity.INFO,
        metadata: {
          isPHIPath: false,
        },
        timestamp: new Date(),
      });
    }
    
    // Return void to allow chain to continue
    return;
  };
}

/**
 * Middleware for data modification endpoints
 * Automatically logs CREATE, UPDATE, DELETE operations
 */
export function withAuditLoggingForModification(
  resourceType: PHIResourceType | string,
  action: DataModificationAction,
  handler: (request: NextRequest, context: { params: Record<string, string> }) => Promise<NextResponse>,
  options: {
    getResourceId?: (context: { params: Record<string, string> }) => string;
    getUserId?: (request: NextRequest) => Promise<string | undefined>;
    getTargetUserId?: (request: NextRequest) => Promise<string | undefined>;
    getUserRole?: (request: NextRequest) => Promise<string | undefined>;
  } = {}
) {
  return async (
    request: NextRequest,
    context: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    let userId: string | undefined;
    let userRole: string | undefined;
    let targetUserId: string | undefined;
    
    if (options.getUserId) {
      userId = await options.getUserId(request);
    }
    if (options.getUserRole) {
      userRole = await options.getUserRole(request);
    }
    if (options.getTargetUserId) {
      targetUserId = await options.getTargetUserId(request);
    }
    
    const auditContext = createAuditContext(request, userId, userRole);
    const resourceId = options.getResourceId?.(context) || context.params.id || 'unknown';
    
    // Execute handler first to see if it succeeds
    let response: NextResponse;
    let error: Error | undefined;
    
    try {
      response = await handler(request, context);
    } catch (e) {
      error = e as Error;
      response = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
    
    // Log modification after execution (success or failure)
    if (userId) {
      const success = response.status >= 200 && response.status < 300;
      
      await auditDataModification(
        userId,
        targetUserId,
        resourceType,
        resourceId,
        action,
        auditContext,
        {
          action,
          reason: success ? undefined : error?.message,
        }
      );
    }
    
    if (error) {
      throw error;
    }
    
    return response;
  };
}

/**
 * Middleware specifically for authentication endpoints
 * Logs login attempts (success and failure)
 */
export function withAuthAuditLogging(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    getUserId?: (request: NextRequest) => Promise<string | undefined>;
    eventType: 'login' | 'logout';
  }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const auditContext = createAuditContext(request);
    
    // Execute handler
    let response: NextResponse;
    let error: Error | undefined;
    
    try {
      response = await handler(request);
    } catch (e) {
      error = e as Error;
      response = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
    
    // Log authentication event
    const success = response.status >= 200 && response.status < 300;
    
    if (options.getUserId) {
      const userId = await options.getUserId(request);
      
      if (options.eventType === 'login') {
        await auditLogin(userId, success, auditContext);
      } else if (options.eventType === 'logout' && userId) {
        await auditLogout(userId, auditContext);
      }
    }
    
    if (error) {
      throw error;
    }
    
    return response;
  };
}

/**
 * Helper to extract user ID from JWT token in request
 * Use this with the audit middleware functions
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | undefined> {
  // Get token from Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return undefined;
  }
  
  const token = authHeader.slice(7);
  
  try {
    // This would typically verify the JWT and extract the user ID
    // For now, returning undefined - implement based on your JWT setup
    // const payload = await verifyJWT(token);
    // return payload.userId;
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Audit helper for server actions
 * Use this in server actions to create audit context
 */
export async function auditServerAction(
  eventType: AuditEventType,
  userId: string,
  data: {
    targetUserId?: string;
    resourceType?: string;
    resourceId?: string;
    action: string;
    metadata?: Record<string, unknown>;
    success?: boolean;
    errorMessage?: string;
  }
): Promise<void> {
  // For server actions, we need to get headers differently
  const headersList = await import('next/headers').then(mod => mod.headers());
  
  const context = createAuditContextFromHeaders(
    new Headers(headersList),
    userId
  );
  
  await auditLogger.log({
    eventType,
    userId,
    targetUserId: data.targetUserId,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    action: data.action,
    metadata: sanitizeMetadata(data.metadata),
    success: data.success ?? true,
    errorMessage: data.errorMessage,
    severity: data.success === false ? AuditSeverity.WARNING : AuditSeverity.INFO,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    timestamp: new Date(),
  });
}

/**
 * Break-glass emergency access logging
 * For emergency situations where normal access controls are bypassed
 * These events are always logged as CRITICAL severity
 */
export async function auditBreakGlassAccess(
  request: NextRequest,
  userId: string,
  userRole: string,
  resourceType: PHIResourceType | string,
  resourceId: string,
  reason: string,
  authorizedBy?: string
): Promise<void> {
  const context = createAuditContext(request, userId, userRole);
  
  await auditPHIAccess(
    userId,
    resourceType,
    resourceId,
    'BREAK_GLASS_EMERGENCY_ACCESS',
    context,
    {
      accessReason: reason,
      emergencyAccess: true,
      breakGlass: true,
      authorizedBy,
    }
  );
  
  // Also log a separate critical event
  await auditLogger.log({
    eventType: AuditEventType.PATIENT_DATA_VIEWED,
    userId,
    targetUserId: resourceId,
    userRole,
    resourceType,
    resourceId,
    action: 'BREAK_GLASS_EMERGENCY_ACCESS',
    severity: AuditSeverity.CRITICAL,
    metadata: {
      reason,
      authorizedBy,
      emergencyAccess: true,
      breakGlass: true,
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    success: true,
    timestamp: new Date(),
  });
}

/**
 * Batch audit logging helper
 * For operations that access multiple resources at once
 */
export async function auditBatchPHIAccess(
  request: NextRequest,
  userId: string,
  userRole: string,
  accesses: Array<{
    resourceType: PHIResourceType | string;
    resourceId: string;
    action: string;
    metadata?: PHIAccessMetadata;
  }>
): Promise<void> {
  const context = createAuditContext(request, userId, userRole);
  
  // Log all accesses concurrently
  await Promise.all(
    accesses.map(access =>
      auditPHIAccess(
        userId,
        access.resourceType,
        access.resourceId,
        access.action,
        context,
        access.metadata
      )
    )
  );
}

/**
 * Wrap an API route handler with automatic PHI access logging
 * Simplified version with minimal configuration
 * 
 * @example
 * ```typescript
 * // app/api/patients/[id]/route.ts
 * import { withPHIAudit } from '@/lib/audit';
 * 
 * export const GET = withPHIAudit(
 *   async (request, { params }) => {
 *     const patient = await getPatient(params.id);
 *     return NextResponse.json(patient);
 *   },
 *   PHIResourceType.PATIENT_PROFILE,
 *   'VIEW'
 * );
 * ```
 */
export function withPHIAudit(
  handler: (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<NextResponse>,
  resourceType: PHIResourceType,
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE',
  options: {
    getResourceId?: (params: Record<string, string>) => string;
    getUserId?: (request: NextRequest) => Promise<string | undefined>;
    getUserRole?: (request: NextRequest) => Promise<string | undefined>;
  } = {}
) {
  return withAuditLogging(handler, {
    resourceType,
    action,
    getResourceId: options.getResourceId 
      ? (_, params) => options.getResourceId!(params!)
      : (_, params) => params?.id,
    getUserId: options.getUserId,
    getUserRole: options.getUserRole,
  });
}
