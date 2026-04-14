/**
 * Notifications Module
 * 
 * Central export point for all notification functionality.
 * Provides high-level convenience functions for common notification scenarios.
 * 
 * HIPAA Compliance Notes:
 * - All functions are fire-and-forget (never throw)
 * - Errors are logged without PHI
 * - User lookup would require separate implementation
 * 
 * @module lib/notifications
 * 
 * @example
 * ```typescript
 * // Send email immediately
 * import { sendEmail, EmailTemplate } from '@/lib/notifications';
 * 
 * await sendEmail({
 *   to: 'patient@example.com',
 *   template: EmailTemplate.WELCOME,
 *   data: { firstName: 'John', dashboardUrl: 'https://...' },
 * });
 * 
 * // Queue for background processing
 * import { notificationQueue } from '@/lib/notifications';
 * 
 * await notificationQueue.add({
 *   type: 'email',
 *   priority: 'high',
 *   payload: {
 *     to: 'patient@example.com',
 *     template: EmailTemplate.INTAKE_APPROVED,
 *     data: { patientName: 'John', pharmacyName: 'CVS' },
 *   },
 * });
 * 
 * // Send SMS
 * import { sendSMS, SMSTemplate } from '@/lib/notifications';
 * 
 * await sendSMS({
 *   to: '+1234567890',
 *   template: SMSTemplate.VERIFICATION_CODE,
 *   data: { code: '123456' },
 * });
 * 
 * // High-level convenience function (requires user lookup implementation)
 * import { notifyUser } from '@/lib/notifications';
 * 
 * await notifyUser({
 *   userId: 'user-123',
 *   email: {
 *     template: EmailTemplate.INTAKE_APPROVED,
 *     data: { patientName: 'John' },
 *   },
 *   priority: 'high',
 * });
 * ```
 */

// Types and values from templates
import {
  EmailTemplate,
  SMSTemplate,
  emailTemplates,
  smsTemplates,
  interpolateTemplate,
  stripHtml,
} from './templates';

// Initialize functions (imported for internal use)
import {
  initializeSendGrid,
  processRetryQueue as processEmailRetryQueue,
  sendEmail,
  sendMultipleEmails,
} from '@/lib/integrations/sendgrid';
import {
  initializeTwilio,
  processRetryQueue as processSMSRetryQueue,
  sendSMS,
  getSMSTemplate,
  formatPhoneNumber,
  isValidPhoneNumber,
  getMessageStatus,
} from '@/lib/integrations/twilio';
import { notificationQueue, NotificationQueue } from './queue';

// Queue
export {
  NotificationQueue,
  notificationQueue,
  type JobStatus,
  type NotificationJob,
  type NotificationType,
  type NotificationPriority,
  type EmailJobPayload,
  type SMSJobPayload,
} from './queue';

// Templates
export {
  EmailTemplate,
  SMSTemplate,
  emailTemplates,
  smsTemplates,
  interpolateTemplate,
  stripHtml,
  type EmailTemplateGenerator,
} from './templates';

// Email Integration (SES)
export {
  sendEmail,
  sendMultipleEmails,
  initializeSendGrid,
  processRetryQueue as processEmailRetryQueue,
  type SendEmailOptions,
} from '@/lib/integrations/sendgrid';

// Twilio Integration
export {
  sendSMS,
  getSMSTemplate,
  formatPhoneNumber,
  isValidPhoneNumber,
  initializeTwilio,
  processRetryQueue as processSMSRetryQueue,
  getMessageStatus,
  type SendSMSOptions,
} from '@/lib/integrations/twilio';

/**
 * Notify a user via email and/or SMS
 * 
 * NOTE: This is a placeholder implementation. In production, this would:
 * 1. Look up user by ID from database
 * 2. Get user's email and phone preferences
 * 3. Respect user's notification preferences
 * 4. Queue notifications appropriately
 * 
 * @param options - Notification options including userId and channels
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * // Email only
 * await notifyUser({
 *   userId: 'user-123',
 *   email: {
 *     template: EmailTemplate.WELCOME,
 *     data: { firstName: 'John' },
 *   },
 * });
 * 
 * // SMS only
 * await notifyUser({
 *   userId: 'user-123',
 *   sms: {
 *     template: SMSTemplate.VERIFICATION_CODE,
 *     data: { code: '123456' },
 *   },
 * });
 * 
 * // Both email and SMS
 * await notifyUser({
 *   userId: 'user-123',
 *   email: {
 *     template: EmailTemplate.INTAKE_APPROVED,
 *     data: { firstName: 'John', pharmacyName: 'CVS' },
 *   },
 *   sms: {
 *     template: SMSTemplate.INTAKE_APPROVED,
 *     data: { firstName: 'John' },
 *   },
 *   priority: 'high',
 * });
 * ```
 */
export async function notifyUser(options: {
  userId: string;
  email?: { template: EmailTemplate; data: Record<string, string> };
  sms?: { template: SMSTemplate; data: Record<string, string> };
  priority?: 'high' | 'normal' | 'low';
}): Promise<void> {
  const { userId, email, sms } = options;

  try {
    // Look up user from database
    const { prisma } = await import('@/lib/db/prisma');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, patientProfile: { select: { phone: true } } },
    });

    if (!user) {
      console.error(`[notifyUser] User not found: ${userId}`);
      return;
    }

    if (email) {
      await sendEmail({
        to: user.email,
        template: email.template,
        data: email.data,
      });
    }

    if (sms && user.patientProfile?.phone) {
      const { decryptPHI } = await import('@/lib/encryption/phi');
      const phone = decryptPHI(user.patientProfile.phone);
      if (phone && phone.length >= 10) {
        await sendSMS({
          to: phone,
          template: sms.template,
          data: sms.data,
        });
      }
    }
  } catch (error) {
    console.error(`[notifyUser] Failed to notify user ${userId}:`, error);
  }
}

