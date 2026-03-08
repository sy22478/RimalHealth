import { test, expect, Page } from '@playwright/test';
import { testPhysician } from './fixtures/test-users';
import { loginAsPhysician } from './utils/auth';
import { waitForPageLoad } from './utils/helpers';

/**
 * MD Review Flow E2E Tests
 * 
 * Tests the physician intake review workflow:
 * 1. Login as physician
 * 2. View patient queue
 * 3. Select intake to review
 * 4. Review patient information
 * 5. Make clinical decision (approve/reject/request info)
 * 6. Add notes and prescriptions
 * 7. Submit decision
 */

test.describe('MD Review Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to physician login
    await page.goto('/physician/login');
    await waitForPageLoad(page);
  });

  test.describe('Physician Login', () => {
    test('should display physician login page', async ({ page }) => {
      // Check page elements
      await expect(page.locator('h1')).toContainText('Physician Login');
      await expect(page.locator('text=Physician Portal')).toBeVisible();
      
      // Check form fields
      await expect(page.locator('[name="email"]')).toBeVisible();
      await expect(page.locator('[name="password"]')).toBeVisible();
      
      // Check HIPAA notice
      await expect(page.locator('text=HIPAA-compliant secure access')).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      // Submit empty form
      await page.click('button[type="submit"]');
      
      // Check validation errors
      await expect(page.locator('text=Email is required')).toBeVisible();
      await expect(page.locator('text=Password is required')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      // Fill invalid credentials
      await page.fill('[name="email"]', 'invalid@example.com');
      await page.fill('[name="password"]', 'wrongpassword');
      
      // Submit
      await page.click('button[type="submit"]');
      
      // Wait for API response
      await page.waitForResponse(
        (response) => response.url().includes('/api/auth/login'),
        { timeout: 10000 }
      );
      
      // Check error message
      await expect(page.locator('text=Invalid email or password')).toBeVisible();
    });

    test('should successfully login as physician', async ({ page }) => {
      // Fill valid credentials
      await page.fill('[name="email"]', testPhysician.email);
      await page.fill('[name="password"]', testPhysician.password);
      
      // Submit
      await page.click('button[type="submit"]');
      
      // Wait for navigation
      await expect(page).toHaveURL('/physician/queue', { timeout: 10000 });
      
      // Verify queue page loaded
      await expect(page.locator('h1')).toContainText('Patient Queue');
    });
  });

  test.describe('Patient Queue', () => {
    test.beforeEach(async ({ page }) => {
      // Login as physician
      await loginAsPhysician(page, testPhysician);
    });

    test('should display patient queue page', async ({ page }) => {
      // Check page header
      await expect(page.locator('h1')).toContainText('Patient Queue');
      
      // Check queue description
      await expect(page.locator('text=Review and manage pending patient intakes')).toBeVisible();
      
      // Check HIPAA notice
      await expect(page.locator('text=All patient information displayed is protected health information')).toBeVisible();
    });

    test('should display queue statistics', async ({ page }) => {
      // Check stats cards
      await expect(page.locator('text=Total Pending')).toBeVisible();
      await expect(page.locator('text=Overdue')).toBeVisible();
      await expect(page.locator('text=Under Review')).toBeVisible();
      await expect(page.locator('text=New Today')).toBeVisible();
    });

    test('should display intake items in queue', async ({ page }) => {
      // Check for intake items (if any exist)
      const intakeItems = page.locator('[data-testid="intake-item"]');
      
      // If there are items, verify structure
      if (await intakeItems.count() > 0) {
        // Check first item has required info
        const firstItem = intakeItems.first();
        await expect(firstItem.locator('[data-testid="patient-name"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="submission-date"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="concern-type"]')).toBeVisible();
      } else {
        // Check empty state
        await expect(page.locator('text=No pending intakes')).toBeVisible();
      }
    });

    test('should filter queue by status', async ({ page }) => {
      // Click filter buttons
      await page.click('button:has-text("New")');
      
      // Check filter applied
      await expect(page.locator('[data-testid="filter-active"]:has-text("New")')).toBeVisible();
      
      // Try another filter
      await page.click('button:has-text("Overdue")');
      await expect(page.locator('[data-testid="filter-active"]:has-text("Overdue")')).toBeVisible();
    });

    test('should sort queue by submission time', async ({ page }) => {
      // Click sort dropdown
      await page.click('[data-testid="sort-dropdown"]');
      
      // Select oldest first
      await page.click('text=Oldest First');
      
      // Verify sort applied
      await expect(page.locator('[data-testid="sort-label"]')).toContainText('Oldest First');
    });

    test('should navigate to intake review page', async ({ page }) => {
      // Check if there are any intake items
      const intakeItems = page.locator('[data-testid="intake-item"]');
      
      if (await intakeItems.count() > 0) {
        // Click first intake item
        await intakeItems.first().click();
        
        // Verify navigation to review page
        await expect(page).toHaveURL(/\/physician\/intake\//);
        
        // Verify review page loaded
        await expect(page.locator('text=Intake Review')).toBeVisible();
      }
    });
  });

  test.describe('Intake Review Page', () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to a specific intake review
      await loginAsPhysician(page, testPhysician);
      
      // Navigate to a test intake review (using a mock ID)
      await page.goto('/physician/intake/test-intake-123');
      await waitForPageLoad(page);
    });

    test('should display intake review page', async ({ page }) => {
      // Check page header
      await expect(page.locator('text=Intake Review')).toBeVisible();
      
      // Check patient info section
      await expect(page.locator('text=Patient Information')).toBeVisible();
      
      // Check assessment section
      await expect(page.locator('text=Assessment Results')).toBeVisible();
    });

    test('should display patient demographics', async ({ page }) => {
      // Check patient info fields
      await expect(page.locator('text=Name:')).toBeVisible();
      await expect(page.locator('text=Date of Birth:')).toBeVisible();
      await expect(page.locator('text=Contact:')).toBeVisible();
    });

    test('should display AUDIT-C results for alcohol concern', async ({ page }) => {
      // Check AUDIT-C section
      await expect(page.locator('text=AUDIT-C Score')).toBeVisible();
      
      // Check score display
      await expect(page.locator('[data-testid="audit-score"]')).toBeVisible();
      
      // Check risk level
      await expect(page.locator('[data-testid="risk-level"]')).toBeVisible();
    });

    // Fagerstrom test removed — smoking cessation discontinued 2026-02-28

    test('should display medical history', async ({ page }) => {
      // Check medical history section
      await expect(page.locator('text=Medical History')).toBeVisible();
      await expect(page.locator('text=Current Medications')).toBeVisible();
      await expect(page.locator('text=Allergies')).toBeVisible();
    });

    test('should allow marking intake as under review', async ({ page }) => {
      // Click "Start Review" button
      await page.click('button:has-text("Start Review")');
      
      // Verify status changed
      await expect(page.locator('text=Under Review')).toBeVisible();
      
      // Verify physician name shown
      await expect(page.locator(`text=${testPhysician.firstName}`)).toBeVisible();
    });
  });

  test.describe('Clinical Decision', () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to review page
      await loginAsPhysician(page, testPhysician);
      await page.goto('/physician/intake/test-intake-123');
      await waitForPageLoad(page);
      
      // Start review
      await page.click('button:has-text("Start Review")');
    });

    test('should display decision options', async ({ page }) => {
      // Check decision buttons
      await expect(page.locator('button:has-text("Approve")')).toBeVisible();
      await expect(page.locator('button:has-text("Request More Info")')).toBeVisible();
      await expect(page.locator('button:has-text("Decline")')).toBeVisible();
    });

    test('should show medication selection when approving', async ({ page }) => {
      // Click approve
      await page.click('button:has-text("Approve")');
      
      // Check medication options appear
      await expect(page.locator('text=Select Medication')).toBeVisible();
      await expect(page.locator('[name="medication"]')).toBeVisible();
    });

    test('should fill approval with medication', async ({ page }) => {
      // Click approve
      await page.click('button:has-text("Approve")');
      
      // Select medication
      await page.selectOption('[name="medication"]', 'Naltrexone 50mg');
      
      // Fill clinical notes
      await page.fill('[name="clinicalNotes"]', 'Approved for alcohol use disorder treatment. Recommend weekly follow-up.');
      
      // Fill instructions
      await page.fill('[name="patientInstructions"]', 'Take one tablet daily with food. Avoid alcohol completely.');
      
      // Submit decision
      await page.click('button:has-text("Submit Decision")');
      
      // Verify success
      await expect(page.locator('text=Decision Submitted Successfully')).toBeVisible();
    });

    test('should require clinical notes for approval', async ({ page }) => {
      // Click approve
      await page.click('button:has-text("Approve")');
      
      // Try to submit without notes
      await page.click('button:has-text("Submit Decision")');
      
      // Check validation error
      await expect(page.locator('text=Clinical notes are required')).toBeVisible();
    });

    test('should handle decline with reason', async ({ page }) => {
      // Click decline
      await page.click('button:has-text("Decline")');
      
      // Check decline reason field
      await expect(page.locator('[name="declineReason"]')).toBeVisible();
      
      // Select reason
      await page.selectOption('[name="declineReason"]', 'CONTRAINDICATION');
      
      // Fill explanation
      await page.fill('[name="declineExplanation"]', 'Patient has contraindications for medication-assisted treatment.');
      
      // Submit
      await page.click('button:has-text("Submit Decision")');
      
      // Verify success
      await expect(page.locator('text=Decision Submitted Successfully')).toBeVisible();
    });

    test('should handle request for more information', async ({ page }) => {
      // Click request more info
      await page.click('button:has-text("Request More Info")');
      
      // Check info request field
      await expect(page.locator('[name="infoRequest"]')).toBeVisible();
      
      // Fill requested information
      await page.fill('[name="infoRequest"]', 'Please provide recent lab results and complete medication history.');
      
      // Submit
      await page.click('button:has-text("Submit Request")');
      
      // Verify success
      await expect(page.locator('text=Request Submitted')).toBeVisible();
    });

    test('should return to queue after submission', async ({ page }) => {
      // Make a decision
      await page.click('button:has-text("Approve")');
      await page.selectOption('[name="medication"]', 'Naltrexone 50mg');
      await page.fill('[name="clinicalNotes"]', 'Approved');
      await page.click('button:has-text("Submit Decision")');
      
      // Wait for success message
      await expect(page.locator('text=Decision Submitted Successfully')).toBeVisible();
      
      // Click return to queue
      await page.click('button:has-text("Return to Queue")');
      
      // Verify back on queue page
      await expect(page).toHaveURL('/physician/queue');
    });
  });

  test.describe('Patient Details View', () => {
    test.beforeEach(async ({ page }) => {
      // Login as physician
      await loginAsPhysician(page, testPhysician);
    });

    test('should view patient details from queue', async ({ page }) => {
      // Navigate to patient details
      await page.goto('/physician/patients/test-patient-123');
      await waitForPageLoad(page);
      
      // Check patient details page
      await expect(page.locator('text=Patient Details')).toBeVisible();
      
      // Check sections
      await expect(page.locator('text=Treatment History')).toBeVisible();
      await expect(page.locator('text=Current Prescriptions')).toBeVisible();
      await expect(page.locator('text=Message History')).toBeVisible();
    });

    test('should display prescription history', async ({ page }) => {
      await page.goto('/physician/patients/test-patient-123');
      
      // Check prescriptions section
      await expect(page.locator('text=Prescriptions')).toBeVisible();
      
      // Verify prescription table columns
      await expect(page.locator('text=Medication')).toBeVisible();
      await expect(page.locator('text=Status')).toBeVisible();
      await expect(page.locator('text=Prescribed Date')).toBeVisible();
    });
  });
});
