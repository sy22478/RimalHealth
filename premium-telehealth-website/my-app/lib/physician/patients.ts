/**
 * Physician Patient Data Logic
 * 
 * HIPAA-compliant patient data access for physicians
 * - All PHI access is audit logged
 * - Only PHYSICIAN and ADMIN roles can access
 * - Data is decrypted automatically by Prisma extension
 * 
 * NOTE: This file imports server-only modules. Use lib/physician/patient-utils.ts
 * for helper functions that can be used in client components.
 */

import { prisma } from '@/lib/db/prisma';
import { auditLogger, PHIResourceType } from '@/lib/audit';

// ============================================================================
// Types
// ============================================================================

export interface PhysicianNote {
  id: string;
  patientId: string;
  physicianId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorName: string;
}

export interface TimelineEvent {
  type: 'intake' | 'prescription' | 'message' | 'note' | 'review' | 'refill';
  date: Date;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface PatientRecord {
  id: string;
  profile: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phone: string;
    email: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    medicalHistory: Record<string, unknown> | null;
    currentMedications: Record<string, unknown> | null;
    allergies: Record<string, unknown> | null;
    primaryConcern: string;
  };
  intakes: Array<{
    id: string;
    status: string;
    submittedAt: Date;
    riskScore: number | null;
    complexityScore: number | null;
    treatmentType: string | null;
  }>;
  prescriptions: Array<{
    id: string;
    medicationName: string;
    dosage: string;
    status: string;
    createdAt: Date;
    pharmacyName: string | null;
    refillsRemaining: number;
  }>;
  messages: Array<{
    id: string;
    subject: string;
    body: string;
    sentAt: Date;
    senderType: string;
  }>;
  notes: PhysicianNote[];
  timeline: TimelineEvent[];
}

// ============================================================================
// Patient Record Retrieval
// ============================================================================

/**
 * Get full patient record for physician review
 * Includes profile, intakes, prescriptions, messages, and notes
 * 
 * HIPAA: All access is audit logged with full context
 */
