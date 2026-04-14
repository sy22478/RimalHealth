/**
 * Amazon SES Email Integration
 *
 * Uses the ECS task role for authentication — no explicit credentials needed.
 *
 * HIPAA Compliance Notes:
 * - No PHI logged to console or errors
 * - All errors are logged generically without recipient details
 *
 * @module lib/integrations/ses
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  // No credentials needed — ECS task role provides them automatically
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@rimalhealth.com';
const FROM_NAME = process.env.SES_FROM_NAME || 'Rimal Health';

export interface SESSendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  bcc?: string | string[];
}

export async function sesSendEmail(
  options: SESSendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
  const bccAddresses = options.bcc
    ? Array.isArray(options.bcc)
      ? options.bcc
      : [options.bcc]
    : undefined;

  try {
    const command = new SendEmailCommand({
      Source: `${FROM_NAME} <${FROM_EMAIL}>`,
      Destination: {
        ToAddresses: toAddresses,
        ...(bccAddresses ? { BccAddresses: bccAddresses } : {}),
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: options.html,
            Charset: 'UTF-8',
          },
          ...(options.text
            ? {
                Text: {
                  Data: options.text,
                  Charset: 'UTF-8',
                },
              }
            : {}),
        },
      },
      ...(options.replyTo ? { ReplyToAddresses: [options.replyTo] } : {}),
    });

    const result = await sesClient.send(command);
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error(
      '[SES] Failed to send email:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
