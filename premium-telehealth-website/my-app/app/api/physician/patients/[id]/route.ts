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
// PHI decryption is handled automatically by the Prisma encryption extension.
// Do NOT manually call decryptPHI on fields in PHI_FIELDS — they are already decrypted.

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

    // Only 404 when the underlying user doesn't exist. A missing PatientProfile
    // shouldn't block the detail view — render whatever data we have (intakes,
    // prescriptions, notes) so physicians can still see clinical history for
    // patients whose profile row wasn't fully populated during signup.
    if (!user) {
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

    // PHI fields (medicalHistory, currentMedications, allergies, insurance*, messages,
    // notes) are already decrypted by the Prisma encryption extension on read.
    const medicalHistory = patientProfile?.medicalHistory || null;
    const currentMedications = patientProfile?.currentMedications || null;
    const allergies = patientProfile?.allergies || null;

    // Insurance info
    const insurance = patientProfile?.insuranceProvider
      ? {
          provider: patientProfile.insuranceProvider,
          memberId: patientProfile.insuranceMemberId || null,
          groupNumber: patientProfile.insuranceGroupNumber || null,
        }
      : null;

    // Format messages (already decrypted by Prisma extension)
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      subject: msg.subject || null,
      body: msg.body,
      senderType: msg.senderType,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      sentAt: msg.sentAt.toISOString(),
      readAt: msg.readAt?.toISOString(),
      status: msg.status,
    }));

    // Format physician notes (already decrypted by Prisma extension)
    const formattedNotes = notes.map((note) => ({
      id: note.id,
      content: note.content,
      physician: note.physician ? {
        firstName: note.physician.firstName,
        lastName: note.physician.lastName,
      } : null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    }));

    // Format patient data — PHI fields are already decrypted by Prisma extension.
    // When patientProfile is null (profile not yet populated), fall back to nulls
    // so the detail page can still render intakes/prescriptions/notes.
    const patientDetails = {
      id: patientId,
      firstName: patientProfile?.firstName ?? null,
      lastName: patientProfile?.lastName ?? null,
      email: user.email,
      dateOfBirth: patientProfile?.dateOfBirth ?? null,
      phone: patientProfile?.phone ?? null,
      profileIncomplete: !patientProfile,
      address: patientProfile
        ? {
            street: patientProfile.addressStreet,
            city: patientProfile.addressCity,
            state: patientProfile.addressState,
            zip: patientProfile.addressZip,
          }
        : null,
      billingAddress: patientProfile && !patientProfile.billingSameAsHome
        ? {
            street: patientProfile.billingStreet || null,
            city: patientProfile.billingCity || null,
            state: patientProfile.billingState,
            zip: patientProfile.billingZip || null,
          }
        : null,
      primaryConcern: patientProfile?.primaryConcern ?? null,
      treatmentGoal: patientProfile?.treatmentGoal ?? null,
      medicalHistory,
      currentMedications,
      allergies,
      insurance,
      consent: patientProfile
        ? {
            privacy: {
              given: patientProfile.privacyConsentGiven,
              date: patientProfile.privacyConsentDate?.toISOString(),
              version: patientProfile.privacyConsentVersion,
            },
            terms: {
              accepted: patientProfile.termsAccepted,
              date: patientProfile.termsAcceptedDate?.toISOString(),
            },
          }
        : null,
      notificationPreferences: patientProfile?.notificationPreferences ?? null,
      intakes: intakes.map((intake) => ({
          id: intake.id,
          status: intake.status,
          formData: intake.formData || {},
          riskScore: intake.riskScore,
          complexityScore: intake.complexityScore,
          isPregnant: intake.isPregnant,
          hasSeizureHistory: intake.hasSeizureHistory,
          hasPsychiatricHistory: intake.hasPsychiatricHistory,
          takingMedications: intake.takingMedications,
          medicationList: intake.medicationList || null,
          paymentStatus: intake.paymentStatus,
          createdAt: intake.createdAt.toISOString(),
          submittedAt: intake.submittedAt?.toISOString(),
          review: intake.review ? {
            id: intake.review.id,
            decision: intake.review.decision,
            clinicalNotes: intake.review.clinicalNotes || null,
            prescribedMedication: intake.review.prescribedMedication,
            genericName: intake.review.genericName,
            dosage: intake.review.dosage,
            quantity: intake.review.quantity,
            refills: intake.review.refills,
            instructions: intake.review.instructions || null,
            rejectionReason: intake.review.rejectionReason || null,
            alternativeRecommendation: intake.review.alternativeRecommendation || null,
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
      })),
      prescriptions: prescriptions.map((rx) => ({
        id: rx.id,
        medicationName: rx.medicationName,
        genericName: rx.genericName,
        dosage: rx.dosage,
        quantity: rx.quantity,
        refills: rx.refills,
        refillsRemaining: rx.refillsRemaining,
        instructions: rx.instructions || null,
        pharmacyName: rx.pharmacyName,
        pharmacyNcpdpId: rx.pharmacyNcpdpId,
        pharmacyPhone: rx.pharmacyPhone,
        pharmacyAddress: rx.pharmacyAddress || null,
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
      notes: formattedNotes,
      messages: formattedMessages,
      createdAt: (patientProfile?.createdAt ?? user.createdAt).toISOString(),
      updatedAt: (patientProfile?.updatedAt ?? user.createdAt).toISOString(),
      lastVisit: intakes.length > 0 ? intakes[0].createdAt.toISOString() : null,
    };

    return NextResponse.json({ patient: patientDetails });
  } catch (error) {
    console.error('Get patient details error:', error instanceof Error ? error.message : 'Unknown error');
    
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
