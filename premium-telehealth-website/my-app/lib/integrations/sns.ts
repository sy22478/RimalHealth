/**
 * Amazon SNS SMS Integration
 *
 * Drop-in replacement for Twilio's sendSMS.
 * Uses the ECS task role for authentication — no explicit credentials needed.
 *
 * HIPAA Compliance Notes:
 * - No PHI logged to console or errors
 * - All errors are logged generically without phone number details
 * - Phone numbers are formatted to E.164 before sending
 * - SNS handles retries internally — no retry queue needed
 *
 * @module lib/integrations/sns
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { smsTemplates, SMSTemplate } from '@/lib/notifications/templates';

const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  // No credentials needed — ECS task role provides them automatically
});

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
  /** Unused — kept for interface compatibility with Twilio */
  from?: string;
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
 */
export function getSMSTemplate(
  template: SMSTemplate,
  data: Record<string, string>
): string {
  const templateGenerator = smsTemplates[template];
  if (!templateGenerator) {
    console.error(`[SNS] Unknown SMS template: ${template}`);
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
 * Send SMS using Amazon SNS
 *
 * Never throws — logs errors and continues.
 * Validates and formats phone number to E.164.
 * SNS handles delivery retries internally.
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
  const { to, template, data = {}, body: rawBody } = options;

  // Format and validate phone number
  const formattedTo = formatPhoneNumber(to);
  if (!formattedTo) {
    console.error('[SNS] Invalid phone number format');
    return;
  }

  // Get message body from template or use raw body
  let body: string;
  if (template) {
    body = getSMSTemplate(template, data);
    if (!body) {
      console.error(`[SNS] Failed to generate message from template: ${template}`);
      return;
    }
  } else if (rawBody) {
    body = rawBody;
  } else {
    console.error('[SNS] No message body or template provided');
    return;
  }

  // Truncate if too long
  body = truncateForSMS(body);

  try {
    const command = new PublishCommand({
      PhoneNumber: formattedTo,
      Message: body,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    });

    const result = await snsClient.send(command);
    console.log(`[SNS] SMS sent successfully, messageId: ${result.MessageId}`);
  } catch (error) {
    console.error(
      '[SNS] Failed to send SMS:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

export default {
  sendSMS,
  formatPhoneNumber,
  isValidPhoneNumber,
  getSMSTemplate,
};
