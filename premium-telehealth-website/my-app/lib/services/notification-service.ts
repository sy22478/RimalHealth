/**
 * Notification Service
 * High-level service for sending notifications to users and physicians
 * 
 * HIPAA Compliance:
 * - No PHI in notification logs
 * - All notifications queued for async processing
 * - Failed notifications don't disrupt user flow
 * 
 * @module lib/services/notification-service
 */

import { notificationQueue, EmailTemplate, SMSTemplate } from '@/lib/notifications';
import { notifyUser, notifyPhysician } from '@/lib/notifications';

// ============================================================================
// Types
// ============================================================================

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Patient Notifications
// ============================================================================

/**
 * Notify patient that their intake has been received
 * 
 * @param patientId - Patient's user ID
 * @param intakeId - Intake form ID
 */
export async function notifyNewIntake(patientId: string, intakeId: string): Promise<void> {
  console.log(`[NotificationService] Notifying new intake: ${intakeId} for patient: ${patientId}`);
  
  try {
    await notifyUser({
      userId: patientId,
      email: {
        template: EmailTemplate.INTAKE_SUBMITTED,
        data: {
          intakeId,
          message: 'Your intake form has been received and is pending review.',
        },
      },
      priority: 'normal',
    });
  } catch (error) {
    console.error(`[NotificationService] Failed to notify new intake: ${intakeId}`, error);
    // Don't throw - notification failures shouldn't disrupt the flow
  }
}

/**
 * Notify patient that their intake review is complete
 * 
 * @param patientId - Patient's user ID
 * @param status - Review status (APPROVED, DECLINED, NEEDS_INFO)
 * @param notes - Optional notes from physician
 */
export async function notifyReviewComplete(
  patientId: string,
  status: 'APPROVED' | 'DECLINED' | 'NEEDS_INFO',
  notes?: string
): Promise<void> {
  console.log(`[NotificationService] Notifying review complete: ${status} for patient: ${patientId}`);
  
  try {
    let template: EmailTemplate;
    let message: string;

    switch (status) {
      case 'APPROVED':
        template = EmailTemplate.INTAKE_APPROVED;
        message = 'Your intake has been approved. Your prescription will be sent shortly.';
        break;
      case 'DECLINED':
        template = EmailTemplate.INTAKE_REJECTED;
        message = 'Your intake requires additional information. Please check your account.';
        break;
      case 'NEEDS_INFO':
        template = EmailTemplate.INTAKE_NEEDS_INFO;
        message = 'We need additional information to complete your intake review.';
        break;
      default:
        template = EmailTemplate.GENERIC_NOTIFICATION;
        message = 'Your intake review status has been updated.';
    }

    await notifyUser({
      userId: patientId,
      email: {
        template,
        data: {
          status,
          notes: notes || '',
          message,
        },
      },
      sms: {
        template: SMSTemplate.STATUS_UPDATE,
        data: { message: truncateForSMS(message) },
      },
      priority: status === 'APPROVED' ? 'high' : 'normal',
    });
  } catch (error) {
    console.error(`[NotificationService] Failed to notify review complete for patient: ${patientId}`, error);
  }
}

/**
 * Notify patient that prescription has been sent
 * 
 * @param patientId - Patient's user ID
 * @param prescriptionId - Prescription ID
 * @param pharmacyName - Name of the pharmacy
 */
export async function notifyPrescriptionSent(
  patientId: string,
  prescriptionId: string,
  pharmacyName: string
): Promise<void> {
  console.log(`[NotificationService] Notifying prescription sent: ${prescriptionId} to ${pharmacyName}`);
  
  try {
    await notifyUser({
      userId: patientId,
      email: {
        template: EmailTemplate.PRESCRIPTION_SENT,
        data: {
          prescriptionId,
          pharmacyName,
          message: `Your prescription has been sent to ${pharmacyName}.`,
        },
      },
      sms: {
        template: SMSTemplate.PRESCRIPTION_READY,
        data: { pharmacyName },
      },
      priority: 'high',
    });
  } catch (error) {
    console.error(`[NotificationService] Failed to notify prescription sent: ${prescriptionId}`, error);
  }
}

/**
 * Notify patient of a new message from their physician
 * 
 * @param patientId - Patient's user ID
 * @param threadId - Message thread ID
 * @param preview - Message preview (sanitized, no PHI)
 */