export async function getPatientRecord(
  patientId: string,
  physicianUserId: string,
  auditContext: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
  }
): Promise<PatientRecord | null> {
  // First, get the patient profile - patientId could be either PatientProfile.id or User.id
  // Try finding by PatientProfile.id first
  let patientProfile = await prisma.patientProfile.findUnique({
    where: { id: patientId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  // If not found, try by userId
  if (!patientProfile) {
    patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: patientId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  if (!patientProfile) {
    return null;
  }

  const userId = patientProfile.userId;

  // Fetch all patient data in parallel for efficiency
  const [intakes, prescriptions, messages, notes] = await Promise.all([
    // Get all intakes for this user
    prisma.intake.findMany({
      where: { patientId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        review: true,
      },
    }),
    // Get all prescriptions for this user
    prisma.prescription.findMany({
      where: { patientId: userId },
      orderBy: { createdAt: 'desc' },
    }),
    // Get all messages involving this user (either sent or received)
    prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { recipientId: userId },
        ],
      },
      orderBy: { sentAt: 'desc' },
    }),
    // Get all physician notes for this patient
    prisma.physicianNote.findMany({
      where: { patientId: patientProfile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        physician: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  // Audit log the PHI access
  await auditLogger.logPHIAccess(
    'VIEW',
    physicianUserId,
    'PHYSICIAN',
    PHIResourceType.PATIENT_PROFILE,
    patientProfile.id,
    auditContext,
    { accessReason: 'Clinical review - Full patient record' }
  );

  // Build patient record
  const record: PatientRecord = {
    id: patientProfile.id,
    profile: {
      firstName: patientProfile.firstName,
      lastName: patientProfile.lastName,
      dateOfBirth: patientProfile.dateOfBirth,
      phone: patientProfile.phone,
      email: patientProfile.user.email,
      address: {
        street: patientProfile.addressStreet,
        city: patientProfile.addressCity,
        state: patientProfile.addressState,
        zip: patientProfile.addressZip,
      },
      medicalHistory: patientProfile.medicalHistory as Record<string, unknown> | null,
      currentMedications: patientProfile.currentMedications as Record<string, unknown> | null,
      allergies: patientProfile.allergies as Record<string, unknown> | null,
      primaryConcern: patientProfile.primaryConcern || 'UNKNOWN',
    },
    intakes: intakes.map(intake => ({
      id: intake.id,
      status: intake.status,
      submittedAt: intake.submittedAt || intake.createdAt,
      riskScore: intake.riskScore,
      complexityScore: intake.complexityScore,
      treatmentType: null, // Will be extracted from formData if needed
    })),
    prescriptions: prescriptions.map(prescription => ({
      id: prescription.id,
      medicationName: prescription.medicationName,
      dosage: prescription.dosage,
      status: prescription.status,
      createdAt: prescription.createdAt,
      pharmacyName: prescription.pharmacyName,
      refillsRemaining: prescription.refillsRemaining,
    })),
    messages: messages.map(message => ({
      id: message.id,
      subject: message.subject || '(No subject)',
      body: message.body,
      sentAt: message.sentAt,
      senderType: message.senderType,
    })),
    notes: notes.map(note => ({
      id: note.id,
      patientId: note.patientId,
      physicianId: note.physicianId,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      authorName: `${note.physician.firstName} ${note.physician.lastName}`,
    })),
    timeline: buildTimeline(intakes, prescriptions, messages, notes),
  };

  return record;
}

/**
 * Get patient history for timeline view
 */
function buildTimeline(
  intakes: Array<{
    id: string;
    status: string;
    createdAt: Date;
    submittedAt: Date | null;
    review: { id: string; decision: string | null; completedAt: Date | null } | null;
  }>,
  prescriptions: Array<{
    id: string;
    medicationName: string;
    dosage: string;
    status: string;
    createdAt: Date;
    pharmacyName: string | null;
  }>,
  messages: Array<{
    id: string;
    subject: string | null;
    body: string;
    sentAt: Date;
    senderType: string;
  }>,
  notes: Array<{
    createdAt: Date;
    physician: { firstName: string; lastName: string };
  }>
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Add intake events
  for (const intake of intakes) {
    events.push({
      type: 'intake',
      date: intake.submittedAt || intake.createdAt,
      title: 'Intake Submitted',
      description: `Status: ${intake.status}`,
      metadata: { intakeId: intake.id, status: intake.status },
    });

    // Add review events
    for (const review of (intake.review ? [intake.review] : [])) {
      if (review.decision) {
        events.push({
          type: 'review',
          date: review.completedAt || new Date(),
          title: 'Intake Reviewed',
          description: `Decision: ${review.decision}`,
          metadata: { reviewId: review.id, decision: review.decision },
        });
      }
    }
  }

  // Add prescription events
  for (const prescription of prescriptions) {
    events.push({
      type: 'prescription',
      date: prescription.createdAt,
      title: 'Prescription Sent',
      description: `${prescription.medicationName} ${prescription.dosage}`,
      metadata: { 
        prescriptionId: prescription.id, 
        status: prescription.status,
        pharmacy: prescription.pharmacyName,
      },
    });
  }

  // Add message events
  for (const message of messages) {
    events.push({
      type: 'message',
      date: message.sentAt,
      title: `Message from ${message.senderType === 'PATIENT' ? 'Patient' : 'Physician'}`,
      description: message.subject || '(No subject)',
      metadata: { messageId: message.id },
    });
  }

  // Add note events
  for (const note of notes) {
    events.push({
      type: 'note',
      date: note.createdAt,
      title: 'Clinical Note Added',
      description: `By Dr. ${note.physician.lastName}`,
      metadata: { physicianName: `${note.physician.firstName} ${note.physician.lastName}` },
    });
  }

  // Sort by date descending
  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ============================================================================
// Clinical Notes CRUD
// ============================================================================

/**
 * Get all clinical notes for a patient
 */
export async function getClinicalNotes(
  patientId: string,
  physicianUserId: string,
  auditContext: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
  }
): Promise<PhysicianNote[]> {
  const notes = await prisma.physicianNote.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    include: {
      physician: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Audit log
  await auditLogger.logPHIAccess(
    'VIEW',
    physicianUserId,
    'PHYSICIAN',
    PHIResourceType.PHYSICIAN_NOTE,
    patientId,
    auditContext,
    { accessReason: 'View clinical notes' }
  );

  return notes.map(note => ({
    id: note.id,
    patientId: note.patientId,
    physicianId: note.physicianId,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    authorName: `${note.physician.firstName} ${note.physician.lastName}`,
  }));
}

/**
 * Create a new clinical note
 */
export async function createClinicalNote(
  patientId: string,
  physicianId: string,
  content: string,
  auditContext: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
  }
): Promise<PhysicianNote> {
  const note = await prisma.physicianNote.create({
    data: {
      patientId,
      physicianId,
      content,
    },
    include: {
      physician: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Audit log
  await auditLogger.logPHIAccess(
    'CREATE',
    physicianId,
    'PHYSICIAN',
    PHIResourceType.PHYSICIAN_NOTE,
    note.id,
    auditContext,
    { accessReason: 'Create clinical note' }
  );

  return {
    id: note.id,
    patientId: note.patientId,
    physicianId: note.physicianId,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    authorName: `${note.physician.firstName} ${note.physician.lastName}`,
  };
}

/**
 * Update a clinical note
 * Only the author can update their own notes
 */
export async function updateClinicalNote(
  noteId: string,
  physicianId: string,
  content: string,
  auditContext: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
  }
): Promise<PhysicianNote | null> {
  // Verify note exists and belongs to the physician
  const existingNote = await prisma.physicianNote.findFirst({
    where: {
      id: noteId,
      physicianId,
    },
    include: {
      physician: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!existingNote) {
    return null;
  }

  const note = await prisma.physicianNote.update({
    where: { id: noteId },
    data: { content },
    include: {
      physician: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Audit log
  await auditLogger.logPHIAccess(
    'UPDATE',
    physicianId,
    'PHYSICIAN',
    PHIResourceType.PHYSICIAN_NOTE,
    noteId,
    auditContext,
    { accessReason: 'Update clinical note' }
  );

  return {
    id: note.id,
    patientId: note.patientId,
    physicianId: note.physicianId,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    authorName: `${note.physician.firstName} ${note.physician.lastName}`,
  };
}

/**
 * Delete a clinical note
 * Only the author can delete their own notes
 */
export async function deleteClinicalNote(
  noteId: string,
  physicianId: string,
  auditContext: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
  }
): Promise<boolean> {
  // Verify note exists and belongs to the physician
  const existingNote = await prisma.physicianNote.findFirst({
    where: {
      id: noteId,
      physicianId,
    },
  });

  if (!existingNote) {
    return false;
  }

  await prisma.physicianNote.delete({
    where: { id: noteId },
  });

  // Audit log
  await auditLogger.logPHIAccess(
    'DELETE',
    physicianId,
    'PHYSICIAN',
    PHIResourceType.PHYSICIAN_NOTE,
    noteId,
    auditContext,
    { accessReason: 'Delete clinical note' }
  );

  return true;
}

// ============================================================================
// Helper Functions (re-exported from patient-utils for backward compatibility)
// ============================================================================

/**
 * Get physician display name from userId.
 * Returns "Dr. FirstName LastName" or the provided fallback.
 */
export async function getPhysicianDisplayName(
  userId: string,
  fallback = 'Physician'
): Promise<string> {
  const physician = await prisma.physician.findFirst({
    where: { userId },
    select: { firstName: true, lastName: true },
  });
  return physician
    ? `Dr. ${physician.firstName} ${physician.lastName}`
    : fallback;
}

export {
  calculateAge,
  formatDate,
  formatDateTime,
  getPatientInitials,
  getStatusVariant,
  getPriorityVariant,
} from './patient-utils';
