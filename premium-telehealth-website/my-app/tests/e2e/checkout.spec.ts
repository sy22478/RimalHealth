import { test, expect, Page } from '@playwright/test';
import { generateTestPatient, testCards } from './fixtures/test-users';
import { loginAsPatient } from './utils/auth';
import { waitForPageLoad, fillPhoneInput } from './utils/helpers';

/**
 * Checkout Flow E2E Tests
 * 
 * Tests the multi-step checkout process:
 * 1. Login as patient
 * 2. Navigate to checkout
 * 3. Step 1: Fill personal info
 * 4. Step 2: Fill address
 * 5. Step 3: Screening questions
 * 6. Step 4: Review and confirm
 * 7. Redirect to payment
 */

test.describe('Checkout Flow', () => {
  const patient = generateTestPatient();

  test.beforeEach(async ({ page }) => {
    // Navigate to checkout
    await page.goto('/checkout');
    await waitForPageLoad(page);
  });

  test('should display checkout page with progress indicator', async ({ page }) => {
    // Check page title
    await expect(page.locator('text=Complete Your Profile')).toBeVisible();
    
    // Check progress bar
    await expect(page.locator('text=Step 1 of 4')).toBeVisible();
    await expect(page.locator('text=Personal Information')).toBeVisible();
    
    // Check first step form fields
    await expect(page.locator('[name="firstName"]')).toBeVisible();
    await expect(page.locator('[name="lastName"]')).toBeVisible();
    await expect(page.locator('[name="dateOfBirth"]')).toBeVisible();
    await expect(page.locator('[name="phone"]')).toBeVisible();
  });

  test.describe('Step 1: Personal Information', () => {
    test('should show validation errors for empty fields', async ({ page }) => {
      // Click next without filling fields
      await page.click('button:has-text("Next")');
      
      // Check validation errors
      await expect(page.locator('text=First name is required')).toBeVisible();
      await expect(page.locator('text=Last name is required')).toBeVisible();
      await expect(page.locator('text=Date of birth is required')).toBeVisible();
      await expect(page.locator('text=Phone number is required')).toBeVisible();
    });

    test('should validate date of birth format', async ({ page }) => {
      // Fill invalid date
      await page.fill('[name="firstName"]', patient.firstName);
      await page.fill('[name="lastName"]', patient.lastName);
      await page.fill('[name="dateOfBirth"]', 'invalid-date');
      await fillPhoneInput(page, '[name="phone"]', patient.phone);
      
      // Click next
      await page.click('button:has-text("Next")');
      
      // Check date validation error
      await expect(page.locator('text=Invalid date format')).toBeVisible();
    });

    test('should validate phone number format', async ({ page }) => {
      // Fill invalid phone
      await page.fill('[name="firstName"]', patient.firstName);
      await page.fill('[name="lastName"]', patient.lastName);
      await page.fill('[name="dateOfBirth"]', patient.dateOfBirth);
      await page.fill('[name="phone"]', '123');
      
      // Click next
      await page.click('button:has-text("Next")');
      
      // Check phone validation error
      await expect(page.locator('text=Invalid phone number')).toBeVisible();
    });

    test('should proceed to step 2 with valid data', async ({ page }) => {
      // Fill valid personal info
      await fillStep1PersonalInfo(page, patient);
      
      // Click next
      await page.click('button:has-text("Next")');
      
      // Verify we're on step 2
      await expect(page.locator('text=Step 2 of 4')).toBeVisible();
      await expect(page.locator('text=Address Information')).toBeVisible();
    });
  });

  test.describe('Step 2: Address Information', () => {
    test.beforeEach(async ({ page }) => {
      // Complete step 1 first
      await fillStep1PersonalInfo(page, patient);
      await page.click('button:has-text("Next")');
      await expect(page.locator('text=Step 2 of 4')).toBeVisible();
    });

    test('should show address form fields', async ({ page }) => {
      // Check address fields
      await expect(page.locator('[name="street"]')).toBeVisible();
      await expect(page.locator('[name="city"]')).toBeVisible();
      await expect(page.locator('[name="state"]')).toBeVisible();
      await expect(page.locator('[name="zip"]')).toBeVisible();
    });

    test('should validate California-only restriction', async ({ page }) => {
      // Fill form with non-California address
      await page.fill('[name="street"]', patient.address.street);
      await page.fill('[name="city"]', patient.address.city);
      await page.selectOption('[name="state"]', 'NY');
      await page.fill('[name="zip"]', '10001');
      
      // Click next
      await page.click('button:has-text("Next")');
      
      // Check state restriction error
      await expect(page.locator('text=California residents only')).toBeVisible();
    });

    test('should validate ZIP code format', async ({ page }) => {
      // Fill form with invalid ZIP
      await page.fill('[name="street"]', patient.address.street);
      await page.fill('[name="city"]', patient.address.city);
      await page.selectOption('[name="state"]', 'CA');
      await page.fill('[name="zip"]', 'invalid');
      
      // Click next
      await page.click('button:has-text("Next")');
      
      // Check ZIP validation error
      await expect(page.locator('text=Invalid ZIP code')).toBeVisible();
    });

    test('should proceed to step 3 with valid address', async ({ page }) => {
      // Fill valid address
      await fillStep2Address(page, patient);
      
      // Click next
      await page.click('button:has-text("Next")');
      
      // Verify we're on step 3
      await expect(page.locator('text=Step 3 of 4')).toBeVisible();
      await expect(page.locator('text=Treatment Screening')).toBeVisible();
    });

    test('should allow going back to step 1', async ({ page }) => {
      // Click back button
      await page.click('button:has-text("Back")');
      
      // Verify we're back on step 1
      await expect(page.locator('text=Step 1 of 4')).toBeVisible();
      
      // Verify data is preserved
      await expect(page.locator('[name="firstName"]')).toHaveValue(patient.firstName);
    });
  });

  test.describe('Step 3: Treatment Screening', () => {
    test.beforeEach(async ({ page }) => {
      // Complete steps 1 and 2
      await fillStep1PersonalInfo(page, patient);
      await page.click('button:has-text("Next")');
      await fillStep2Address(page, patient);
      await page.click('button:has-text("Next")');
      await expect(page.locator('text=Step 3 of 4')).toBeVisible();
    });

    test('should show screening questions', async ({ page }) => {
      // Check screening questions exist
      await expect(page.locator('text=What brings you to Rimal Health?')).toBeVisible();
      await expect(page.locator('[name="primaryConcern"]')).toBeVisible();
      await expect(page.locator('[name="treatmentGoal"]')).toBeVisible();
    });

    test('should show alcohol-specific questions when selected', async ({ page }) => {
      // Select alcohol as primary concern
      await page.selectOption('[name="primaryConcern"]', 'ALCOHOL');
      
      // Check alcohol-specific content appears
      await expect(page.getByText('alcohol', { exact: false })).toBeVisible();
    });

    // Smoking-specific test removed — smoking cessation discontinued 2026-02-28

    test('should require screening answers', async ({ page }) => {
      // Click next without selecting options
      await page.click('button:has-text("Next")');
      
      // Check validation errors
      await expect(page.locator('text=Primary concern is required')).toBeVisible();
      await expect(page.locator('text=Treatment goal is required')).toBeVisible();
    });

    test('should proceed to step 4 with valid screening', async ({ page }) => {
      // Fill screening info
      await fillStep3Screening(page, patient);
      
      // Click next
      await page.click('button:has-text("Next")');
      
      // Verify we're on step 4
      await expect(page.locator('text=Step 4 of 4')).toBeVisible();
      await expect(page.locator('text=Review Your Information')).toBeVisible();
    });
  });

  test.describe('Step 4: Review and Confirm', () => {
    test.beforeEach(async ({ page }) => {
      // Complete steps 1-3
      await fillStep1PersonalInfo(page, patient);
      await page.click('button:has-text("Next")');
      await fillStep2Address(page, patient);
      await page.click('button:has-text("Next")');
      await fillStep3Screening(page, patient);
      await page.click('button:has-text("Next")');
      await expect(page.locator('text=Step 4 of 4')).toBeVisible();
    });

    test('should display review summary', async ({ page }) => {
      // Check review section exists
      await expect(page.locator('text=Review Your Information')).toBeVisible();
      
      // Check summary contains entered data
      await expect(page.locator(`text=${patient.firstName}`)).toBeVisible();
      await expect(page.locator(`text=${patient.lastName}`)).toBeVisible();
    });

    test('should require consent checkboxes', async ({ page }) => {
      // Click submit without checking consents
      await page.click('button:has-text("Complete Checkout")');
      
      // Check validation errors
      await expect(page.locator('text=You must consent to the privacy policy')).toBeVisible();
      await expect(page.locator('text=You must accept the terms of service')).toBeVisible();
    });

    test('should submit checkout and redirect to payment', async ({ page }) => {
      // Check consent boxes
      await page.check('[name="privacyConsent"]');
      await page.check('[name="termsConsent"]');
      
      // Submit checkout
      await page.click('button:has-text("Complete Checkout")');
      
      // Wait for API response
      await page.waitForResponse(
        (response) => response.url().includes('/api/checkout'),
        { timeout: 10000 }
      );
      
      // Verify redirect to payment page
      await expect(page).toHaveURL('/checkout/payment', { timeout: 10000 });
    });

    test('should allow editing previous steps', async ({ page }) => {
      // Click edit on personal info
      await page.click('[data-testid="edit-personal"]');
      
      // Verify back on step 1
      await expect(page.locator('text=Step 1 of 4')).toBeVisible();
      
      // Change first name
      await page.fill('[name="firstName"]', 'Jane');
      
      // Navigate forward
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      
      // Verify updated name on review
      await expect(page.locator('text=Jane')).toBeVisible();
    });
  });

  test.describe('Payment Page', () => {
    test('should display payment form', async ({ page }) => {
      // Navigate directly to payment page
      await page.goto('/checkout/payment');
      await waitForPageLoad(page);
      
      // Check payment elements
      await expect(page.locator('text=Payment Information')).toBeVisible();
      await expect(page.locator('[data-testid="card-element"]')).toBeVisible();
      await expect(page.locator('text=\$50/month')).toBeVisible();
    });
  });
});

/**
 * Helper functions for filling checkout steps
 */
async function fillStep1PersonalInfo(page: Page, patient: ReturnType<typeof generateTestPatient>): Promise<void> {
  await page.fill('[name="firstName"]', patient.firstName);
  await page.fill('[name="lastName"]', patient.lastName);
  await page.fill('[name="dateOfBirth"]', patient.dateOfBirth);
  await fillPhoneInput(page, '[name="phone"]', patient.phone);
}

async function fillStep2Address(page: Page, patient: ReturnType<typeof generateTestPatient>): Promise<void> {
  await page.fill('[name="street"]', patient.address.street);
  await page.fill('[name="city"]', patient.address.city);
  await page.selectOption('[name="state"]', patient.address.state);
  await page.fill('[name="zip"]', patient.address.zip);
}

async function fillStep3Screening(page: Page, patient: ReturnType<typeof generateTestPatient>): Promise<void> {
  await page.selectOption('[name="primaryConcern"]', patient.primaryConcern);
  await page.selectOption('[name="treatmentGoal"]', patient.treatmentGoal);
}
