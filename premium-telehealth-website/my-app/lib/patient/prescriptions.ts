/**
 * Prescription Utilities
 * 
 * Server-side utilities for prescription management.
 * 
 * @module lib/patient/prescriptions
 */

import { prisma } from '@/lib/db/prisma';
import { PrescriptionStatus, RefillStatus } from '@prisma/client';
import { 
  Prescription, 
  PrescriptionSummary, 
  RefillRequest,
  canRequestRefill 
} from '@/types/prescriptions';
import { notificationQueue } from '@/lib/notifications/queue';
import { EmailTemplate } from '@/lib/notifications/templates';

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Get all prescriptions for a patient
 * 
 * @param patientId - The patient's user ID
 * @returns Array of prescription summaries
 */
export async function getPatientPrescriptions(patientId: string): Promise<PrescriptionSummary[]> {
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      medicationName: true,
      genericName: true,
      dosage: true,
      quantity: true,
      refills: true,
      refillsRemaining: true,
      // Surface instructions on the patient dashboard so the pending card can
      // show "Take once daily with food" etc. before the pharmacy is set.
      instructions: true,
      pharmacyName: true,
      pharmacyAddress: true,
      status: true,
      sentAt: true,
      lastRefillDate: true,
      nextRefillAvailable: true,
    },
  });

  return prescriptions;
}

/**
 * Get a single prescription by ID
 * Verifies the prescription belongs to the patient
 * 
 * @param prescriptionId - The prescription ID
 * @param patientId - The patient's user ID (for verification)
 * @returns The prescription or null if not found/unauthorized
 */
export async function getPrescriptionById(
  prescriptionId: string, 
  patientId: string
): Promise<Prescription | null> {
  const prescription = await prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      patientId,
    },
    select: {
      id: true,
      medicationName: true,
      genericName: true,
      dosage: true,
      quantity: true,
      refills: true,
      refillsRemaining: true,
      instructions: true,
      pharmacyName: true,
      pharmacyNcpdpId: true,
      pharmacyPhone: true,
      pharmacyAddress: true,
      status: true,
      lastRefillDate: true,
      nextRefillAvailable: true,
      sentAt: true,
      createdAt: true,
    },
  });

  return prescription as Prescription;
}

/**
 * Get recent refill requests for a prescription
 * 
 * @param prescriptionId - The prescription ID
 * @param patientId - The patient's user ID (for verification)
 * @param limit - Maximum number of requests to return (default: 5)
 * @returns Array of refill requests
 */
export async function getRecentRefillRequests(
  prescriptionId: string,
  patientId: string,
  limit: number = 5
): Promise<RefillRequest[]> {
  const requests = await prisma.refillRequest.findMany({
    where: {
      prescriptionId,
      patientId,
    },
    orderBy: { requestedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      prescriptionId: true,
      status: true,
      requestedAt: true,
      respondedAt: true,
    },
  });

  return requests;
}

/**
 * Check if there's a pending refill request for a prescription
 * 
 * @param prescriptionId - The prescription ID
 * @param patientId - The patient's user ID
 * @returns True if there's a pending request
 */
export async function hasPendingRefillRequest(
  prescriptionId: string,
  patientId: string
): Promise<boolean> {
  const count = await prisma.refillRequest.count({
    where: {
      prescriptionId,
      patientId,
      status: RefillStatus.PENDING,
    },
  });

  return count > 0;
}

// ============================================================================
// Refill Request Operations
// ============================================================================

export interface RefillRequestResult {
  success: boolean;
  refillRequest?: RefillRequest;
  error?: string;
  errorCode?: string;
}

/**
 * Create a refill request for a prescription
 * Validates eligibility and creates notification for physician
 * 
 * @param prescriptionId - The prescription ID
 * @param patientId - The patient's user ID
 * @param patientName - Patient's name for notifications
 * @returns Result of the refill request
 */
