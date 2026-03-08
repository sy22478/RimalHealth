/**
 * Email and SMS Templates
 * 
 * HIPAA Compliance Notes:
 * - Templates should not log PHI
 * - No sensitive data in template names or logs
 * - All data interpolation happens at runtime
 * 
 * @module lib/notifications/templates
 */

import { siteConfig } from '@/lib/constants';

/**
 * Email template identifiers
 */
export enum EmailTemplate {
  WELCOME = 'welcome',
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  INTAKE_SUBMITTED = 'intake_submitted',
  INTAKE_APPROVED = 'intake_approved',
  INTAKE_REJECTED = 'intake_rejected',
  INTAKE_NEEDS_INFO = 'intake_needs_info',
  INTAKE_CONFIRMATION = 'intake_confirmation',
  NEW_INTAKE_PENDING = 'new_intake_pending',
  REFILL_REQUESTED = 'refill_requested',
  REFILL_APPROVED = 'refill_approved',
  PRESCRIPTION_SENT = 'prescription_sent',
  MESSAGE_RECEIVED = 'message_received',
  PAYMENT_RECEIPT = 'payment_receipt',
  PAYMENT_FAILED = 'payment_failed',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  SET_PASSWORD = 'set_password',
  GENERIC_NOTIFICATION = 'generic_notification',
  ADMIN_ALERT = 'admin_alert',
}

/**
 * SMS template identifiers
 */
export enum SMSTemplate {
  VERIFICATION_CODE = 'verification_code',
  INTAKE_APPROVED = 'intake_approved',
  PRESCRIPTION_READY = 'prescription_ready',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  MESSAGE_NOTIFICATION = 'message_notification',
  STATUS_UPDATE = 'status_update',
  MESSAGE_RECEIVED = 'message_received',
}

/**
 * Interpolate template string with data
 * Replaces {{key}} with corresponding value from data
 * 
 * @param template - Template string with {{placeholders}}
 * @param data - Key-value pairs for interpolation
 * @returns Interpolated string
 * 
 * @example
 * interpolateTemplate('Hello {{name}}!', { name: 'John' }) // 'Hello John!'
 */
