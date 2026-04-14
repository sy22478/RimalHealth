/**
 * Email Integration (Amazon SES)
 *
 * Migrated from SendGrid to Amazon SES. The file retains its original name
 * so that every existing import (`@/lib/integrations/sendgrid`) continues to
 * work without changes across the codebase.
 *
 * HIPAA Compliance Notes:
 * - No PHI logged to console or errors
 * - All errors are logged generically without recipient details
 * - Failed emails are queued for retry
 * - BCC option available for audit trail
 *
 * @module lib/integrations/sendgrid
 */

import { sesSendEmail } from '@/lib/integrations/ses';
import { getRedisClient } from '@/lib/redis/client';
import { emailTemplates, EmailTemplate, interpolateTemplate } from '@/lib/notifications/templates';

/**
 * Email sending options
 */
export interface SendEmailOptions {
  /** Recipient email address */
  to: string;
  /** Email template to use */
  template: EmailTemplate;
  /** Template data for interpolation */
  data: Record<string, string>;
  /** Optional: override from address (unused with SES — from is configured via env) */
  from?: string;
  /** Optional: BCC addresses for audit */
  bcc?: string | string[];
  /** Optional: reply-to address */
  replyTo?: string;
}

/**
 * Result of an email send attempt
 */
export interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Queue job for retry on failure
 */
interface RetryQueueJob {
  type: 'email';
  to: string;
  template: EmailTemplate;
  data: Record<string, string>;
  from: string;
  attempt: number;
  maxRetries: number;
}

/**
 * Initialize email service (no-op — SES uses IAM role credentials)
 * Kept for API compatibility with callers that invoke initializeSendGrid().
 */
export function initializeSendGrid(): void {
  console.log('[Email] SES initialized (IAM role auth)');
}

/**
 * Queue an email for retry after failure
 * Uses Redis list for retry queue
 *
 * @param job - Retry job details
 */
async function queueForRetry(job: RetryQueueJob): Promise<void> {
  try {
    const redis = getRedisClient();
    const jobId = `email-retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const jobData = JSON.stringify({ ...job, id: jobId, queuedAt: new Date().toISOString() });

    // Add to retry queue with exponential backoff delay
    const retryDelay = Math.pow(2, job.attempt) * 60; // 2^attempt minutes
    const score = Date.now() + retryDelay * 1000;

    await redis.zadd('notifications:email:retry', score, jobData);
    console.log(`[Email] Email queued for retry ${job.attempt}/${job.maxRetries}, jobId: ${jobId}`);
  } catch (error) {
    console.error('[Email] Failed to queue for retry:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Send a single email via Amazon SES
 *
 * Never throws - logs errors and continues
 * Queues for retry on transient failures
 *
 * @param options - Email sending options
 * @returns Promise<SendEmailResult> indicating success or failure
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, template, data, bcc, replyTo } = options;

  try {
    // Generate email content from template
    const templateGenerator = emailTemplates[template];
    if (!templateGenerator) {
      console.error(`[Email] Unknown template: ${template}`);
      return { success: false, error: `Unknown template: ${template}` };
    }

    const { subject, html, text } = templateGenerator(data);

    // Send via SES
    const result = await sesSendEmail({
      to,
      subject,
      html,
      text,
      bcc,
      replyTo,
    });

    if (result.success) {
      console.log('[Email] Email sent successfully');
      return { success: true };
    }

    // SES returned an error
    console.error('[Email] Failed to send email:', result.error);

    if (isRetryableError(result.error)) {
      await queueForRetry({
        type: 'email',
        to,
        template,
        data,
        from: '',
        attempt: 1,
        maxRetries: 3,
      });
    }

    return { success: false, error: result.error };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email] Failed to send email:', errorMessage);

    if (isRetryableError(errorMessage)) {
      await queueForRetry({
        type: 'email',
        to,
        template,
        data,
        from: '',
        attempt: 1,
        maxRetries: 3,
      });
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Send multiple emails sequentially via SES
 *
 * Never throws - logs errors and continues
 * Failed emails are queued individually for retry
 *
 * @param optionsArray - Array of email sending options
 * @returns Promise<void>
 */
export async function sendMultipleEmails(optionsArray: SendEmailOptions[]): Promise<void> {
  if (!optionsArray.length) return;

  for (const options of optionsArray) {
    await sendEmail(options);
  }
}

/**
 * Check if an error is retryable
 * SES throttling, service errors, and network issues are retryable.
 *
 * @param error - Error message or object
 * @returns boolean indicating if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (typeof error === 'string') {
    const lower = error.toLowerCase();
    // Retry on throttling, service unavailable, or network errors
    if (lower.includes('throttl') || lower.includes('rate') || lower.includes('limit')) return true;
    if (lower.includes('service') || lower.includes('unavailable') || lower.includes('timeout')) return true;
    if (lower.includes('network') || lower.includes('econnreset') || lower.includes('enotfound')) return true;
    // Don't retry on validation / auth errors
    if (lower.includes('validation') || lower.includes('invalid') || lower.includes('access denied')) return false;
  }
  // Default to retryable for unknown errors
  return true;
}

/**
 * Process retry queue
 * Should be called by a background worker periodically
 *
 * @returns Promise<void>
 */
export async function processRetryQueue(): Promise<void> {
  try {
    const redis = getRedisClient();
    const now = Date.now();

    // Get jobs that are ready for retry (score <= now)
    const jobs = await redis.zrangebyscore('notifications:email:retry', 0, now, 'LIMIT', 0, 100);

    if (jobs.length === 0) return;

    console.log(`[Email] Processing ${jobs.length} retry jobs`);

    for (const jobData of jobs) {
      try {
        const job: RetryQueueJob & { id?: string } = JSON.parse(jobData);

        // Remove from retry queue
        await redis.zrem('notifications:email:retry', jobData);

        // Check if max retries reached
        if (job.attempt >= job.maxRetries) {
          console.error(`[Email] Max retries reached for job: ${job.id}`);
          // Move to dead letter queue
          await redis.lpush('notifications:email:dead', jobData);
          continue;
        }

        // Attempt to send
        const templateGenerator = emailTemplates[job.template];
        if (!templateGenerator) {
          console.error(`[Email] Unknown template in retry: ${job.template}`);
          continue;
        }

        const { subject, html, text } = templateGenerator(job.data);

        const result = await sesSendEmail({
          to: job.to,
          subject,
          html,
          text,
        });

        if (result.success) {
          console.log(`[Email] Retry successful for job: ${job.id}`);
        } else {
          throw new Error(result.error || 'SES send failed');
        }
      } catch (error) {
        // Re-queue with incremented attempt
        const job: RetryQueueJob & { id?: string; queuedAt?: string } = JSON.parse(jobData);
        job.attempt += 1;

        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const retryable = isRetryableError(errorMsg);

        if (retryable && job.attempt < job.maxRetries) {
          const retryDelay = Math.pow(2, job.attempt) * 60;
          const score = Date.now() + retryDelay * 1000;
          await redis.zadd('notifications:email:retry', score, JSON.stringify(job));
          console.log(`[Email] Re-queued for retry ${job.attempt}/${job.maxRetries}`);
        } else {
          // Move to dead letter queue
          await redis.lpush('notifications:email:dead', jobData);
          console.error(`[Email] Moved to dead letter queue after ${job.attempt} attempts`);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email] Error processing retry queue:', errorMessage);
  }
}

export default {
  initializeSendGrid,
  sendEmail,
  sendMultipleEmails,
  processRetryQueue,
};