export async function createRefillRequest(
  prescriptionId: string,
  patientId: string,
  patientName: string
): Promise<RefillRequestResult> {
  // Get prescription details
  const prescription = await prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      patientId,
    },
    select: {
      id: true,
      medicationName: true,
      genericName: true,
      dosage: true,
      quantity: true,
      refillsRemaining: true,
      status: true,
      nextRefillAvailable: true,
      patientId: true,
    },
  });

  if (!prescription) {
    return {
      success: false,
      error: 'Prescription not found',
      errorCode: 'NOT_FOUND',
    };
  }

  // Check if eligible for refill
  if (!canRequestRefill(prescription)) {
    return {
      success: false,
      error: 'Prescription is not eligible for refill at this time',
      errorCode: 'NOT_ELIGIBLE',
    };
  }

  // Check if there's already a pending request
  const hasPending = await hasPendingRefillRequest(prescriptionId, patientId);
  if (hasPending) {
    return {
      success: false,
      error: 'A refill request is already pending for this prescription',
      errorCode: 'ALREADY_PENDING',
    };
  }

  // Create the refill request
  const refillRequest = await prisma.refillRequest.create({
    data: {
      prescriptionId,
      patientId,
      status: RefillStatus.PENDING,
    },
    select: {
      id: true,
      prescriptionId: true,
      status: true,
      requestedAt: true,
      respondedAt: true,
    },
  });

  // Get physician user ID for notification
  // In this system, all MDs see all patients, so we notify all active physicians
  // or a specific physician if assigned. For now, we'll queue a notification
  // that the notification processor will route appropriately.
  
  // Queue notification for physician
  try {
    await notificationQueue.add({
      type: 'email',
      priority: 'normal',
      payload: {
        to: 'physician@rimalhealth.com', // This will be resolved by the notification processor
        template: EmailTemplate.REFILL_REQUESTED,
        data: {
          prescriptionId: prescription.id,
          patientName,
          medicationName: prescription.medicationName,
          genericName: prescription.genericName,
          dosage: prescription.dosage,
          refillsRemaining: prescription.refillsRemaining.toString(),
        },
      },
    });
  } catch (error) {
    // Log but don't fail - the refill request was created successfully
    console.error('Failed to queue refill notification:', error instanceof Error ? error.message : 'Unknown error');
  }

  return {
    success: true,
    refillRequest,
  };
}

// ============================================================================
// Audit Logging
// ============================================================================

import { auditLog, AuditEventType } from '@/lib/audit';

/**
 * Audit log prescription access
 * 
 * @param patientId - The patient's user ID
 * @param prescriptionId - The prescription ID (optional for list access)
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 */
export async function auditPrescriptionAccess(
  patientId: string,
  prescriptionId: string | undefined,
  ipAddress: string,
  userAgent: string | null
): Promise<void> {
  await auditLog(
    AuditEventType.PRESCRIPTION_VIEWED,
    {
      userId: patientId,
      userRole: 'PATIENT',
      action: prescriptionId ? 'Viewed prescription details' : 'Listed prescriptions',
      resourceType: 'PRESCRIPTION',
      resourceId: prescriptionId,
      ipAddress,
      userAgent: userAgent || undefined,
      success: true,
    },
    { ipAddress, userAgent: userAgent || '', requestId: '' }
  );
}

/**
 * Audit log refill request
 * 
 * @param patientId - The patient's user ID
 * @param prescriptionId - The prescription ID
 * @param refillRequestId - The refill request ID
 * @param success - Whether the request was successful
 * @param errorMessage - Error message if failed
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 */
export async function auditRefillRequest(
  patientId: string,
  prescriptionId: string,
  refillRequestId: string | undefined,
  success: boolean,
  errorMessage: string | undefined,
  ipAddress: string,
  userAgent: string | null
): Promise<void> {
  await auditLog(
    AuditEventType.REFILL_REQUESTED,
    {
      userId: patientId,
      userRole: 'PATIENT',
      action: 'Requested prescription refill',
      resourceType: 'REFILL_REQUEST',
      resourceId: refillRequestId,
      targetUserId: prescriptionId,
      ipAddress,
      userAgent: userAgent || undefined,
      success,
      errorMessage,
    },
    { ipAddress, userAgent: userAgent || '', requestId: '' }
  );
}

// ============================================================================
// Mock Data for Development
// ============================================================================

/**
 * Get mock prescriptions for development without database
 */