export function interpolateTemplate(
  template: string,
  data: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/**
 * Strip HTML tags from string
 * Used to generate plain text version from HTML
 * 
 * @param html - HTML string
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .replace(/&nbsp;/g, ' ')  // Replace &nbsp; with space
    .replace(/&amp;/g, '&')   // Decode &amp;
    .replace(/&lt;/g, '<')    // Decode &lt;
    .replace(/&gt;/g, '>')    // Decode &gt;
    .replace(/&quot;/g, '"')  // Decode &quot;
    .trim();
}

/**
 * Email template content generator
 * Returns subject, HTML, and plain text versions
 */
export type EmailTemplateGenerator = (
  data: Record<string, string>
) => {
  subject: string;
  html: string;
  text: string;
};

/**
 * Generate email header with branding
 */
function generateEmailHeader(): string {
  return `
    <div style="background: #0a2540; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${siteConfig.name}
      </h1>
    </div>
  `;
}

/**
 * Generate email footer with contact info
 */
function generateEmailFooter(): string {
  return `
    <div style="background: #f6f9fc; padding: 20px; text-align: center; border-top: 1px solid #e1e8ed; margin-top: 30px;">
      <p style="color: #6b7280; font-size: 14px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Questions? Contact us at <a href="mailto:${siteConfig.supportEmail}" style="color: #0a2540;">${siteConfig.supportEmail}</a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${siteConfig.name} | California-licensed telehealth
      </p>
    </div>
  `;
}

/**
 * Wrap content in standard email layout
 */
function wrapEmail(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background: #f6f9fc;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" style="width: 600px; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <tr>
                <td>
                  ${generateEmailHeader()}
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #374151;">
                  ${content}
                </td>
              </tr>
              <tr>
                <td>
                  ${generateEmailFooter()}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Email templates collection
 * Each template generates subject, HTML, and plain text versions
 */
export const emailTemplates: Record<EmailTemplate, EmailTemplateGenerator> = {
  [EmailTemplate.WELCOME]: (data) => {
    const firstName = data.firstName || 'there';
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Welcome to ${siteConfig.name}!</h2>
      <p>Hi ${firstName},</p>
      <p>We're excited to have you on board. Your journey to better health starts now.</p>
      <p>Here's what you can do next:</p>
      <ul>
        <li>Complete your health intake form</li>
        <li>Explore your personalized treatment options</li>
        <li>Message our care team anytime</li>
      </ul>
      <p style="margin-top: 24px;">
        <a href="{{dashboardUrl}}" style="background: #0a2540; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Go to Dashboard
        </a>
      </p>
    `);
    const text = `Welcome to ${siteConfig.name}!

Hi ${firstName},

We're excited to have you on board. Your journey to better health starts now.

Here's what you can do next:
- Complete your health intake form
- Explore your personalized treatment options
- Message our care team anytime

Go to Dashboard: {{dashboardUrl}}

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: `Welcome to ${siteConfig.name}!`,
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.EMAIL_VERIFICATION]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Verify Your Email Address</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>Please verify your email address by clicking the button below:</p>
      <p style="margin: 24px 0;">
        <a href="{{verificationUrl}}" style="background: #0a2540; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
      </p>
    `);
    const text = `Verify Your Email Address

Hi ${data.firstName || 'there'},

Please verify your email address by clicking the link below:

{{verificationUrl}}

This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Verify Your Email Address',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.PASSWORD_RESET]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Reset Your Password</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="margin: 24px 0;">
        <a href="{{resetUrl}}" style="background: #0a2540; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
    `);
    const text = `Reset Your Password

Hi ${data.firstName || 'there'},

We received a request to reset your password. Click the link below to create a new password:

{{resetUrl}}

This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Reset Your Password',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.INTAKE_SUBMITTED]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Intake Form Submitted</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>We've received your health intake form. Our medical team will review it within 24 hours.</p>
      <p>You'll receive an email notification once your intake has been reviewed.</p>
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #166534; font-size: 14px;">
          <strong>Next Step:</strong> A California-licensed physician will review your information and create your personalized treatment plan.
        </p>
      </div>
    `);
    const text = `Intake Form Submitted

Hi ${data.firstName || 'there'},

We've received your health intake form. Our medical team will review it within 24 hours.

You'll receive an email notification once your intake has been reviewed.

Next Step: A California-licensed physician will review your information and create your personalized treatment plan.

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Intake Form Submitted - Under Review',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.INTAKE_APPROVED]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Great News! Your Intake is Approved</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>A California-licensed physician has reviewed and approved your intake.</p>
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #166534;">
          <strong>Your treatment plan is ready!</strong>
        </p>
      </div>
      <p>Your prescription has been sent to {{pharmacyName}}. You can pick it up or have it delivered.</p>
      <p style="margin-top: 24px;">
        <a href="{{dashboardUrl}}" style="background: #0a2540; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Treatment Plan
        </a>
      </p>
    `);
    const text = `Great News! Your Intake is Approved

Hi ${data.firstName || 'there'},

A California-licensed physician has reviewed and approved your intake.

Your treatment plan is ready!

Your prescription has been sent to {{pharmacyName}}. You can pick it up or have it delivered.

View Treatment Plan: {{dashboardUrl}}

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Your Intake Has Been Approved',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.INTAKE_REJECTED]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Update on Your Intake</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>After careful review, our medical team has determined that our telehealth service may not be the best fit for your current needs.</p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b;">
          <strong>Reason:</strong> ${data.reason || 'Your condition requires in-person medical care.'}
        </p>
      </div>
      <p>We recommend consulting with your primary care physician or visiting a local clinic for the care you need.</p>
      <p>If you have questions about this decision, please contact our support team.</p>
    `);
    const text = `Update on Your Intake

Hi ${data.firstName || 'there'},

After careful review, our medical team has determined that our telehealth service may not be the best fit for your current needs.

Reason: ${data.reason || 'Your condition requires in-person medical care.'}

We recommend consulting with your primary care physician or visiting a local clinic for the care you need.

If you have questions about this decision, please contact our support team at ${siteConfig.supportEmail}`;

    return {
      subject: 'Update on Your Intake',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.INTAKE_CONFIRMATION]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Intake Confirmation</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>Your intake form has been successfully submitted and payment received.</p>
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #166534; font-size: 14px;">
          <strong>What's Next:</strong> A California-licensed physician will review your intake within 24 hours.
        </p>
      </div>
      <p>You will receive an email notification once your intake has been reviewed.</p>
    `);
    const text = `Intake Confirmation

Hi ${data.firstName || 'there'},

Your intake form has been successfully submitted and payment received.

What's Next: A California-licensed physician will review your intake within 24 hours.

You will receive an email notification once your intake has been reviewed.

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Intake Confirmation - Payment Received',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.REFILL_REQUESTED]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Refill Request Received</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>We've received your prescription refill request.</p>
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #166534; font-size: 14px;">
          <strong>Medication:</strong> ${data.medicationName || '{{medicationName}}'}<br>
          <strong>Status:</strong> Under Review
        </p>
      </div>
      <p>Your physician will review your request within 24 hours. Once approved, your prescription will be sent to your pharmacy.</p>
      <p style="margin-top: 24px;">
        <a href="{{dashboardUrl}}" style="background: #0a2540; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Request Status
        </a>
      </p>
    `);
    const text = `Refill Request Received

Hi ${data.firstName || 'there'},

We've received your prescription refill request.

Medication: ${data.medicationName || '{{medicationName}}'}
Status: Under Review

Your physician will review your request within 24 hours. Once approved, your prescription will be sent to your pharmacy.

View Request Status: {{dashboardUrl}}

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Prescription Refill Request Received',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.PRESCRIPTION_SENT]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Your Prescription Has Been Sent</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>Your prescription has been sent to <strong>{{pharmacyName}}</strong>.</p>
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #166534;">
          <strong>Pharmacy:</strong> {{pharmacyName}}<br>
          <strong>Estimated ready time:</strong> {{readyTime}}
        </p>
      </div>
      <p>You can pick up your prescription or arrange for delivery through the pharmacy.</p>
      <p>Questions about your medication? Message your doctor anytime through your dashboard.</p>
    `);
    const text = `Your Prescription Has Been Sent

Hi ${data.firstName || 'there'},

Your prescription has been sent to {{pharmacyName}}.

Pharmacy: {{pharmacyName}}
Estimated ready time: {{readyTime}}

You can pick up your prescription or arrange for delivery through the pharmacy.

Questions about your medication? Message your doctor anytime through your dashboard.

${siteConfig.supportEmail}`;

    return {
      subject: 'Your Prescription Has Been Sent',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.MESSAGE_RECEIVED]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">New Message from Your Care Team</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>You have a new message from Dr. {{doctorName}}:</p>
      <div style="background: #f9fafb; border-left: 4px solid #0a2540; padding: 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
        <p style="margin: 0; color: #374151; font-style: italic;">
          "{{preview}}"
        </p>
      </div>
      <p style="margin-top: 24px;">
        <a href="{{messageUrl}}" style="background: #0a2540; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Read Full Message
        </a>
      </p>
    `);
    const text = `New Message from Your Care Team

