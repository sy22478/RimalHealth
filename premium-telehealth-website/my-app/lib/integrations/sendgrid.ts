/**
 * SendGrid Email Integration
 * 
 * HIPAA Compliance Notes:
 * - No PHI logged to console or errors
 * - All errors are logged generically without recipient details
 * - Failed emails are queued for retry
 * - BCC option available for audit trail
 * 
 * @module lib/integrations/sendgrid
 */

import * as sgMail from '@sendgrid/mail';
import { getRedisClient } from '@/lib/redis/client';
import { emailTemplates, EmailTemplate, interpolateTemplate } from '@/lib/notifications/templates';

/**
 * SendGrid configuration from environment
 */
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@admin.rimalhealth.com';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Rimal Health';

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
  /** Optional: override from address */
  from?: string;
  /** Optional: BCC addresses for audit */
  bcc?: string | string[];
  /** Optional: reply-to address */
  replyTo?: string;
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
 * SendGrid initialization state
 */
let isInitialized = false;

/**
 * Initialize SendGrid with API key
 * Called automatically on first send, can be called early for eager setup
 */
export function initializeSendGrid(): void {
  if (isInitialized) return;

  if (!SENDGRID_API_KEY) {
    console.error('[SendGrid] SENDGRID_API_KEY not configured');
    return;
  }

  try {
    sgMail.setApiKey(SENDGRID_API_KEY);
    isInitialized = true;
    console.log('[SendGrid] Initialized successfully');
  } catch (error) {
    console.error('[SendGrid] Failed to initialize:', error);
  }
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
    console.log(`[SendGrid] Email queued for retry ${job.attempt}/${job.maxRetries}, jobId: ${jobId}`);
  } catch (error) {
    console.error('[SendGrid] Failed to queue for retry:', error);
  }
}

/**
 * Send a single email using SendGrid
 * 
 * Never throws - logs errors and continues
 * Queues for retry on transient failures
 * 
 * @param options - Email sending options
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * await sendEmail({
 *   to: 'patient@example.com',
 *   template: EmailTemplate.WELCOME,
 *   data: { firstName: 'John', dashboardUrl: 'https://...' },
 * });
 * ```
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  // Initialize if needed
  if (!isInitialized) {
    initializeSendGrid();
  }

  if (!SENDGRID_API_KEY) {
    console.error('[SendGrid] Cannot send email: SENDGRID_API_KEY not configured');
    return;
  }

  const { to, template, data, from = SENDGRID_FROM_EMAIL, bcc, replyTo } = options;

  try {
    // Generate email content from template
    const templateGenerator = emailTemplates[template];
    if (!templateGenerator) {
      console.error(`[SendGrid] Unknown template: ${template}`);
      return;
    }

    const { subject, html, text } = templateGenerator(data);

    // Construct SendGrid message
    const msg: sgMail.MailDataRequired = {
      to,
      from: {
        email: from,
        name: SENDGRID_FROM_NAME,
      },
      subject,
      html,
      text,
      ...(bcc && { bcc }),
      ...(replyTo && { replyTo }),
      // Add tracking settings for HIPAA compliance (disable click tracking)
      trackingSettings: {
        clickTracking: {
          enable: false,
        },
      },
    };

    // Send email
    await sgMail.send(msg);
    console.log('[SendGrid] Email sent successfully');
  } catch (error) {
    // Log error without exposing recipient details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SendGrid] Failed to send email:', errorMessage);

    // Check if it's a retryable error
    const isRetryable = isRetryableError(error);
    
    if (isRetryable) {
      await queueForRetry({
        type: 'email',
        to,
        template,
        data,
        from,
        attempt: 1,
        maxRetries: 3,
      });
    }
  }
}

/**
 * Send multiple emails in batch
 * Uses SendGrid's batch sending for efficiency
 * 
 * Never throws - logs errors and continues
 * Failed emails are queued individually for retry
 * 
 * @param optionsArray - Array of email sending options
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * await sendMultipleEmails([
 *   { to: 'user1@example.com', template: EmailTemplate.WELCOME, data: { firstName: 'John' } },
 *   { to: 'user2@example.com', template: EmailTemplate.WELCOME, data: { firstName: 'Jane' } },
 * ]);
 * ```
 */
