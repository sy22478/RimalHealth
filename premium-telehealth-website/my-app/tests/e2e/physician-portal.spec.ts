import { test, expect, Page } from '@playwright/test';

/**
 * Physician Portal E2E Tests
 *
 * Tests the core physician portal pages after login.
 * Uses the seeded test account: dr.sarah.johnson@rimalhealth.test
 */

const TEST_PHYSICIAN = {
  email: 'dr.sarah.johnson@rimalhealth.test',
  password: 'TestPhysician123!',
};

/** Login helper — fills form and waits for redirect */
async function loginAsTestPhysician(page: Page): Promise<void> {
  await page.goto('/physician/login');
  await page.waitForSelector('[name="email"]', { state: 'visible' });
  await page.fill('[name="email"]', TEST_PHYSICIAN.email);
  await page.fill('[name="password"]', TEST_PHYSICIAN.password);
  await page.click('button[type="submit"]');
  // Physician lands on /physician/dashboard or /physician/queue
  await page.waitForURL(/\/physician\//, { timeout: 15000 });
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

test.describe('Physician Portal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestPhysician(page);
  });

  test('dashboard loads with stats', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/physician/dashboard');
      await page.waitForLoadState('networkidle');
    });

    // Should have a heading or stats
    await expect(page.locator('h1, h2').first()).toBeVisible();

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('queue page loads', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/physician/queue');
      await page.waitForLoadState('networkidle');
    });

    await expect(
      page.locator('text=Queue, text=Review, text=Pending, h1, h2').first(),
    ).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('patients page loads', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/physician/patients');
      await page.waitForLoadState('networkidle');
    });

    await expect(
      page.locator('text=Patients, text=Patient, h1, h2').first(),
    ).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('prescriptions page loads', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/physician/prescriptions');
      await page.waitForLoadState('networkidle');
    });

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
      await page.goto('/physician/messages');
      await page.waitForLoadState('networkidle');
    });

    await expect(
      page.locator('text=Messages, text=message, h1, h2').first(),
    ).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