Hi ${data.firstName || 'there'},

You have a new message from Dr. {{doctorName}}:

"{{preview}}"

Read Full Message: {{messageUrl}}

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'New Message from Your Care Team',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.PAYMENT_RECEIPT]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Payment Receipt</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>Thank you for your payment. Here's your receipt:</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.amount || '{{amount}}'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Date:</td>
            <td style="padding: 8px 0; text-align: right;">${data.date || '{{date}}'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Description:</td>
            <td style="padding: 8px 0; text-align: right;">${data.description || '{{description}}'}</td>
          </tr>
          <tr style="border-top: 1px solid #e5e7eb;">
            <td style="padding: 12px 0; font-weight: 600;">Total:</td>
            <td style="padding: 12px 0; text-align: right; font-weight: 600;">${data.amount || '{{amount}}'}</td>
          </tr>
        </table>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        Transaction ID: {{transactionId}}
      </p>
    `);
    const text = `Payment Receipt

Hi ${data.firstName || 'there'},

Thank you for your payment. Here's your receipt:

Amount: ${data.amount || '{{amount}}'}
Date: ${data.date || '{{date}}'}
Description: ${data.description || '{{description}}'}
Total: ${data.amount || '{{amount}}'}

Transaction ID: {{transactionId}}

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Payment Receipt - ' + siteConfig.name,
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.SUBSCRIPTION_CANCELLED]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Subscription Cancelled</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>Your subscription has been cancelled as requested.</p>
      <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #854d0e;">
          <strong>Access until:</strong> {{endDate}}
        </p>
      </div>
      <p>You will continue to have access until the end of your current billing period.</p>
      <p>We're sorry to see you go. If you change your mind, you can reactivate anytime from your dashboard.</p>
      <p style="margin-top: 24px;">
        <a href="{{feedbackUrl}}" style="background: transparent; color: #0a2540; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; border: 1px solid #0a2540;">
          Share Feedback
        </a>
      </p>
    `);
    const text = `Subscription Cancelled