export async function notifyNewMessage(
  patientId: string,
  threadId: string,
  preview?: string
): Promise<void> {
  console.log(`[NotificationService] Notifying new message in thread: ${threadId}`);
  
  try {
    await notifyUser({
      userId: patientId,
      email: {
        template: EmailTemplate.MESSAGE_RECEIVED,
        data: {
          threadId,
          preview: preview || 'You have a new message from your physician.',
        },
      },
      sms: {
        template: SMSTemplate.MESSAGE_RECEIVED,
        data: {},
      },
      priority: 'normal',
    });
  } catch (error) {
    console.error(`[NotificationService] Failed to notify new message in thread: ${threadId}`, error);
  }
}

/**
 * Notify patient of payment failure
 * 
 * @param patientId - Patient's user ID
 * @param retryUrl - URL to retry payment
 */
export async function notifyPaymentFailed(patientId: string, retryUrl?: string): Promise<void> {
  console.log(`[NotificationService] Notifying payment failed for patient: ${patientId}`);
  
  try {
    await notifyUser({
      userId: patientId,
      email: {
        template: EmailTemplate.PAYMENT_FAILED,
        data: {
          retryUrl: retryUrl || '/billing',
          message: 'Your payment could not be processed. Please update your payment method.',
        },
      },
      priority: 'high',
    });
  } catch (error) {
    console.error(`[NotificationService] Failed to notify payment failed for patient: ${patientId}`, error);
  }
}

/**
 * Notify patient that refill request was approved
 * 
 * @param patientId - Patient's user ID
 * @param prescriptionId - Prescription ID
 */
export async function notifyRefillApproved(patientId: string, prescriptionId: string): Promise<void> {
  console.log(`[NotificationService] Notifying refill approved: ${prescriptionId}`);
  
  try {
    await notifyUser({
      userId: patientId,
      email: {
        template: EmailTemplate.REFILL_APPROVED,
        data: {
          prescriptionId,
          message: 'Your refill request has been approved and sent to your pharmacy.',
        },
      },
      priority: 'normal',
    });
  } catch (error) {
    console.error(`[NotificationService] Failed to notify refill approved: ${prescriptionId}`, error);
  }
}

// ============================================================================
// Physician Notifications
// ============================================================================

/**
 * Notify physicians of new intake waiting for review.
 * Queries active physicians from the database and sends email + SMS.
 *
 * @param intakeId - Intake form ID
 * @param concernType - Type of concern (ALCOHOL)
 */
