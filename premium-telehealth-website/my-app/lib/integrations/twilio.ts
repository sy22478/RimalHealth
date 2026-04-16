/**
 * Twilio SMS Integration
 * 
 * HIPAA Compliance Notes:
 * - No PHI logged to console or errors
 * - All errors are logged generically without phone number details
 * - Phone numbers are formatted to E.164 before sending
 * - Failed SMS are queued for retry
 * 
 * @module lib/integrations/twilio
 */

import twilio from 'twilio';
import { getRedisClient } from '@/lib/redis/client';
import { smsTemplates, SMSTemplate } from '@/lib/notifications/templates';

/**
 * Twilio configuration from environment
 */
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

/**
 * SMS sending options
 */
export interface SendSMSOptions {
  /** Recipient phone number (will be formatted to E.164) */
  to: string;
  /** SMS template to use */
  template?: SMSTemplate;
  /** Template data for interpolation */
  data?: Record<string, string>;
  /** Raw message body (alternative to template) */
  body?: string;
  /** Optional: override from number */
  from?: string;
}

/**
 * Queue job for retry on failure
 */
interface RetryQueueJob {
  type: 'sms';
  to: string;
  body: string;
  from: string;
  attempt: number;
  maxRetries: number;
}

/**
 * Twilio client instance
 */
let twilioClient: twilio.Twilio | null = null;

/**
 * Twilio initialization state
 */
let isInitialized = false;

/**
 * Initialize Twilio with account credentials
 * Called automatically on first send, can be called early for eager setup
 */
export function initializeTwilio(): void {
  if (isInitialized) return;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('[Twilio] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured');
    return;
  }

  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    isInitialized = true;
    console.log('[Twilio] Initialized successfully');
  } catch (error) {
    console.error('[Twilio] Failed to initialize:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Format phone number to E.164 format
 * Handles various input formats and validates the result
 * 
 * @param phone - Phone number in various formats
 * @returns Formatted E.164 phone number or empty string if invalid
 * 
 * @example
 * formatPhoneNumber('(123) 456-7890') // '+11234567890'
 * formatPhoneNumber('123-456-7890')   // '+11234567890'
 * formatPhoneNumber('+1 234 567 890') // '+1234567890'
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle US numbers
  if (digits.length === 10) {
    digits = '1' + digits;
  }

  // Validate: should be 11 digits starting with 1 for US
  if (digits.length !== 11 || !digits.startsWith('1')) {
    // Try to validate as international
    if (digits.length >= 10 && digits.length <= 15) {
      return '+' + digits;
    }
    return '';
  }

  return '+' + digits;
}

/**
 * Validate phone number format
 * 
 * @param phone - Phone number to validate
 * @returns boolean indicating if phone number is valid
 */
export function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  return formatted.length > 0;
}

/**
 * Get SMS template content
 * 
 * @param template - SMS template identifier
 * @param data - Template data for interpolation
 * @returns Formatted SMS body text
 * 
 * @example
 * getSMSTemplate(SMSTemplate.VERIFICATION_CODE, { code: '123456' })
 * // 'Your Rimal Health verification code: 123456...'
 */
export function getSMSTemplate(
  template: SMSTemplate,
  data: Record<string, string>
): string {
  const templateGenerator = smsTemplates[template];
  if (!templateGenerator) {
    console.error(`[Twilio] Unknown SMS template: ${template}`);
    return '';
  }
  return templateGenerator(data);
}

/**
 * Truncate message to SMS limit
 * Standard SMS is 160 characters (GSM-7) or 70 (UCS-2)
 * We use conservative 160 character limit
 * 
 * @param message - Message text
 * @param limit - Character limit (default: 160)
 * @returns Truncated message with ellipsis if needed
 */
function truncateForSMS(message: string, limit: number = 160): string {
  if (message.length <= limit) return message;
  return message.substring(0, limit - 3) + '...';
}

/**
 * Queue an SMS for retry after failure
 * Uses Redis sorted set with timestamp score for delayed retry
 * 
 * @param job - Retry job details
 */
