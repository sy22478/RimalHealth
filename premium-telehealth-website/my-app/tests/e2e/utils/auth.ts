import { Page } from '@playwright/test';
import { TestUser, TestPatient } from '../fixtures/test-users';

/**
 * Authentication Utilities for E2E Tests
 */

/**
 * Login as a patient
 */
export async function loginAsPatient(page: Page, patient: TestPatient): Promise<void> {
  await page.goto('/login');
  
  // Wait for form to be ready
  await page.waitForSelector('[name="email"]', { state: 'visible' });
  
  // Fill login form
  await page.fill('[name="email"]', patient.email);
  await page.fill('[name="password"]', patient.password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Login as a physician
 */
export async function loginAsPhysician(page: Page, physician: TestUser): Promise<void> {
  await page.goto('/physician/login');
  
  // Wait for form to be ready
  await page.waitForSelector('[name="email"]', { state: 'visible' });
  
  // Fill login form
  await page.fill('[name="email"]', physician.email);
  await page.fill('[name="password"]', physician.password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for navigation to queue
  await page.waitForURL('/physician/queue', { timeout: 10000 });
}

/**
 * Login as admin
 */
export async function loginAsAdmin(page: Page, admin: TestUser): Promise<void> {
  await page.goto('/login');
  
  // Wait for form to be ready
  await page.waitForSelector('[name="email"]', { state: 'visible' });
  
  // Fill login form
  await page.fill('[name="email"]', admin.email);
  await page.fill('[name="password"]', admin.password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for navigation to admin dashboard
  await page.waitForURL('/admin/dashboard', { timeout: 10000 });
}

/**
 * Logout current user
 */
export async function logout(page: Page): Promise<void> {
  // Clear local storage
  await page.evaluate(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  });
  
  // Navigate to home
  await page.goto('/');
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => {
    return localStorage.getItem('accessToken');
  });
  return token !== null;
}

/**
 * Get auth token from localStorage
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    return localStorage.getItem('accessToken');
  });
}

/**
 * Set auth token in localStorage (for testing)
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('accessToken', t);
  }, token);
}
