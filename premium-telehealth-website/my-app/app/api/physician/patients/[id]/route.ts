/**
 * GET /api/physician/patients/[id]
 * Get detailed patient record
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs PHI access (VIEW_PATIENT_RECORD)
 * - Returns decrypted PHI for all patient data
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { Role } from '@prisma/client';
import { decryptPHI } from '@/lib/encryption/phi';

// ============================================================================
// GET - Get Patient Details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Require physician or admin role
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const { id: patientId } = await params;
  const auditContext = AuditService.createAuditContext(
    request,
    userId,
    auth.user.role
  );

  try {
    // Validate UUID
    const uuidValidation = ValidationService.validateUUID(patientId);
    if (!uuidValidation.success) {
      return NextResponse.json(
        { error: 'Invalid patient ID', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Get physician profile for the user
    const physician = await prisma.physician.findUnique({
      where: { userId },
    });

    if (!physician) {
      return NextResponse.json(
        { error: 'Physician profile not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get patient with related data
    const [patientProfile, user, intakes, prescriptions, documents, notes, messages] = await Promise.all([
      prisma.patientProfile.findUnique({
        where: { userId: patientId },
      }),
      prisma.user.findUnique({
        where: { id: patientId },
        select: { email: true, createdAt: true },
      }),
      prisma.intake.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        include: {
          review: {
            include: {
              physician: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          prescription: true,
        },
      }),
      prisma.prescription.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        include: {
          refillRequests: {
            orderBy: { requestedAt: 'desc' },
          },
        },
      }),
      prisma.document.findMany({
        where: { patientId, status: 'ACTIVE' },
        orderBy: { uploadedAt: 'desc' },
      }),
      prisma.physicianNote.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        include: {
          physician: {
            select: { firstName: true, lastName: true }
          }
        }
      }),
      prisma.message.findMany({
        where: {
          OR: [
            { senderId: patientId },
            { recipientId: patientId }
          ]
        },
        orderBy: { sentAt: 'desc' },
        take: 50,
      }),
    ]);

    if (!patientProfile || !user) {
      return NextResponse.json(
        { error: 'Patient not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Log PHI access for viewing patient record
    await AuditService.logPatientProfileAccess(
      userId,
      auth.user.role,
      patientId,
      'VIEW',
      auditContext
    );

    // Parse and decrypt medical history
    let medicalHistory = null;
    try {
      if (patientProfile.medicalHistory) {
        medicalHistory = JSON.parse(decryptPHI(JSON.stringify(patientProfile.medicalHistory)));
      }
    } catch {
      medicalHistory = null;
    }

    // Parse and decrypt medications
    let currentMedications = null;
    try {
      if (patientProfile.currentMedications) {
        currentMedications = JSON.parse(decryptPHI(JSON.stringify(patientProfile.currentMedications)));
      }
    } catch {
      currentMedications = null;
    }

    // Parse and decrypt allergies
    let allergies = null;
    try {
      if (patientProfile.allergies) {
        allergies = JSON.parse(decryptPHI(JSON.stringify(patientProfile.allergies)));
      }
    } catch {
      allergies = null;
    }

    // Parse and decrypt insurance info
    let insurance = null;
    try {
      if (patientProfile.insuranceProvider) {
        insurance = {
          provider: decryptPHI(patientProfile.insuranceProvider),
          memberId: patientProfile.insuranceMemberId ? decryptPHI(patientProfile.insuranceMemberId) : null,
          groupNumber: patientProfile.insuranceGroupNumber ? decryptPHI(patientProfile.insuranceGroupNumber) : null,
        };
      }
    } catch {
      insurance = null;
    }

    // Decrypt messages
    const decryptedMessages = messages.map((msg) => {
      try {
        return {
          id: msg.id,
          subject: msg.subject ? decryptPHI(msg.subject) : null,
          body: decryptPHI(msg.body),
          senderType: msg.senderType,
          senderId: msg.senderId,
          recipientId: msg.recipientId,
          sentAt: msg.sentAt.toISOString(),
          readAt: msg.readAt?.toISOString(),
          status: msg.status,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Decrypt physician notes
    const decryptedNotes = notes.map((note) => {
      try {
        return {
          id: note.id,
          content: decryptPHI(note.content),
          physician: note.physician ? {
            firstName: note.physician.firstName,
            lastName: note.physician.lastName,
          } : null,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Format patient data with decrypted PHI
    const patientDetails = {
      id: patientProfile.userId,
      firstName: decryptPHI(patientProfile.firstName),
      lastName: decryptPHI(patientProfile.lastName),
      email: user.email,
      dateOfBirth: decryptPHI(patientProfile.dateOfBirth),
      phone: decryptPHI(patientProfile.phone),
      address: {
        street: decryptPHI(patientProfile.addressStreet),
        city: decryptPHI(patientProfile.addressCity),
        state: patientProfile.addressState,
        zip: decryptPHI(patientProfile.addressZip),
      },
      billingAddress: patientProfile.billingSameAsHome ? null : {
        street: patientProfile.billingStreet ? decryptPHI(patientProfile.billingStreet) : null,
        city: patientProfile.billingCity ? decryptPHI(patientProfile.billingCity) : null,
        state: patientProfile.billingState,
        zip: patientProfile.billingZip ? decryptPHI(patientProfile.billingZip) : null,
      },
      primaryConcern: patientProfile.primaryConcern,
      treatmentGoal: patientProfile.treatmentGoal,
      medicalHistory,
      currentMedications,
      allergies,
      insurance,
      consent: {
        privacy: {
          given: patientProfile.privacyConsentGiven,
          date: patientProfile.privacyConsentDate?.toISOString(),
          version: patientProfile.privacyConsentVersion,
        },
        terms: {
          accepted: patientProfile.termsAccepted,
          date: patientProfile.termsAcceptedDate?.toISOString(),
        },
      },
      notificationPreferences: patientProfile.notificationPreferences,
      intakes: intakes.map((intake) => {
        let formData = {};
        try {
          if (intake.formData) {
            formData = JSON.parse(decryptPHI(JSON.stringify(intake.formData)));
          }
        } catch {
          formData = {};
        }

        return {
          id: intake.id,
          status: intake.status,
          formData,
          riskScore: intake.riskScore,
          complexityScore: intake.complexityScore,
          isPregnant: intake.isPregnant,
          hasSeizureHistory: intake.hasSeizureHistory,
          hasPsychiatricHistory: intake.hasPsychiatricHistory,
          takingMedications: intake.takingMedications,
          medicationList: intake.medicationList ? decryptPHI(intake.medicationList) : null,
          paymentStatus: intake.paymentStatus,
          createdAt: intake.createdAt.toISOString(),
          submittedAt: intake.submittedAt?.toISOString(),
          review: intake.review ? {
            id: intake.review.id,
            decision: intake.review.decision,
            clinicalNotes: intake.review.clinicalNotes ? decryptPHI(intake.review.clinicalNotes) : null,
            prescribedMedication: intake.review.prescribedMedication,
            genericName: intake.review.genericName,
            dosage: intake.review.dosage,
            quantity: intake.review.quantity,
            refills: intake.review.refills,
            instructions: intake.review.instructions ? decryptPHI(intake.review.instructions) : null,
            rejectionReason: intake.review.rejectionReason ? decryptPHI(intake.review.rejectionReason) : null,
            alternativeRecommendation: intake.review.alternativeRecommendation ? decryptPHI(intake.review.alternativeRecommendation) : null,
            completedAt: intake.review.completedAt?.toISOString(),
            physician: intake.review.physician ? {
              firstName: intake.review.physician.firstName,
              lastName: intake.review.physician.lastName,
            } : null,
          } : null,
          prescription: intake.prescription ? {
            id: intake.prescription.id,
            medicationName: intake.prescription.medicationName,
            genericName: intake.prescription.genericName,
            dosage: intake.prescription.dosage,
            quantity: intake.prescription.quantity,
            refills: intake.prescription.refills,
            status: intake.prescription.status,
          } : null,
        };
      }),
      prescriptions: prescriptions.map((rx) => ({
        id: rx.id,
        medicationName: rx.medicationName,
        genericName: rx.genericName,
        dosage: rx.dosage,
        quantity: rx.quantity,
        refills: rx.refills,
        refillsRemaining: rx.refillsRemaining,
        instructions: rx.instructions ? decryptPHI(rx.instructions) : null,
        pharmacyName: rx.pharmacyName,
        pharmacyNcpdpId: rx.pharmacyNcpdpId,
        pharmacyPhone: rx.pharmacyPhone,
        pharmacyAddress: rx.pharmacyAddress ? decryptPHI(rx.pharmacyAddress) : null,
        status: rx.status,
        surescriptsRxId: rx.surescriptsRxId,
        sentAt: rx.sentAt?.toISOString(),
        lastRefillDate: rx.lastRefillDate?.toISOString(),
        nextRefillAvailable: rx.nextRefillAvailable?.toISOString(),
        createdAt: rx.createdAt.toISOString(),
        refillRequests: rx.refillRequests.map((refill) => ({
          id: refill.id,
          status: refill.status,
          requestedAt: refill.requestedAt.toISOString(),
          respondedAt: refill.respondedAt?.toISOString(),
        })),
      })),
      documents: documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt.toISOString(),
      })),
      notes: decryptedNotes,
      messages: decryptedMessages,
      createdAt: patientProfile.createdAt.toISOString(),
      updatedAt: patientProfile.updatedAt.toISOString(),
      lastVisit: intakes.length > 0 ? intakes[0].createdAt.toISOString() : null,
    };

    return NextResponse.json({ patient: patientDetails });
  } catch (error) {
    console.error('Get patient details error:', error);
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/physician/patients/${patientId}`,
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to retrieve patient details', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