Hi ${data.firstName || 'there'},

Your subscription has been cancelled as requested.

Access until: {{endDate}}

You will continue to have access until the end of your current billing period.

We're sorry to see you go. If you change your mind, you can reactivate anytime from your dashboard.

Share Feedback: {{feedbackUrl}}

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Subscription Cancelled',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.INTAKE_NEEDS_INFO]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Additional Information Needed</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>We need some additional information to complete your intake review.</p>
      <p>${data.message || 'Please log in to your account to provide the required information.'}</p>
      <p style="margin-top: 24px;">
        <a href="{{dashboardUrl}}" style="background: #0a2540; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Update Intake
        </a>
      </p>
    `);
    const text = `Additional Information Needed

Hi ${data.firstName || 'there'},

We need some additional information to complete your intake review.

${data.message || 'Please log in to your account to provide the required information.'}

Update Intake: {{dashboardUrl}}

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Additional Information Needed for Your Intake',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.NEW_INTAKE_PENDING]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">New Intake Pending Review</h2>
      <p>A new ${data.concernType || ''} intake is waiting for your review.</p>
      <p style="margin-top: 24px;">
        <a href="{{reviewUrl}}" style="background: #0a2540; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Review Intake
        </a>
      </p>
    `);
    const text = `New Intake Pending Review

A new ${data.concernType || ''} intake is waiting for your review.

Review Intake: {{reviewUrl}}