export function getMockPrescriptions(): PrescriptionSummary[] {
  const now = new Date();
  
  return [
    {
      id: 'mock-prescription-1',
      medicationName: 'Naltrexone',
      genericName: 'Naltrexone HCl',
      dosage: '50mg once daily',
      quantity: 30,
      refills: 3,
      refillsRemaining: 2,
      pharmacyName: 'CVS Pharmacy - San Francisco',
      pharmacyAddress: '123 Main St, San Francisco, CA 94102',
      status: PrescriptionStatus.ACTIVE,
      sentAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      lastRefillDate: new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000),
      nextRefillAvailable: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'mock-prescription-2',
      medicationName: 'Varenicline',
      genericName: 'Varenicline Tartrate',
      dosage: '0.5mg once daily (week 1), then 1mg twice daily',
      quantity: 56,
      refills: 2,
      refillsRemaining: 2,
      pharmacyName: 'Walgreens - Los Angeles',
      pharmacyAddress: '456 Sunset Blvd, Los Angeles, CA 90028',
      status: PrescriptionStatus.SENT,
      sentAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      lastRefillDate: null,
      nextRefillAvailable: null,
    },
    {
      id: 'mock-prescription-3',
      medicationName: 'Disulfiram',
      genericName: 'Disulfiram',
      dosage: '250mg once daily',
      quantity: 30,
      refills: 5,
      refillsRemaining: 0,
      pharmacyName: 'CVS Pharmacy - San Francisco',
      pharmacyAddress: '123 Main St, San Francisco, CA 94102',
      status: PrescriptionStatus.COMPLETED,
      sentAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      lastRefillDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      nextRefillAvailable: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
    },
  ];
}

/**
 * Get mock prescription details
 */
export function getMockPrescriptionDetails(id: string): Prescription | null {
  const now = new Date();
  const mockPrescriptions: Record<string, Prescription> = {
    'mock-prescription-1': {
      id: 'mock-prescription-1',
      medicationName: 'Naltrexone',
      genericName: 'Naltrexone HCl',
      dosage: '50mg once daily',
      quantity: 30,
      refills: 3,
      refillsRemaining: 2,
      instructions: 'Take one tablet by mouth once daily. May take with food to reduce nausea. Do not take if you have used opioids in the past 7-10 days.',
      pharmacyName: 'CVS Pharmacy',
      pharmacyNcpdpId: '0564987',
      pharmacyPhone: '(415) 555-0123',
      pharmacyAddress: '123 Main St, San Francisco, CA 94102',
      status: PrescriptionStatus.ACTIVE,
      lastRefillDate: new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000),
      nextRefillAvailable: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      sentAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    },
    'mock-prescription-2': {
      id: 'mock-prescription-2',
      medicationName: 'Acamprosate',
      genericName: 'Acamprosate Calcium',
      dosage: '666mg three times daily',
      quantity: 180,
      refills: 2,
      refillsRemaining: 2,
      instructions: 'Take two 333mg tablets three times daily with meals. Maintain abstinence before starting.',
      pharmacyName: 'Walgreens',
      pharmacyNcpdpId: '0123456',
      pharmacyPhone: '(213) 555-0456',
      pharmacyAddress: '456 Sunset Blvd, Los Angeles, CA 90028',
      status: PrescriptionStatus.SENT,
      lastRefillDate: null,
      nextRefillAvailable: null,
      sentAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
    'mock-prescription-3': {
      id: 'mock-prescription-3',
      medicationName: 'Disulfiram',
      genericName: 'Disulfiram',
      dosage: '250mg once daily',
      quantity: 30,
      refills: 5,
      refillsRemaining: 0,
      instructions: 'Take one tablet by mouth once daily in the morning. NEVER consume alcohol while taking this medication. Avoid alcohol-containing products.',
      pharmacyName: 'CVS Pharmacy',
      pharmacyNcpdpId: '0564987',
      pharmacyPhone: '(415) 555-0123',
      pharmacyAddress: '123 Main St, San Francisco, CA 94102',
      status: PrescriptionStatus.COMPLETED,
      lastRefillDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      nextRefillAvailable: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      sentAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
    },
  };

  return mockPrescriptions[id] || null;
}

/**
 * Get mock refill requests
 */
export function getMockRefillRequests(prescriptionId: string): RefillRequest[] {
  if (prescriptionId === 'mock-prescription-1') {
    return [
      {
        id: 'mock-refill-1',
        prescriptionId,
        status: RefillStatus.SENT,
        requestedAt: new Date(Date.now() - 53 * 24 * 60 * 60 * 1000),
        respondedAt: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000),
      },
    ];
  }
  return [];
}
