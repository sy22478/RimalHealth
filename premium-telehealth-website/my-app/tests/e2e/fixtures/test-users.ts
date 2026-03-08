/**
 * Test User Data for E2E Tests
 * 
 * These are mock user credentials and data for testing.
 * In a real environment, these would be created dynamically.
 */

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'PATIENT' | 'PHYSICIAN' | 'ADMIN';
}

export interface TestPatient extends TestUser {
  role: 'PATIENT';
  dateOfBirth: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  primaryConcern: 'ALCOHOL';
  treatmentGoal: 'REDUCE' | 'QUIT' | 'MAINTAIN';
}

// Test patient user
export const testPatient: TestPatient = {
  email: `test-patient-${Date.now()}@e2e.rimalhealth.com`,
  password: 'SecureTest123!@#',
  firstName: 'John',
  lastName: 'Doe',
  role: 'PATIENT',
  dateOfBirth: '01/15/1985',
  phone: '(555) 123-4567',
  address: {
    street: '123 Main Street',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90210',
  },
  primaryConcern: 'ALCOHOL',
  treatmentGoal: 'REDUCE',
};

// Test physician user
export const testPhysician: TestUser = {
  email: 'test-physician@e2e.rimalhealth.com',
  password: 'SecureTest123!@#',
  firstName: 'Dr. Sarah',
  lastName: 'Smith',
  role: 'PHYSICIAN',
};

// Test admin user
export const testAdmin: TestUser = {
  email: 'test-admin@e2e.rimalhealth.com',
  password: 'SecureTest123!@#',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN',
};

// Generate unique test patient (for signup tests)
export function generateTestPatient(): TestPatient {
  const timestamp = Date.now();
  return {
    email: `test-patient-${timestamp}@e2e.rimalhealth.com`,
    password: 'SecureTest123!@#',
    firstName: 'Test',
    lastName: `User${timestamp}`,
    role: 'PATIENT',
    dateOfBirth: '05/20/1990',
    phone: '(555) 987-6543',
    address: {
      street: '456 Test Avenue',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
    },
    primaryConcern: 'ALCOHOL',
    treatmentGoal: 'QUIT',
  };
}

// Intake form test data
export const testIntakeData = {
  alcohol: {
    auditC: {
      q1: '2', // How often do you have a drink containing alcohol?
      q2: '1', // How many drinks containing alcohol do you have on a typical day?
      q3: '0', // How often do you have six or more drinks on one occasion?
    },
    medicalHistory: 'No significant medical history. Generally healthy.',
    currentMedications: 'None',
    allergies: 'No known allergies',
    previousTreatment: 'Tried to quit once before using willpower only.',
  },
  // smoking test data removed — smoking cessation discontinued 2026-02-28
};

// Test credit card numbers for Stripe
export const testCards = {
  success: '4242424242424242',
  decline: '4000000000000002',
  insufficientFunds: '4000000000009995',
  requiresAuth: '4000002500003155',
};