/**
 * Notify a physician via email and/or SMS
 * 
 * NOTE: This is a placeholder implementation. In production, this would:
 * 1. Look up physician by ID from database
 * 2. Get physician's email and phone preferences
 * 3. Respect physician's notification preferences
 * 4. Queue notifications appropriately
 * 
 * @param options - Notification options including physicianId and channels
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * // Notify physician of new patient message
 * await notifyPhysician({
 *   physicianId: 'physician-123',
 *   email: {
 *     template: EmailTemplate.MESSAGE_RECEIVED,
 *     data: { patientName: 'John Doe', preview: 'Hello doctor...' },
 *   },
 *   priority: 'high',
 * });
 * ```
 */
export async function notifyPhysician(options: {
  physicianId: string;
  email?: { template: EmailTemplate; data: Record<string, string> };
  sms?: { template: SMSTemplate; data: Record<string, string> };
  priority?: 'high' | 'normal' | 'low';
}): Promise<void> {
  const { physicianId, email, sms } = options;

  try {
    // Look up physician from database (physicianId may be the userId)
    const { prisma } = await import('@/lib/db/prisma');
    const physician = await prisma.physician.findFirst({
      where: {
        OR: [{ id: physicianId }, { userId: physicianId }],
      },
      include: { user: { select: { email: true } } },
    });

    if (!physician) {
      console.error(`[notifyPhysician] Physician not found: ${physicianId}`);
      return;
    }

    if (email) {
      await sendEmail({
        to: physician.user.email,
        template: email.template,
        data: email.data,
      });
    }

    // SMS not supported for physicians (no phone field in Physician model)
    if (sms) {
      console.log(`[notifyPhysician] SMS skipped for physician ${physicianId} (no phone on record)`);
    }
  } catch (error) {
    console.error(`[notifyPhysician] Failed to notify physician ${physicianId}:`, error);
  }
}

/**
 * Initialize all notification services
 * Call this at application startup to eagerly initialize
 * email (SES) and Twilio clients
 * 
 * @example
 * ```typescript
 * // In app/layout.tsx or similar
 * import { initializeNotifications } from '@/lib/notifications';
 * 
 * initializeNotifications();
 * ```
 */
export function initializeNotifications(): void {
  initializeSendGrid();
  initializeTwilio();
  console.log('[Notifications] All services initialized');
}

/**
 * Process all notification queues
 * Should be called by a background worker or cron job
 * 
 * @param batchSize - Number of jobs to process per queue
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * // Process all queues
 * await processAllQueues();
 * 
 * // Run as background job every 5 seconds
 * setInterval(() => processAllQueues(), 5000);
 * ```
 */
export async function processAllQueues(batchSize: number = 10): Promise<void> {
  await Promise.all([
    // Process main notification queue
    notificationQueue.process(batchSize),
    // Process email retry queue (SES)
    processEmailRetryQueue(),
    // Process Twilio retry queue
    processSMSRetryQueue(),
  ]);
}

/**
 * Get comprehensive notification statistics
 * 
 * @returns Statistics object
 * 
 * @example
 * ```typescript
 * const stats = await getNotificationStats();
 * console.log(stats);
 * // {
 * //   queue: { pending: 5, processing: 2, ... },
 * //   email: { queued: 100, sent: 95, failed: 5 },
 * //   sms: { queued: 50, sent: 48, failed: 2 }
 * // }
 * ```
 */
export async function getNotificationStats(): Promise<{
  queue: {
    pending: number;
    processing: number;
    scheduled: number;
    completed: number;
    failed: number;
  };
  email: {
    queued: number;
    sent: number;
    failed: number;
  };
  sms: {
    queued: number;
    sent: number;
    failed: number;
  };
}> {
  const queueStats = await notificationQueue.getStats();

  return {
    queue: {
      pending: queueStats.pending,
      processing: queueStats.processing,
      scheduled: queueStats.scheduled,
      completed: queueStats.completed,
      failed: queueStats.failed,
    },
    email: {
      queued: queueStats.emailQueued,
      sent: queueStats.emailSent,
      failed: queueStats.emailFailed,
    },
    sms: {
      queued: queueStats.smsQueued,
      sent: queueStats.smsSent,
      failed: queueStats.smsFailed,
    },
  };
}

// Default export with all functionality
export default {
  // Queue
  notificationQueue,
  NotificationQueue,
  
  // Templates
  EmailTemplate,
  SMSTemplate,
  emailTemplates,
  smsTemplates,
  interpolateTemplate,
  stripHtml,
  
  // Email (SES)
  sendEmail,
  sendMultipleEmails,
  initializeSendGrid,
  processEmailRetryQueue,
  
  // Twilio
  sendSMS,
  getSMSTemplate,
  formatPhoneNumber,
  isValidPhoneNumber,
  initializeTwilio,
  processSMSRetryQueue,
  getMessageStatus,
  
  // High-level functions
  notifyUser,
  notifyPhysician,
  initializeNotifications,
  processAllQueues,
  getNotificationStats,
};
