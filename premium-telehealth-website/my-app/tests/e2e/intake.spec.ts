import { test, expect, Page } from '@playwright/test';
import { generateTestPatient, testIntakeData } from './fixtures/test-users';
import { waitForPageLoad } from './utils/helpers';

/**
 * Intake Submission E2E Tests
 * 
 * Tests the patient intake form submission:
 * 1. Login as patient (mocked for testing)
 * 2. Navigate to intake form
 * 3. Fill medical history
 * 4. Fill medications
 * 5. Fill condition-specific questions (AUDIT-C)
 * 6. Fill previous treatment
 * 7. Sign consent
 * 8. Submit intake
 * 9. Verify redirect to dashboard
 */

test.describe('Intake Submission Flow', () => {
  const patient = generateTestPatient();

  test.beforeEach(async ({ page }) => {
    // Navigate to intake page
    await page.goto('/intake');
    await waitForPageLoad(page);
  });

  test('should display intake form with progress tracker', async ({ page }) => {
    // Check page loads
    await expect(page.locator('text=Welcome')).toBeVisible();
    
    // Check progress tracker
    await expect(page.locator('[data-testid="progress-tracker"]')).toBeVisible();
    
    // Check first section (Medical History)
    await expect(page.locator('text=Medical History')).toBeVisible();
  });

  test.describe('Medical History Section', () => {
    test('should fill medical history information', async ({ page }) => {
      // Fill medical conditions
      await page.fill('[name="medicalHistory"]', testIntakeData.alcohol.medicalHistory);
      
      // Check any medical conditions
      await page.check('[name="conditions"][value="anxiety"]');
      await page.check('[name="conditions"][value="depression"]');
      
      // Fill family history
      await page.fill('[name="familyHistory"]', 'Father had alcohol use disorder');
      
      // Navigate to next section
      await page.click('button:has-text("Next")');
      
      // Verify we moved to medications section
      await expect(page.locator('text=Medications')).toBeVisible();
    });
  });

  test.describe('Medications Section', () => {
    test.beforeEach(async ({ page }) => {
      // Fill medical history first
      await page.fill('[name="medicalHistory"]', testIntakeData.alcohol.medicalHistory);
      await page.click('button:has-text("Next")');
      await expect(page.locator('text=Medications')).toBeVisible();
    });

    test('should add current medications', async ({ page }) => {
      // Click add medication button
      await page.click('button:has-text("Add Medication")');
      
      // Fill medication details
      await page.fill('[name="medicationName"]', 'Lisinopril');
      await page.fill('[name="medicationDosage"]', '10mg');
      await page.fill('[name="medicationFrequency"]', 'Once daily');
      
      // Save medication
      await page.click('button:has-text("Save")');
      
      // Verify medication appears in list
      await expect(page.locator('text=Lisinopril')).toBeVisible();
    });

    test('should fill allergies', async ({ page }) => {
      // Fill allergies
      await page.fill('[name="allergies"]', testIntakeData.alcohol.allergies);
      
      // Navigate to next section
      await page.click('button:has-text("Next")');
      
      // Verify progress
      await expect(page.locator('[data-testid="section-complete"]')).toHaveCount(2);
    });

    test('should skip optional medications section', async ({ page }) => {
      // Navigate to next section without adding medications
      await page.click('button:has-text("Next")');
      
      // Should proceed to next section
      await expect(page.locator('text=Assessment')).toBeVisible();
    });
  });

  test.describe('Alcohol Assessment (AUDIT-C)', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to alcohol assessment with alcohol concern type
      await page.goto('/intake?concern=ALCOHOL');
      await waitForPageLoad(page);
      
      // Skip to alcohol section (in real test, would fill previous sections)
      // For now, assume we're on alcohol questions
    });

    test('should display AUDIT-C questions', async ({ page }) => {
      // Check AUDIT-C header
      await expect(page.locator('text=AUDIT-C')).toBeVisible();
      
      // Check questions exist
      await expect(page.locator('text=How often do you have a drink')).toBeVisible();
      await expect(page.locator('text=How many drinks do you have')).toBeVisible();
      await expect(page.locator('text=six or more drinks')).toBeVisible();
    });

    test('should answer AUDIT-C questions', async ({ page }) => {
      // Answer question 1
      await page.selectOption('[name="auditC_q1"]', testIntakeData.alcohol.auditC.q1);
      
      // Answer question 2
      await page.selectOption('[name="auditC_q2"]', testIntakeData.alcohol.auditC.q2);
      
      // Answer question 3
      await page.selectOption('[name="auditC_q3"]', testIntakeData.alcohol.auditC.q3);
      
      // Navigate to next
      await page.click('button:has-text("Next")');
      
      // Should proceed to previous treatment section
      await expect(page.locator('text=Previous Treatment')).toBeVisible();
    });

    test('should calculate and display AUDIT-C score', async ({ page }) => {
      // Answer all questions
      await page.selectOption('[name="auditC_q1"]', '3'); // 3 points
      await page.selectOption('[name="auditC_q2"]', '2'); // 2 points
      await page.selectOption('[name="auditC_q3"]', '2'); // 2 points
      
      // Check score display (total: 7)
      await expect(page.locator('text=Score: 7')).toBeVisible();
      await expect(page.locator('text=High risk')).toBeVisible();
    });
  });

  // Smoking Assessment (Fagerstrom) tests removed — smoking cessation discontinued 2026-02-28

  test.describe('Previous Treatment Section', () => {
    test('should fill previous treatment information', async ({ page }) => {
      // Select yes for previous treatment
      await page.check('[name="previousTreatment"][value="yes"]');
      
      // Fill treatment details
      await page.fill('[name="treatmentDetails"]', testIntakeData.alcohol.previousTreatment);
      
      // Select what helped
      await page.check('[name="whatHelped"][value="support_group"]');
      
      // Navigate to next
      await page.click('button:has-text("Next")');
      
      // Should proceed to consent
      await expect(page.locator('text=Consent')).toBeVisible();
    });

    test('should handle no previous treatment', async ({ page }) => {
      // Select no for previous treatment
      await page.check('[name="previousTreatment"][value="no"]');
      
      // Navigate to next
      await page.click('button:has-text("Next")');
      
      // Should proceed to consent
      await expect(page.locator('text=Consent')).toBeVisible();
    });
  });

  test.describe('Consent Section', () => {
    test('should display consent forms', async ({ page }) => {
      // Check consent section elements
      await expect(page.locator('text=Informed Consent')).toBeVisible();
      await expect(page.locator('text=Telehealth Consent')).toBeVisible();
      await expect(page.locator('text=HIPAA Authorization')).toBeVisible();
    });

    test('should require all consent checkboxes', async ({ page }) => {
      // Try to submit without checking consents
      await page.click('button:has-text("Submit Intake")');
      
      // Check validation errors
      await expect(page.locator('text=You must accept the informed consent')).toBeVisible();
    });

    test('should submit completed intake', async ({ page }) => {
      // Check all consent boxes
      await page.check('[name="informedConsent"]');
      await page.check('[name="telehealthConsent"]');
      await page.check('[name="hipaaConsent"]');
      
      // Type signature
      await page.fill('[name="signature"]', `${patient.firstName} ${patient.lastName}`);
      
      // Submit intake
      await page.click('button:has-text("Submit Intake")');
      
      // Wait for API response
      await page.waitForResponse(
        (response) => response.url().includes('/api/intake'),
        { timeout: 15000 }
      );
      
      // Verify success message
      await expect(page.locator('text=Intake Submitted Successfully')).toBeVisible();
      
      // Verify redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    });
  });

  test.describe('Form Navigation and Persistence', () => {
    test('should show section progress', async ({ page }) => {
      // Check progress indicators
      const sections = ['Medical History', 'Medications', 'Assessment', 'Consent'];
      
      for (const section of sections) {
        await expect(page.locator(`text=${section}`)).toBeVisible();
      }
    });

    test('should allow navigating between sections', async ({ page }) => {
      // Click on a section in the progress tracker
      await page.click('text=Medications');
      
      // Should navigate to that section
      await expect(page.locator('text=Current Medications')).toBeVisible();
    });

    test('should auto-save draft', async ({ page }) => {
      // Fill some data
      await page.fill('[name="medicalHistory"]', 'Test auto-save');
      
      // Wait for auto-save
      await page.waitForTimeout(3000);
      
      // Check for auto-save indicator
      await expect(page.locator('text=Saved')).toBeVisible();
    });

    test('should validate required fields before submission', async ({ page }) => {
      // Navigate directly to consent section
      await page.goto('/intake?section=consent');
      
      // Try to submit
      await page.click('button:has-text("Submit Intake")');
      
      // Should show validation errors
      await expect(page.locator('text=Please complete all required sections')).toBeVisible();
    });
  });

  // Dual Concern (Alcohol + Smoking) tests removed — smoking cessation discontinued 2026-02-28
});