This is a notification for physicians.`;

    return {
      subject: 'New Intake Pending Review',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.REFILL_APPROVED]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Refill Request Approved</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>Your refill request has been approved and sent to your pharmacy.</p>
      <p>${data.message || ''}</p>
      <p style="margin-top: 24px;">
        <a href="{{dashboardUrl}}" style="background: #0a2540; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Prescriptions
        </a>
      </p>
    `);
    const text = `Refill Request Approved

Hi ${data.firstName || 'there'},

Your refill request has been approved and sent to your pharmacy.

${data.message || ''}

View Prescriptions: {{dashboardUrl}}

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Your Refill Request Has Been Approved',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.PAYMENT_FAILED]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #dc2626; margin-top: 0;">Payment Failed</h2>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>We were unable to process your payment. Please update your payment method to continue your treatment.</p>
      <p>${data.message || ''}</p>
      <p style="margin-top: 24px;">
        <a href="{{retryUrl}}" style="background: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Update Payment Method
        </a>
      </p>
    `);
    const text = `Payment Failed

Hi ${data.firstName || 'there'},

We were unable to process your payment. Please update your payment method to continue your treatment.

${data.message || ''}

Update Payment: {{retryUrl}}

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: 'Payment Failed - Action Required',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.GENERIC_NOTIFICATION]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">${data.subject || 'Notification'}</h2>
      <p>${data.message || ''}</p>
    `);
    const text = `${data.subject || 'Notification'}

${data.message || ''}

Questions? Contact us at ${siteConfig.supportEmail}`;

    return {
      subject: data.subject || 'Notification from Rimal Health',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.SET_PASSWORD]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #0a2540; margin-top: 0;">Set Your Password</h2>
      <p>Welcome to Rimal Health! Your payment was successful and your account has been created.</p>
      <p>Please set your password to access your account and begin your intake form:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{setPasswordUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6, #0284c7); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Set Your Password
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This link expires in 72 hours. If you did not make this purchase, please contact support.
      </p>
    `);
    const text = `Welcome to Rimal Health!

Your payment was successful and your account has been created.

Set your password here: {{setPasswordUrl}}

This link expires in 72 hours.`;

    return {
      subject: 'Set Your Password — Rimal Health',
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },

  [EmailTemplate.ADMIN_ALERT]: (data) => {
    const html = wrapEmail(`
      <h2 style="color: #dc2626; margin-top: 0;">🚨 Admin Alert</h2>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b; font-family: monospace;">
          {{message}}
        </p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This is an automated alert from the Rimal Health system.
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        Timestamp: ${new Date().toISOString()}
      </p>
    `);
    const text = `ADMIN ALERT

{{message}}

This is an automated alert from the Rimal Health system.
Timestamp: ${new Date().toISOString()}`;

    return {
      subject: `🚨 Admin Alert: ${data.subject || 'System Notification'}`,
      html: interpolateTemplate(html, data),
      text: interpolateTemplate(text, data),
    };
  },
};

/**
 * SMS template generators
 * Returns text content (max 160 chars recommended for single SMS)
 */
export const smsTemplates: Record<SMSTemplate, (data: Record<string, string>) => string> = {
  [SMSTemplate.VERIFICATION_CODE]: (data) => {
    return `Your ${siteConfig.name} verification code: ${data.code}. Valid for 10 minutes. Do not share this code.`;
  },

  [SMSTemplate.INTAKE_APPROVED]: (data) => {
    return `Great news ${data.firstName || ''}! Your ${siteConfig.name} intake has been approved. Check your email for details or visit: ${data.dashboardUrl || ''}`;
  },

  [SMSTemplate.PRESCRIPTION_READY]: (data) => {
    return `Your prescription has been sent to ${data.pharmacyName || 'your pharmacy'}. Estimated ready: ${data.readyTime || 'soon'}. ${siteConfig.name}`;
  },

  [SMSTemplate.APPOINTMENT_REMINDER]: (data) => {
    return `Reminder: You have a ${siteConfig.name} appointment on ${data.date || ''} at ${data.time || ''}. Reply CANCEL to reschedule.`;
  },

  [SMSTemplate.MESSAGE_NOTIFICATION]: (data) => {
    return `You have a new message from Dr. ${data.doctorName || 'your doctor'} on ${siteConfig.name}. Reply STOP to opt out of SMS.`;
  },

  [SMSTemplate.STATUS_UPDATE]: (data) => {
    return `Your ${siteConfig.name} status has been updated: ${data.status || ''}. ${data.message || ''}`.slice(0, 160);
  },

  [SMSTemplate.MESSAGE_RECEIVED]: (data) => {
    return `You have a new message on ${siteConfig.name}. ${data.preview || 'Check your account for details.'}`.slice(0, 160);
  },
};

export default {
  EmailTemplate,
  SMSTemplate,
  emailTemplates,
  smsTemplates,
  interpolateTemplate,
  stripHtml,
};
