/**
 * E2E Test Utilities Export
 * 
 * Central export for all E2E test utilities and fixtures.
 * 
 * @example
 * ```typescript
 * import { testPatient, loginAsPatient, waitForPageLoad } from './index';
 * ```
 */

// Fixtures
export {
  testPatient,
  testPhysician,
  testAdmin,
  generateTestPatient,
  testIntakeData,
  testCards,
  type TestUser,
  type TestPatient,
} from './fixtures/test-users';

// Auth utilities
export {
  loginAsPatient,
  loginAsPhysician,
  loginAsAdmin,
  logout,
  isAuthenticated,
  getAuthToken,
  setAuthToken,
} from './utils/auth';

// Helper utilities
export {
  waitForPageLoad,
  fillField,
  selectOptionByLabel,
  selectOptionByValue,
  elementExists,
  waitForElementToDisappear,
  getElementText,
  takeScreenshot,
  scrollToElement,
  waitForToast,
  clearBrowserData,
  fillDateInput,
  fillPhoneInput,
  checkCheckboxByLabel,
  getCurrentPath,
  waitForApiResponse,
} from './utils/helpers';
