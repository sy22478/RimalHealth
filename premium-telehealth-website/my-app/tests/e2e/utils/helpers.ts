import { Page, Locator, expect } from '@playwright/test';

/**
 * Helper Utilities for E2E Tests
 */

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Fill form field with retry logic
 */
export async function fillField(
  page: Page, 
  selector: string, 
  value: string, 
  options?: { clear?: boolean }
): Promise<void> {
  const field = page.locator(selector).first();
  await field.waitFor({ state: 'visible' });
  
  if (options?.clear !== false) {
    await field.fill('');
  }
  
  await field.fill(value);
}

/**
 * Select option from dropdown by label
 */
export async function selectOptionByLabel(
  page: Page, 
  selector: string, 
  label: string
): Promise<void> {
  await page.locator(selector).selectOption({ label });
}

/**
 * Select option from dropdown by value
 */
export async function selectOptionByValue(
  page: Page, 
  selector: string, 
  value: string
): Promise<void> {
  await page.locator(selector).selectOption({ value });
}

/**
 * Check if element exists
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  const count = await page.locator(selector).count();
  return count > 0;
}

/**
 * Wait for element to disappear
 */
export async function waitForElementToDisappear(
  page: Page, 
  selector: string, 
  timeout?: number
): Promise<void> {
  await page.locator(selector).waitFor({ state: 'detached', timeout });
}

/**
 * Get text content of element
 */
export async function getElementText(page: Page, selector: string): Promise<string | null> {
  return await page.locator(selector).textContent();
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: `./test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true 
  });
}

/**
 * Scroll to element
 */
export async function scrollToElement(page: Page, selector: string): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Wait for toast/notification
 */
export async function waitForToast(
  page: Page, 
  message: string | RegExp, 
  options?: { timeout?: number; type?: 'success' | 'error' | 'info' }
): Promise<void> {
  const timeout = options?.timeout || 10000;
  
  // Common toast selectors
  const toastSelectors = [
    '[role="alert"]',
    '[data-testid="toast"]',
    '.toast',
    '.notification',
    '.alert',
  ];
  
  for (const selector of toastSelectors) {
    const locator = page.locator(selector).filter({ hasText: message });
    try {
      await locator.waitFor({ state: 'visible', timeout: 2000 });
      return;
    } catch {
      continue;
    }
  }
  
  // Fallback: check page content
  await expect(page.locator('body')).toContainText(message, { timeout });
}

/**
 * Clear all cookies and storage
 */
export async function clearBrowserData(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  const context = page.context();
  await context.clearCookies();
}

/**
 * Fill date input with proper formatting
 */
export async function fillDateInput(
  page: Page, 
  selector: string, 
  date: string // MM/DD/YYYY format
): Promise<void> {
  const field = page.locator(selector);
  await field.fill(date);
  
  // Trigger blur to ensure validation runs
  await field.blur();
}

/**
 * Fill phone input with proper formatting
 */
export async function fillPhoneInput(
  page: Page, 
  selector: string, 
  phone: string
): Promise<void> {
  const field = page.locator(selector);
  
  // Clear existing value
  await field.fill('');
  
  // Type phone number character by character to trigger formatting
  const digits = phone.replace(/\D/g, '');
  await field.type(digits, { delay: 10 });
}

/**
 * Check checkbox by label text
 */
export async function checkCheckboxByLabel(
  page: Page, 
  labelText: string
): Promise<void> {
  // Find checkbox by associated label
  const label = page.locator('label', { hasText: labelText });
  
  // Try to find the checkbox by for attribute
  const forAttr = await label.getAttribute('for');
  if (forAttr) {
    await page.locator(`#${forAttr}`).check();
  } else {
    // Click the label directly
    await label.click();
  }
}

/**
 * Get current URL path
 */
export async function getCurrentPath(page: Page): Promise<string> {
  const url = new URL(page.url());
  return url.pathname;
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page, 
  urlPattern: string | RegExp, 
  options?: { timeout?: number }
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout: options?.timeout || 10000 }
  );
}