export async function notifyPhysicianNewIntake(
  intakeId: string,
  concernType: string
): Promise<void> {
  console.log(`[NotificationService] Notifying physicians of new intake: ${intakeId}`);

  try {
    const { prisma } = await import('@/lib/db/prisma');
    const { PhysicianStatus } = await import('@prisma/client');

    // Find all active physicians
    const activePhysicians = await prisma.physician.findMany({
      where: { status: PhysicianStatus.ACTIVE },
      include: {
        user: { select: { email: true } },
      },
    });

    const message = `A new ${concernType.toLowerCase()} intake is waiting for review.`;

    for (const physician of activePhysicians) {
      // Send email
      await notificationQueue.add({
        type: 'email',
        priority: 'high',
        payload: {
          to: physician.user.email,
          template: EmailTemplate.NEW_INTAKE_PENDING,
          data: {
            intakeId,
            concernType,
            message,
            physicianName: `Dr. ${physician.lastName}`,
            reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/physician/queue`,
          },
        },
      });

    }

    console.log(`[NotificationService] Notified ${activePhysicians.length} physicians of new intake: ${intakeId}`);
  } catch (error) {
    console.error(`[NotificationService] Failed to notify physicians of new intake: ${intakeId}`, error);
  }
}

/**
 * Notify physician of new message from patient
 * 
 * @param physicianId - Physician's user ID
 * @param patientId - Patient's user ID
 * @param threadId - Message thread ID
 */
export async function notifyPhysicianNewMessage(
  physicianId: string,
  patientId: string,
  threadId: string
): Promise<void> {
  console.log(`[NotificationService] Notifying physician ${physicianId} of new message from ${patientId}`);
  
  try {
    await notifyPhysician({
      physicianId,
      email: {
        template: EmailTemplate.MESSAGE_RECEIVED,
        data: {
          threadId,
          patientId,
          message: 'You have a new message from a patient.',
        },
      },
      priority: 'normal',
    });
  } catch (error) {
    console.error(`[NotificationService] Failed to notify physician of new message: ${physicianId}`, error);
  }
}

/**
 * Notify physician of new refill request
 * 
 * @param physicianId - Physician's user ID
 * @param prescriptionId - Prescription ID
 * @param patientId - Patient's user ID
 */
export async function notifyPhysicianRefillRequest(
  physicianId: string,
  prescriptionId: string,
  patientId: string
): Promise<void> {
  console.log(`[NotificationService] Notifying physician ${physicianId} of refill request for ${prescriptionId}`);
  
  try {
    await notifyPhysician({
      physicianId,
      email: {
        template: EmailTemplate.REFILL_REQUESTED,
        data: {
          prescriptionId,
          patientId,
          message: 'A patient has requested a prescription refill.',
        },
      },
      priority: 'normal',
    });
  } catch (error) {
    console.error(`[NotificationService] Failed to notify physician of refill request: ${physicianId}`, error);
  }
}

// ============================================================================
// Admin Notifications
// ============================================================================

/**
 * Notify admins of system events or issues
 * 
 * @param subject - Notification subject
 * @param message - Notification message
 * @param priority - Notification priority
 */
export async function notifyAdmin(
  subject: string,
  message: string,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<void> {
  console.log(`[NotificationService] Notifying admins: ${subject}`);
  
  try {
    await notificationQueue.add({
      type: 'email',
      priority,
      payload: {
        to: process.env.ADMIN_EMAIL || 'admin@admin.rimalhealth.com',
        template: EmailTemplate.GENERIC_NOTIFICATION,
        data: { subject, message },
      },
    });
  } catch (error) {
    console.error(`[NotificationService] Failed to notify admins: ${subject}`, error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate message for SMS (160 chars max for single message)
 * 
 * @param message - Original message
 * @returns Truncated message
 */
function truncateForSMS(message: string): string {
  const maxLength = 155; // Leave room for suffix
  if (message.length <= maxLength) {
    return message;
  }
  return message.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Service Export
// ============================================================================

/**
 * Notification Service class
 * Provides a consistent interface for all notifications
 */
export class NotificationService {
  static async notifyNewIntake(intakeId: string, patientId: string): Promise<void> {
    return notifyNewIntake(patientId, intakeId);
  }

  static async notifyReviewComplete(
    patientId: string,
    status: 'APPROVED' | 'DECLINED' | 'NEEDS_INFO',
    notes?: string
  ): Promise<void> {
    return notifyReviewComplete(patientId, status, notes);
  }

  static async notifyPrescriptionSent(
    patientId: string,
    prescriptionId: string,
    pharmacyName: string
  ): Promise<void> {
    return notifyPrescriptionSent(patientId, prescriptionId, pharmacyName);
  }

  static async notifyNewMessage(
    patientId: string,
    threadId: string,
    preview?: string
  ): Promise<void> {
    return notifyNewMessage(patientId, threadId, preview);
  }

  static async notifyPaymentFailed(patientId: string, retryUrl?: string): Promise<void> {
    return notifyPaymentFailed(patientId, retryUrl);
  }

  static async notifyRefillApproved(patientId: string, prescriptionId: string): Promise<void> {
    return notifyRefillApproved(patientId, prescriptionId);
  }

  static async notifyPhysicianNewIntake(intakeId: string, concernType: string): Promise<void> {
    return notifyPhysicianNewIntake(intakeId, concernType);
  }

  static async notifyPhysicianNewMessage(
    physicianId: string,
    patientId: string,
    threadId: string
  ): Promise<void> {
    return notifyPhysicianNewMessage(physicianId, patientId, threadId);
  }

  static async notifyPhysicianRefillRequest(
    physicianId: string,
    prescriptionId: string,
    patientId: string
  ): Promise<void> {
    return notifyPhysicianRefillRequest(physicianId, prescriptionId, patientId);
  }

  static async notifyAdmin(
    subject: string,
    message: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    return notifyAdmin(subject, message, priority);
  }
}

export default NotificationService;
