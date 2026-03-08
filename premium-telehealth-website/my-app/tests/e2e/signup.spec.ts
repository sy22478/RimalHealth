import { test, expect, Page } from '@playwright/test';
import { generateTestPatient } from './fixtures/test-users';
import { waitForPageLoad, waitForToast } from './utils/helpers';

/**
 * Sign Up Flow E2E Tests
 * 
 * Tests the user registration flow:
 * 1. Navigate to signup page
 * 2. Fill registration form
 * 3. Accept terms
 * 4. Submit form
 * 5. Verify redirect to checkout
 */

test.describe('Sign Up Flow', () => {
  let patient = generateTestPatient();

  test.beforeEach(async ({ page }) => {
    // Generate fresh test data for each test
    patient = generateTestPatient();
    
    // Navigate to signup page
    await page.goto('/signup');
    await waitForPageLoad(page);
  });

  test('should display signup page with all required elements', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Create Your Account');
    
    // Check form fields exist
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[name="password"]')).toBeVisible();
    await expect(page.locator('[name="confirmPassword"]')).toBeVisible();
    await expect(page.locator('[name="termsAccepted"]')).toBeVisible();
    
    // Check submit button
    await expect(page.locator('button[type="submit"]')).toContainText('Create Account');
    
    // Check HIPAA notice
    await expect(page.locator('text=HIPAA Compliant')).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({ page }) => {
    // Submit empty form
    await page.click('button[type="submit"]');
    
    // Check validation errors appear
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible();
    await expect(page.locator('text=Password must be at least 12 characters')).toBeVisible();
  });

  test('should show error for invalid email', async ({ page }) => {
    // Fill invalid email
    await page.fill('[name="email"]', 'invalid-email');
    await page.fill('[name="password"]', patient.password);
    await page.locator('[name="email"]').blur();
    
    // Check email validation error
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible();
  });

  test('should show password strength indicator', async ({ page }) => {
    // Type weak password
    await page.fill('[name="password"]', 'weak');
    
    // Check strength indicator appears
    await expect(page.locator('text=Password strength:')).toBeVisible();
    
    // Type strong password
    await page.fill('[name="password"]', patient.password);
    
    // Check strength improves
    await expect(page.locator('text=Strong')).toBeVisible();
  });

  test('should show error when passwords do not match', async ({ page }) => {
    // Fill form with mismatched passwords
    await page.fill('[name="email"]', patient.email);
    await page.fill('[name="password"]', patient.password);
    await page.fill('[name="confirmPassword"]', 'DifferentPassword123!');
    await page.check('[name="termsAccepted"]');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check password match error
    await expect(page.locator("text=Passwords don't match")).toBeVisible();
  });

  test('should show error when terms are not accepted', async ({ page }) => {
    // Fill form without checking terms
    await page.fill('[name="email"]', patient.email);
    await page.fill('[name="password"]', patient.password);
    await page.fill('[name="confirmPassword"]', patient.password);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check terms validation error
    await expect(page.locator('text=You must accept the Terms of Service')).toBeVisible();
  });

  test('should successfully create account and redirect to checkout', async ({ page }) => {
    // Fill valid form data
    await fillSignupForm(page, patient);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for API call to complete
    await page.waitForResponse(
      (response) => response.url().includes('/api/auth/register'),
      { timeout: 10000 }
    );
    
    // Verify redirect to checkout page
    await expect(page).toHaveURL('/checkout', { timeout: 10000 });
    
    // Verify welcome message or checkout page content
    await expect(page.locator('text=Complete Your Profile')).toBeVisible();
  });

  test('should show error for existing email', async ({ page }) => {
    // This test assumes the patient was already created
    // First, create an account
    await fillSignupForm(page, patient);
    await page.click('button[type="submit"]');
    
    // Wait for registration
    try {
      await page.waitForURL('/checkout', { timeout: 10000 });
    } catch {
      // May already exist, continue
    }
    
    // Navigate back to signup
    await page.goto('/signup');
    
    // Try to register with same email
    await fillSignupForm(page, patient);
    await page.click('button[type="submit"]');
    
    // Wait for API response
    await page.waitForResponse(
      (response) => response.url().includes('/api/auth/register'),
      { timeout: 10000 }
    );
    
    // Check error message
    await expect(page.locator('text=already registered')).toBeVisible();
  });

  test('should allow navigation to login page', async ({ page }) => {
    // Click sign in link
    await page.click('text=Sign In');
    
    // Verify navigation to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h1')).toContainText('Welcome Back');
  });

  test('should have accessible form elements', async ({ page }) => {
    // Check ARIA labels
    await expect(page.locator('[name="email"]')).toHaveAttribute('aria-invalid', 'false');
    
    // Check terms checkbox links open in new tab
    const termsLink = page.locator('a[href="/terms"]');
    await expect(termsLink).toHaveAttribute('target', '_blank');
    
    const privacyLink = page.locator('a[href="/privacy"]');
    await expect(privacyLink).toHaveAttribute('target', '_blank');
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator('[name="password"]');
    const toggleButton = page.locator('button[aria-label="Show password"]').first();
    
    // Password should be hidden by default
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle
    await toggleButton.click();
    
    // Password should be visible
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click toggle again
    await toggleButton.click();
    
    // Password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

/**
 * Helper function to fill signup form
 */
async function fillSignupForm(page: Page, patient: ReturnType<typeof generateTestPatient>): Promise<void> {
  await page.fill('[name="email"]', patient.email);
  await page.fill('[name="password"]', patient.password);
  await page.fill('[name="confirmPassword"]', patient.password);
  await page.check('[name="termsAccepted"]');
}