export async function sendMultipleEmails(optionsArray: SendEmailOptions[]): Promise<void> {
  if (!isInitialized) {
    initializeSendGrid();
  }

  if (!SENDGRID_API_KEY) {
    console.error('[SendGrid] Cannot send emails: SENDGRID_API_KEY not configured');
    return;
  }

  if (!optionsArray.length) return;

  try {
    // Prepare messages
    const messages: sgMail.MailDataRequired[] = [];
    const failedOptions: SendEmailOptions[] = [];

    for (const options of optionsArray) {
      const { to, template, data, from = SENDGRID_FROM_EMAIL, bcc, replyTo } = options;

      const templateGenerator = emailTemplates[template];
      if (!templateGenerator) {
        console.error(`[SendGrid] Unknown template: ${template}`);
        failedOptions.push(options);
        continue;
      }

      try {
        const { subject, html, text } = templateGenerator(data);

        messages.push({
          to,
          from: {
            email: from,
            name: SENDGRID_FROM_NAME,
          },
          subject,
          html,
          text,
          ...(bcc && { bcc }),
          ...(replyTo && { replyTo }),
          trackingSettings: {
            clickTracking: {
              enable: false,
            },
          },
        });
      } catch (templateError) {
        console.error('[SendGrid] Template generation failed');
        failedOptions.push(options);
      }
    }

    // Send batch if we have messages
    if (messages.length > 0) {
      // SendGrid supports up to 1000 messages per batch
      const batchSize = 1000;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        try {
          await sgMail.send(batch);
          console.log(`[SendGrid] Batch sent: ${batch.length} emails`);
        } catch (batchError) {
          console.error('[SendGrid] Batch send failed, will retry individually');
          // Queue individual retries for this batch
          for (let j = 0; j < batch.length; j++) {
            const originalIndex = i + j;
            const originalOptions = optionsArray[originalIndex];
            if (originalOptions) {
              await queueForRetry({
                type: 'email',
                to: originalOptions.to,
                template: originalOptions.template,
                data: originalOptions.data,
                from: originalOptions.from || SENDGRID_FROM_EMAIL,
                attempt: 1,
                maxRetries: 3,
              });
            }
          }
        }
      }
    }

    // Queue failed template generations for retry
    for (const failed of failedOptions) {
      await queueForRetry({
        type: 'email',
        to: failed.to,
        template: failed.template,
        data: failed.data,
        from: failed.from || SENDGRID_FROM_EMAIL,
        attempt: 1,
        maxRetries: 3,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SendGrid] Batch send error:', errorMessage);

    // Queue all for retry on catastrophic failure
    for (const options of optionsArray) {
      await queueForRetry({
        type: 'email',
        to: options.to,
        template: options.template,
        data: options.data,
        from: options.from || SENDGRID_FROM_EMAIL,
        attempt: 1,
        maxRetries: 3,
      });
    }
  }
}

/**
 * Check if an error is retryable
 * Based on SendGrid error codes and response status
 * 
 * @param error - Error from SendGrid
 * @returns boolean indicating if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const err = error as { code?: number; response?: { statusCode?: number } };
  
  // Retry on network errors (no code)
  if (!err.code && !err.response?.statusCode) return true;
  
  // Retry on rate limits (429)
  if (err.code === 429 || err.response?.statusCode === 429) return true;
  
  // Retry on server errors (5xx)
  const statusCode = err.response?.statusCode;
  if (statusCode && statusCode >= 500 && statusCode < 600) return true;
  
  // Don't retry on client errors (4xx except 429)
  if (statusCode && statusCode >= 400 && statusCode < 500) return false;
  
  return true;
}

/**
 * Process retry queue
 * Should be called by a background worker periodically
 * 
 * @returns Promise<void>
 */
export async function processRetryQueue(): Promise<void> {
  if (!isInitialized) {
    initializeSendGrid();
  }

  if (!SENDGRID_API_KEY) {
    console.error('[SendGrid] Cannot process retry queue: SENDGRID_API_KEY not configured');
    return;
  }

  try {
    const redis = getRedisClient();
    const now = Date.now();

    // Get jobs that are ready for retry (score <= now)
    const jobs = await redis.zrangebyscore('notifications:email:retry', 0, now, 'LIMIT', 0, 100);

    if (jobs.length === 0) return;

    console.log(`[SendGrid] Processing ${jobs.length} retry jobs`);

    for (const jobData of jobs) {
      try {
        const job: RetryQueueJob & { id?: string } = JSON.parse(jobData);
        
        // Remove from retry queue
        await redis.zrem('notifications:email:retry', jobData);

        // Check if max retries reached
        if (job.attempt >= job.maxRetries) {
          console.error(`[SendGrid] Max retries reached for job: ${job.id}`);
          // Move to dead letter queue
          await redis.lpush('notifications:email:dead', jobData);
          continue;
        }

        // Attempt to send
        const templateGenerator = emailTemplates[job.template];
        if (!templateGenerator) {
          console.error(`[SendGrid] Unknown template in retry: ${job.template}`);
          continue;
        }

        const { subject, html, text } = templateGenerator(job.data);

        const msg: sgMail.MailDataRequired = {
          to: job.to,
          from: {
            email: job.from,
            name: SENDGRID_FROM_NAME,
          },
          subject,
          html,
          text,
          trackingSettings: {
            clickTracking: {
              enable: false,
            },
          },
        };

        await sgMail.send(msg);
        console.log(`[SendGrid] Retry successful for job: ${job.id}`);
      } catch (error) {
        // Re-queue with incremented attempt
        const job: RetryQueueJob & { id?: string; queuedAt?: string } = JSON.parse(jobData);
        job.attempt += 1;
        
        const isRetryable = isRetryableError(error);
        
        if (isRetryable && job.attempt < job.maxRetries) {
          const retryDelay = Math.pow(2, job.attempt) * 60;
          const score = Date.now() + retryDelay * 1000;
          await redis.zadd('notifications:email:retry', score, JSON.stringify(job));
          console.log(`[SendGrid] Re-queued for retry ${job.attempt}/${job.maxRetries}`);
        } else {
          // Move to dead letter queue
          await redis.lpush('notifications:email:dead', jobData);
          console.error(`[SendGrid] Moved to dead letter queue after ${job.attempt} attempts`);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SendGrid] Error processing retry queue:', errorMessage);
  }
}

export default {
  initializeSendGrid,
  sendEmail,
  sendMultipleEmails,
  processRetryQueue,
};