async function queueForRetry(job: RetryQueueJob): Promise<void> {
  try {
    const redis = getRedisClient();
    const jobId = `sms-retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const jobData = JSON.stringify({ ...job, id: jobId, queuedAt: new Date().toISOString() });
    
    // Add to retry queue with exponential backoff delay
    const retryDelay = Math.pow(2, job.attempt) * 60; // 2^attempt minutes
    const score = Date.now() + retryDelay * 1000;
    
    await redis.zadd('notifications:sms:retry', score, jobData);
    console.log(`[Twilio] SMS queued for retry ${job.attempt}/${job.maxRetries}, jobId: ${jobId}`);
  } catch (error) {
    console.error('[Twilio] Failed to queue for retry:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Send SMS using Twilio
 * 
 * Never throws - logs errors and continues
 * Queues for retry on transient failures
 * Validates and formats phone number to E.164
 * 
 * @param options - SMS sending options
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * // Using template
 * await sendSMS({
 *   to: '+1234567890',
 *   template: SMSTemplate.VERIFICATION_CODE,
 *   data: { code: '123456' },
 * });
 * 
 * // Using raw body
 * await sendSMS({
 *   to: '+1234567890',
 *   body: 'Your code is 123456',
 * });
 * ```
 */
export async function sendSMS(options: SendSMSOptions): Promise<void> {
  // Initialize if needed
  if (!isInitialized) {
    initializeTwilio();
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error('[Twilio] Cannot send SMS: Credentials not configured');
    return;
  }

  if (!twilioClient) {
    console.error('[Twilio] Client not initialized');
    return;
  }

  const { to, template, data = {}, body: rawBody, from = TWILIO_PHONE_NUMBER } = options;

  // Format and validate phone number
  const formattedTo = formatPhoneNumber(to);
  if (!formattedTo) {
    console.error('[Twilio] Invalid phone number format');
    return;
  }

  // Get message body from template or use raw body
  let body: string;
  if (template) {
    body = getSMSTemplate(template, data);
    if (!body) {
      console.error(`[Twilio] Failed to generate message from template: ${template}`);
      return;
    }
  } else if (rawBody) {
    body = rawBody;
  } else {
    console.error('[Twilio] No message body or template provided');
    return;
  }

  // Truncate if too long
  body = truncateForSMS(body);

  try {
    // Send SMS via Twilio
    const result = await twilioClient.messages.create({
      to: formattedTo,
      from,
      body,
    });

    console.log(`[Twilio] SMS sent successfully, sid: ${result.sid}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Twilio] Failed to send SMS:', errorMessage);

    // Check if it's a retryable error
    const isRetryable = isRetryableError(error);
    
    if (isRetryable) {
      await queueForRetry({
        type: 'sms',
        to: formattedTo,
        body,
        from,
        attempt: 1,
        maxRetries: 3,
      });
    }
  }
}

/**
 * Check if an error is retryable
 * Based on Twilio error codes
 * 
 * @param error - Error from Twilio
 * @returns boolean indicating if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const err = error as { code?: number; status?: number };
  
  // Retry on network errors (no code)
  if (!err.code) return true;
  
  // Retry on rate limits (20429)
  if (err.code === 20429) return true;
  
  // Retry on server errors
  if (err.code >= 20500 && err.code < 20600) return true;
  
  // Don't retry on invalid numbers (21211)
  if (err.code === 21211) return false;
  
  // Don't retry on unauthorized (20003)
  if (err.code === 20003) return false;
  
  // Don't retry on invalid 'From' number (21606)
  if (err.code === 21606) return false;
  
  return true;
}

/**
 * Process SMS retry queue
 * Should be called by a background worker periodically
 * 
 * @returns Promise<void>
 */
export async function processRetryQueue(): Promise<void> {
  if (!isInitialized) {
    initializeTwilio();
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('[Twilio] Cannot process retry queue: Credentials not configured');
    return;
  }

  if (!twilioClient) {
    console.error('[Twilio] Client not initialized');
    return;
  }

  try {
    const redis = getRedisClient();
    const now = Date.now();

    // Get jobs that are ready for retry (score <= now)
    const jobs = await redis.zrangebyscore('notifications:sms:retry', 0, now, 'LIMIT', 0, 100);

    if (jobs.length === 0) return;

    console.log(`[Twilio] Processing ${jobs.length} retry jobs`);

    for (const jobData of jobs) {
      try {
        const job: RetryQueueJob & { id?: string } = JSON.parse(jobData);
        
        // Remove from retry queue
        await redis.zrem('notifications:sms:retry', jobData);

        // Check if max retries reached
        if (job.attempt >= job.maxRetries) {
          console.error(`[Twilio] Max retries reached for job: ${job.id}`);
          // Move to dead letter queue
          await redis.lpush('notifications:sms:dead', jobData);
          continue;
        }

        // Attempt to send
        const result = await twilioClient.messages.create({
          to: job.to,
          from: job.from,
          body: job.body,
        });

        console.log(`[Twilio] Retry successful for job: ${job.id}, sid: ${result.sid}`);
      } catch (error) {
        // Re-queue with incremented attempt
        const job: RetryQueueJob & { id?: string; queuedAt?: string } = JSON.parse(jobData);
        job.attempt += 1;
        
        const isRetryable = isRetryableError(error);
        
        if (isRetryable && job.attempt < job.maxRetries) {
          const retryDelay = Math.pow(2, job.attempt) * 60;
          const score = Date.now() + retryDelay * 1000;
          await redis.zadd('notifications:sms:retry', score, JSON.stringify(job));
          console.log(`[Twilio] Re-queued for retry ${job.attempt}/${job.maxRetries}`);
        } else {
          // Move to dead letter queue
          await redis.lpush('notifications:sms:dead', jobData);
          console.error(`[Twilio] Moved to dead letter queue after ${job.attempt} attempts`);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Twilio] Error processing retry queue:', errorMessage);
  }
}

/**
 * Get message status from Twilio
 * 
 * @param messageSid - Twilio message SID
 * @returns Promise with message status
 */
export async function getMessageStatus(messageSid: string): Promise<{
  status: string;
  errorCode?: string;
  errorMessage?: string;
  dateSent?: Date;
  price?: string;
} | null> {
  if (!isInitialized) {
    initializeTwilio();
  }

  if (!twilioClient) {
    console.error('[Twilio] Client not initialized');
    return null;
  }

  try {
    const message = await twilioClient.messages(messageSid).fetch();
    return {
      status: message.status,
      errorCode: message.errorCode?.toString(),
      errorMessage: message.errorMessage,
      dateSent: message.dateSent,
      price: message.price,
    };
  } catch (error) {
    console.error('[Twilio] Failed to fetch message status:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export default {
  initializeTwilio,
  sendSMS,
  formatPhoneNumber,
  isValidPhoneNumber,
  getSMSTemplate,
  processRetryQueue,
  getMessageStatus,
};
