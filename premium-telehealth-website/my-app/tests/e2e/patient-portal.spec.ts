import { test, expect, Page } from '@playwright/test';

/**
 * Patient Portal E2E Tests
 *
 * Tests the core patient portal pages after login.
 * Uses the seeded test account: patient.test@rimalhealth.test
 */

const TEST_PATIENT = {
  email: 'patient.test@rimalhealth.test',
  password: 'TestPatient123@',
};

/** Login helper — fills form and waits for redirect */
async function loginAsTestPatient(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForSelector('[name="email"]', { state: 'visible' });
  await page.fill('[name="email"]', TEST_PATIENT.email);
  await page.fill('[name="password"]', TEST_PATIENT.password);
  await page.click('button[type="submit"]');
  // Patient may land on /patient/dashboard or /intake depending on intake status
  await page.waitForURL(/\/(patient|intake)/, { timeout: 15000 });
}

/** Collect console errors during a callback */
async function collectConsoleErrors(
  page: Page,
  fn: () => Promise<void>,
): Promise<string[]> {
  const errors: string[] = [];
  const handler = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  };
  page.on('console', handler);
  await fn();
  page.off('console', handler);
  return errors;
}

test.describe('Patient Portal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestPatient(page);
  });

  test('dashboard loads without console errors', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/patient/dashboard');
      await page.waitForLoadState('networkidle');
    });

    // Page should have a heading
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Filter out non-critical browser warnings (e.g., favicon 404)
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('profile page loads', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/patient/profile');
      await page.waitForLoadState('networkidle');
    });

    // Should see profile form or heading
    await expect(
      page.locator('text=Personal Information, text=Profile, h1, h2').first(),
    ).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('documents page loads', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/patient/documents');
      await page.waitForLoadState('networkidle');
    });

    // Should see documents heading or upload area
    await expect(
      page.locator('text=Documents, text=Upload, h1, h2').first(),
    ).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('billing page loads', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/patient/billing');
      await page.waitForLoadState('networkidle');
    });

    // Should see billing heading or subscription info
    await expect(
      page.locator('text=Billing, text=Subscription, h1, h2').first(),
    ).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('prescriptions page loads', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/patient/prescriptions');
      await page.waitForLoadState('networkidle');
    });

    // Should see prescriptions heading or status message
    await expect(
      page.locator('text=Prescriptions, text=prescription, h1, h2').first(),
    ).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('messages page loads', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/patient/messages');
      await page.waitForLoadState('networkidle');
    });

    // Should see messages heading or thread list
    await expect(
      page.locator('text=Messages, text=message, h1, h2').first(),
    ).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
