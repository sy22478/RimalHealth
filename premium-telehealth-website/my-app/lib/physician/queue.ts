/**
 * Physician Queue Data Utilities
 * Data fetching and processing for patient queue
 * 
 * HIPAA Compliance:
 * - All PHI access is audited
 * - No PHI in logs or error messages
 * - Encrypted fields decrypted only when needed
 * 
 * @module lib/physician/queue
 */

import { prisma } from '@/lib/db/prisma';
import { IntakeStatus, Role } from '@prisma/client';
import { auditLogger, AuditContext } from '@/lib/audit';
import { AuditEventType, PHIResourceType } from '@/lib/audit/types';
import {
  QueueItem,
  QueueStats,
  QueueFilters,
  ConcernType,
  QueueIntakeStatus,
} from '@/types/physician-queue';
import { decryptPHI } from '@/lib/encryption/phi';

/**
 * Calculate age from date of birth
 * Returns age in years
 */
function calculateAge(dateOfBirth: string | Date): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Calculate wait time in hours
 */
function calculateWaitTime(submittedAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - submittedAt.getTime();
  return diffMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Map database concern type to queue concern type
 * Note: Only ALCOHOL is actively used. SMOKING and BOTH are discontinued.
 */
function mapConcernType(dbConcernType: string): ConcernType {
  const upperType = dbConcernType.toUpperCase();
  if (upperType === 'ALCOHOL') return 'ALCOHOL';
  // SMOKING and BOTH are discontinued but may exist in legacy records
  if (upperType === 'SMOKING') return 'SMOKING';
  if (upperType === 'BOTH') return 'BOTH';
  return 'ALCOHOL';
}

/**
 * Map database status to queue status
 */
function mapQueueStatus(dbStatus: IntakeStatus): QueueIntakeStatus | null {
  if (dbStatus === IntakeStatus.SUBMITTED) return 'SUBMITTED';
  if (dbStatus === IntakeStatus.UNDER_REVIEW) return 'UNDER_REVIEW';
  return null; // Other statuses not shown in queue
}

/**
 * Get pending intakes for physician queue
 * Returns intakes with status SUBMITTED or UNDER_REVIEW
 * 
 * @param physicianId - ID of requesting physician (for audit)
 * @param context - Audit context for logging
 * @param filters - Optional filters for the queue
 * @returns Array of queue items sorted by submission time (newest first by default)
 */
export async function getPendingIntakes(
  physicianId: string,
  context: AuditContext,
  filters?: Partial<QueueFilters>
): Promise<QueueItem[]> {
  // Build where clause based on filters
  const where: Record<string, unknown> = {
    status: {
      in: [IntakeStatus.SUBMITTED, IntakeStatus.UNDER_REVIEW],
    },
  };

  // Apply status filter if specified
  if (filters?.status && filters.status !== 'ALL') {
    const statusMap: Record<QueueIntakeStatus, IntakeStatus> = {
      SUBMITTED: IntakeStatus.SUBMITTED,
      UNDER_REVIEW: IntakeStatus.UNDER_REVIEW,
    };
    where.status = statusMap[filters.status];
  }

  // Apply concern type filter if specified
  if (filters?.concernType && filters.concernType !== 'ALL') {
    where.patient = {
      patientProfile: {
        primaryConcern: {
          contains: filters.concernType,
          mode: 'insensitive',
        },
      },
    };
  }

  try {
    // Fetch pending intakes with patient data
    const intakes = await prisma.intake.findMany({
      where,
      include: {
        patient: {
          include: {
            patientProfile: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc', // Newest first (new patients on top)
      },
    });

    // Transform to queue items
    let queueItems: QueueItem[] = intakes.map(intake => {
      const profile = intake.patient.patientProfile;
      const submittedAt = intake.submittedAt || new Date();
      const waitTimeHours = calculateWaitTime(submittedAt);

      // Decrypt PHI fields
      // NOTE: Manual decryption is required here because the Prisma encryption
      // extension only auto-decrypts fields on the top-level queried model (Intake).
      // Nested included relations (patient.patientProfile) are not auto-decrypted.
      let patientName = 'Unknown';
      let patientAge = 0;
      let concernType: ConcernType = 'ALCOHOL';

      try {
        if (profile) {
          const firstName = profile.firstName
            ? decryptPHI(profile.firstName)
            : '';
          const lastName = profile.lastName
            ? decryptPHI(profile.lastName)
            : '';
          patientName = `${firstName} ${lastName}`.trim() || 'Unknown';

          if (profile.dateOfBirth) {
            const dob = decryptPHI(profile.dateOfBirth);
            patientAge = calculateAge(dob);
          }

          // primaryConcern is a ConcernType enum, not an encrypted string
          if (profile.primaryConcern) {
            concernType = mapConcernType(profile.primaryConcern);
          }
        }
      } catch (decryptError) {
        // Log decryption failure but continue with placeholder
        console.error('Failed to decrypt PHI for intake:', intake.id);
      }

      const queueStatus = mapQueueStatus(intake.status);
      if (!queueStatus) {
        // This shouldn't happen due to where clause, but handle gracefully
        return null as unknown as QueueItem;
      }

      return {
        intakeId: intake.id,
        patientId: intake.patientId,
        patientName,
        patientAge,
        concernType,
        status: queueStatus,
        submittedAt: submittedAt.toISOString(),
        waitTimeHours: Math.round(waitTimeHours * 10) / 10,
        isOverdue: waitTimeHours > 24,
        riskScore: intake.riskScore || undefined,
        isDeactivated: !!intake.patient.deactivatedAt,
      };
    }).filter(Boolean); // Remove any null items

    // Apply search filter if specified
    if (filters?.searchQuery && filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      queueItems = queueItems.filter(item =>
        item.patientName.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sortBy = filters?.sortBy || 'submittedAt';
    const sortOrder = filters?.sortOrder || 'desc';

    queueItems.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'submittedAt':
          comparison = new Date(a.submittedAt).getTime() - 
                      new Date(b.submittedAt).getTime();
          break;
        case 'waitTimeHours':
          comparison = a.waitTimeHours - b.waitTimeHours;
          break;
        case 'patientName':
          comparison = (a.patientName || '').localeCompare(b.patientName || '');
          break;
        case 'riskScore':
          comparison = (a.riskScore || 0) - (b.riskScore || 0);
          break;
        default:
          comparison = new Date(a.submittedAt).getTime() - 
                      new Date(b.submittedAt).getTime();
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Log PHI access for audit
    await auditLogger.logPHIAccess(
      'VIEW',
      physicianId,
      Role.PHYSICIAN,
      PHIResourceType.INTAKE,
      'queue-list',
      context,
      {
        recordCount: queueItems.length,
      }
    );

    return queueItems;
  } catch (error) {
    // Log error without PHI
    console.error('Error fetching pending intakes:', {
      physicianId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get queue statistics
 * Returns summary counts for dashboard header
 * 
 * @param physicianId - ID of requesting physician (for audit)
 * @param context - Audit context for logging
 * @returns Queue statistics
 */
export async function getQueueStats(
  physicianId: string,
  context: AuditContext
): Promise<QueueStats> {
  try {
    const [totalPending, overdueCount, underReviewCount, newlySubmittedCount] = 
      await Promise.all([
        // Total pending
        prisma.intake.count({
          where: {
            status: {
              in: [IntakeStatus.SUBMITTED, IntakeStatus.UNDER_REVIEW],
            },
          },
        }),

        // Overdue (>24 hours)
        prisma.intake.count({
          where: {
            status: {
              in: [IntakeStatus.SUBMITTED, IntakeStatus.UNDER_REVIEW],
            },
            submittedAt: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        }),

        // Under review
        prisma.intake.count({
          where: {
            status: IntakeStatus.UNDER_REVIEW,
          },
        }),

        // Newly submitted (within last hour)
        prisma.intake.count({
          where: {
            status: IntakeStatus.SUBMITTED,
            submittedAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000),
            },
          },
        }),
      ]);

    return {
      totalPending,
      overdueCount,
      underReviewCount,
      newlySubmittedCount,
    };
  } catch (error) {
    console.error('Error fetching queue stats:', {
      physicianId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Mock data for development without database
 */
export function getMockQueueData(): QueueItem[] {
  const now = new Date();
  
  return [
    {
      intakeId: 'intake-001',
      patientId: 'patient-001',
      patientName: 'John Smith',
      patientAge: 34,
      concernType: 'ALCOHOL',
      status: 'SUBMITTED',
      submittedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
      waitTimeHours: 25,
      isOverdue: true,
      riskScore: 65,
    },
    {
      intakeId: 'intake-002',
      patientId: 'patient-002',
      patientName: 'Sarah Johnson',
      patientAge: 28,
      concernType: 'ALCOHOL',
      status: 'SUBMITTED',
      submittedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      waitTimeHours: 12,
      isOverdue: false,
      riskScore: 35,
    },
    {
      intakeId: 'intake-003',
      patientId: 'patient-003',
      patientName: 'Michael Brown',
      patientAge: 45,
      concernType: 'ALCOHOL',
      status: 'UNDER_REVIEW',
      submittedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
      waitTimeHours: 48,
      isOverdue: true,
      riskScore: 82,
    },
    {
      intakeId: 'intake-004',
      patientId: 'patient-004',
      patientName: 'Emily Davis',
      patientAge: 52,
      concernType: 'ALCOHOL',
      status: 'SUBMITTED',
      submittedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      waitTimeHours: 3,
      isOverdue: false,
      riskScore: 45,
    },
    {
      intakeId: 'intake-005',
      patientId: 'patient-005',
      patientName: 'Robert Wilson',
      patientAge: 39,
      concernType: 'ALCOHOL',
      status: 'SUBMITTED',
      submittedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      waitTimeHours: 0.5,
      isOverdue: false,
      riskScore: undefined,
    },
  ];
}

/**
 * Get mock queue stats
 */
export function getMockQueueStats(): QueueStats {
  return {
    totalPending: 5,
    overdueCount: 2,
    underReviewCount: 1,
    newlySubmittedCount: 1,
  };
}
