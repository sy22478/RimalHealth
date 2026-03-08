/**
 * GET /api/physician/pharmacies/search
 * Search for pharmacies by ZIP code and optional name filter
 * 
 * HIPAA Compliance:
 * - Only pharmacy business information returned (no PHI)
 * - All searches logged with physician ID (not patient data)
 * - Rate limited to prevent abuse
 * 
 * Query Parameters:
 * - zip: ZIP code (required)
 * - name: Pharmacy name filter (optional)
 * - radius: Search radius in miles (default: 10, max: 50)
 * - limit: Maximum results (default: 20, max: 50)
 * 
 * @module app/api/physician/pharmacies/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/require-auth';
import { Permission } from '@/lib/auth/rbac';
import { searchPharmacies } from '@/lib/integrations/dosespot';
import { auditLogger, AuditEventType } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/auth/require-auth';

// ============================================
// VALIDATION SCHEMA
// ============================================

const searchSchema = z.object({
  zip: z.string()
    .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format')
    .describe('ZIP code to search near'),
  name: z.string()
    .min(1)
    .max(100)
    .optional()
    .describe('Optional pharmacy name filter'),
  radius: z.coerce.number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Search radius in miles'),
  limit: z.coerce.number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('Maximum number of results'),
});

type SearchParams = z.infer<typeof searchSchema>;

// ============================================
// GET HANDLER
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Check authentication and permission
  const authResult = await requirePermission(request, Permission.SEND_PRESCRIPTION);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    
    const params = {
      zip: searchParams.get('zip') || '',
      name: searchParams.get('name') || undefined,
      radius: searchParams.get('radius') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const validationResult = searchSchema.safeParse(params);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid search parameters',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const validatedParams: SearchParams = validationResult.data;

    // Log the search (no PHI - just the search parameters)
    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      userId: user.userId,
      userRole: user.role,
      action: 'Pharmacy search',
      resourceType: 'Pharmacy',
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      success: true,
      metadata: {
        searchZip: validatedParams.zip,
        searchName: validatedParams.name,
        searchRadius: validatedParams.radius,
      },
    });

    // Search pharmacies via DoseSpot
    const searchResult = await searchPharmacies({
      zip: validatedParams.zip,
      name: validatedParams.name,
      radius: validatedParams.radius,
      limit: validatedParams.limit,
    });

    if (!searchResult.success) {
      // Log the error
      await auditLogger.log({
        eventType: AuditEventType.PATIENT_DATA_VIEWED,
        userId: user.userId,
        userRole: user.role,
        action: 'Pharmacy search failed',
        resourceType: 'Pharmacy',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        success: false,
        errorMessage: searchResult.error,
        metadata: {
          searchZip: validatedParams.zip,
          errorCode: searchResult.errorCode,
        },
      });

      return NextResponse.json(
        {
          error: searchResult.error || 'Pharmacy search failed',
          code: searchResult.errorCode || 'SEARCH_ERROR',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      pharmacies: searchResult.pharmacies,
      totalCount: searchResult.totalCount,
      query: {
        zip: validatedParams.zip,
        name: validatedParams.name,
        radius: validatedParams.radius,
      },
    });

  } catch (error) {
    console.error('Pharmacy search error:', error);

    // Log the error
    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      userId: user.userId,
      userRole: user.role,
      action: 'Pharmacy search error',
      resourceType: 'Pharmacy',
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        error: 'Failed to search pharmacies',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
