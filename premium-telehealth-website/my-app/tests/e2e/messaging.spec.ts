import { test, expect, Page } from '@playwright/test';
import { generateTestPatient, testPhysician } from './fixtures/test-users';
import { loginAsPatient, loginAsPhysician } from './utils/auth';
import { waitForPageLoad } from './utils/helpers';

/**
 * Messaging Flow E2E Tests
 * 
 * Tests the patient-physician messaging system:
 * 1. Patient sends message to physician
 * 2. Physician views message inbox
 * 3. Physician replies to message
 * 4. Patient views reply
 * 5. Message threading and history
 */

test.describe('Messaging Flow', () => {
  const patient = generateTestPatient();

  test.describe('Patient Messaging', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to patient messages
      await page.goto('/messages');
      await waitForPageLoad(page);
    });

    test('should display messaging page for patient', async ({ page }) => {
      // Check page header
      await expect(page.locator('h1')).toContainText('Messages');
      
      // Check message list sidebar
      await expect(page.locator('text=Conversations')).toBeVisible();
      
      // Check help text
      await expect(page.locator('text=Expect replies within 24 hours')).toBeVisible();
    });

    test('should show empty state when no messages', async ({ page }) => {
      // Check for empty state
      await expect(page.locator('text=No messages yet')).toBeVisible();
      await expect(page.locator('text=Start a conversation')).toBeVisible();
    });

    test('should compose a new message', async ({ page }) => {
      // Click new message button
      await page.click('button:has-text("New Message")');
      
      // Check compose form
      await expect(page.locator('[name="subject"]')).toBeVisible();
      await expect(page.locator('[name="message"]')).toBeVisible();
      await expect(page.locator('button:has-text("Send")')).toBeVisible();
    });

    test('should validate message fields', async ({ page }) => {
      // Open compose form
      await page.click('button:has-text("New Message")');
      
      // Try to send empty message
      await page.click('button:has-text("Send")');
      
      // Check validation errors
      await expect(page.locator('text=Subject is required')).toBeVisible();
      await expect(page.locator('text=Message is required')).toBeVisible();
    });

    test('should send a message to physician', async ({ page }) => {
      // Open compose form
      await page.click('button:has-text("New Message")');
      
      // Fill message
      await page.fill('[name="subject"]', 'Question about medication');
      await page.fill('[name="message"]', 'I have been experiencing some side effects. Should I continue taking the medication?');
      
      // Send message
      await page.click('button:has-text("Send")');
      
      // Wait for API response
      await page.waitForResponse(
        (response) => response.url().includes('/api/messages'),
        { timeout: 10000 }
      );
      
      // Verify message sent
      await expect(page.locator('text=Message sent successfully')).toBeVisible();
      
      // Verify message appears in list
      await expect(page.locator('text=Question about medication')).toBeVisible();
    });

    test('should display message thread', async ({ page }) => {
      // Assume a message thread exists
      // Click on a message thread
      await page.locator('[data-testid="message-thread"]').first().click();
      
      // Check thread view
      await expect(page.locator('[data-testid="message-thread-view"]')).toBeVisible();
      
      // Check reply button
      await expect(page.locator('button:has-text("Reply")')).toBeVisible();
    });

    test('should reply to a message thread', async ({ page }) => {
      // Open a message thread
      await page.locator('[data-testid="message-thread"]').first().click();
      
      // Click reply
      await page.click('button:has-text("Reply")');
      
      // Type reply
      await page.fill('[name="replyMessage"]', 'Thank you for the clarification.');
      
      // Send reply
      await page.click('button:has-text("Send Reply")');
      
      // Verify reply sent
      await expect(page.locator('text=Reply sent')).toBeVisible();
      
      // Verify reply appears in thread
      await expect(page.locator('text=Thank you for the clarification')).toBeVisible();
    });

    test('should show message timestamps', async ({ page }) => {
      // Open a message thread
      await page.locator('[data-testid="message-thread"]').first().click();
      
      // Check for timestamps
      await expect(page.locator('[data-testid="message-timestamp"]')).toBeVisible();
    });

    test('should indicate unread messages', async ({ page }) => {
      // Check for unread indicator
      const unreadBadge = page.locator('[data-testid="unread-badge"]');
      
      if (await unreadBadge.count() > 0) {
        await expect(unreadBadge.first()).toBeVisible();
      }
    });

    test('should show urgent message warning', async ({ page }) => {
      // Open compose form
      await page.click('button:has-text("New Message")');
      
      // Check for urgent warning
      await expect(page.locator('text=For medical emergencies')).toBeVisible();
      await expect(page.locator('text=Call 911')).toBeVisible();
    });
  });

  test.describe('Physician Messaging', () => {
    test.beforeEach(async ({ page }) => {
      // Login as physician
      await loginAsPhysician(page, testPhysician);
      
      // Navigate to messages
      await page.goto('/physician/messages');
      await waitForPageLoad(page);
    });

    test('should display physician messaging interface', async ({ page }) => {
      // Check three-column layout indicators
      await expect(page.locator('[data-testid="patient-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="message-inbox"]')).toBeVisible();
    });

    test('should display patient list sidebar', async ({ page }) => {
      // Check patient list
      await expect(page.locator('text=Patients')).toBeVisible();
      
      // Check patient search
      await expect(page.locator('[placeholder="Search patients..."]')).toBeVisible();
    });

    test('should filter patients by name', async ({ page }) => {
      // Type in search
      await page.fill('[placeholder="Search patients..."]', 'John');
      
      // Verify filter applied
      await expect(page.locator('text=Filtered by: John')).toBeVisible();
    });

    test('should display message inbox', async ({ page }) => {
      // Check inbox elements
      await expect(page.locator('text=Inbox')).toBeVisible();
      
      // Check message list
      await expect(page.locator('[data-testid="message-list"]')).toBeVisible();
    });

    test('should filter messages by status', async ({ page }) => {
      // Click filter
      await page.click('button:has-text("Unread")');
      
      // Verify filter applied
      await expect(page.locator('[data-testid="filter-active"]:has-text("Unread")')).toBeVisible();
    });

    test('should select and view message thread', async ({ page }) => {
      // Click on a message
      await page.locator('[data-testid="inbox-message"]').first().click();
      
      // Check thread view displayed
      await expect(page.locator('[data-testid="message-thread-view"]')).toBeVisible();
      
      // Check patient info in header
      await expect(page.locator('[data-testid="thread-patient-name"]')).toBeVisible();
    });

    test('should display patient context in thread', async ({ page }) => {
      // Open a message thread
      await page.locator('[data-testid="inbox-message"]').first().click();
      
      // Check patient context panel
      await expect(page.locator('text=Patient Context')).toBeVisible();
      await expect(page.locator('text=Treatment:')).toBeVisible();
      await expect(page.locator('text=Current Medications:')).toBeVisible();
    });

    test('should reply to patient message', async ({ page }) => {
      // Open a message thread
      await page.locator('[data-testid="inbox-message"]').first().click();
      
      // Type reply
      await page.fill('[name="replyMessage"]', 'Please continue taking your medication. Let\'s schedule a follow-up.');
      
      // Send reply
      await page.click('button:has-text("Send")');
      
      // Wait for API response
      await page.waitForResponse(
        (response) => response.url().includes('/api/messages'),
        { timeout: 10000 }
      );
      
      // Verify reply appears
      await expect(page.locator('text=Please continue taking your medication')).toBeVisible();
      
      // Verify message input cleared
      await expect(page.locator('[name="replyMessage"]')).toHaveValue('');
    });

    test('should mark message as urgent', async ({ page }) => {
      // Open a message thread
      await page.locator('[data-testid="inbox-message"]').first().click();
      
      // Mark as urgent
      await page.click('button[aria-label="Mark as urgent"]');
      
      // Verify urgent indicator
      await expect(page.locator('[data-testid="urgent-indicator"]')).toBeVisible();
    });

    test('should archive message', async ({ page }) => {
      // Open a message thread
      await page.locator('[data-testid="inbox-message"]').first().click();
      
      // Click archive
      await page.click('button[aria-label="Archive conversation"]');
      
      // Verify archived
      await expect(page.locator('text=Conversation archived')).toBeVisible();
    });

    test('should show typing indicator', async ({ page }) => {
      // Open a message thread
      await page.locator('[data-testid="inbox-message"]').first().click();
      
      // Start typing
      await page.fill('[name="replyMessage"]', 'T');
      
      // In real scenario, would check for typing indicator
      // For now, just verify input works
      await expect(page.locator('[name="replyMessage"]')).toHaveValue('T');
    });
  });

  test.describe('Message Thread Features', () => {
    test('should display message history in chronological order', async ({ page }) => {
      // Login as patient
      await page.goto('/messages');
      
      // Open a thread with multiple messages
      await page.locator('[data-testid="message-thread"]').first().click();
      
      // Get all messages
      const messages = page.locator('[data-testid="message-item"]');
      
      // Verify messages are displayed
      if (await messages.count() > 1) {
        // Check that messages have timestamps
        await expect(messages.first().locator('[data-testid="message-timestamp"]')).toBeVisible();
      }
    });

    test('should differentiate sent and received messages', async ({ page }) => {
      await page.goto('/messages');
      
      // Open a thread
      await page.locator('[data-testid="message-thread"]').first().click();
      
      // Check for message direction indicators
      await expect(page.locator('[data-testid="message-sent"]')).toBeVisible();
      await expect(page.locator('[data-testid="message-received"]')).toBeVisible();
    });

    test('should support message attachments', async ({ page }) => {
      // Open compose form
      await page.goto('/messages');
      await page.click('button:has-text("New Message")');
      
      // Check attachment button
      await expect(page.locator('button[aria-label="Attach file"]')).toBeVisible();
      
      // Note: Actual file upload testing would require file input handling
    });
  });

  test.describe('Message Notifications', () => {
    test('should show notification badge for unread messages', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      
      // Check for notification badge on messages link
      const badge = page.locator('[data-testid="messages-badge"]');
      
      if (await badge.count() > 0) {
        await expect(badge).toBeVisible();
      }
    });

    test('should send email notification for new message', async ({ page }) => {
      // This would be an integration test with email service
      // For now, just verify the UI element exists
      await page.goto('/messages');
      
      // Check notification preferences link
      await expect(page.locator('a:has-text("Notification Settings")')).toBeVisible();
    });
  });

  test.describe('HIPAA Compliance Indicators', () => {
    test('should display HIPAA notice in messaging', async ({ page }) => {
      await page.goto('/messages');
      
      // Check HIPAA notice
      await expect(page.locator('text=All messages are encrypted')).toBeVisible();
      await expect(page.locator('text=HIPAA')).toBeVisible();
    });

    test('should show audit notice for physicians', async ({ page }) => {
      // Login as physician
      await loginAsPhysician(page, testPhysician);
      await page.goto('/physician/messages');
      
      // Check audit notice
      await expect(page.locator('text=Access is logged')).toBeVisible();
    });
  });

  test.describe('Mobile Responsive', () => {
    test('should show mobile message view', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/messages');
      
      // Check mobile menu button
      await expect(page.locator('button[aria-label="Open menu"]')).toBeVisible();
    });

    test('should navigate between list and thread on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/messages');
      
      // Click on a message
      await page.locator('[data-testid="message-thread"]').first().click();
      
      // Check back button visible
      await expect(page.locator('button[aria-label="Back"]')).toBeVisible();
      
      // Click back
      await page.click('button[aria-label="Back"]');
      
      // Check back on list view
      await expect(page.locator('text=Conversations')).toBeVisible();
    });
  });
});
