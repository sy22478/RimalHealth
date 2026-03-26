/**
 * Encryption Extension Unit Tests
 *
 * Tests for the Prisma PHI encryption extension:
 * - PHI_FIELDS model registration and field counts
 * - Encrypt/decrypt roundtrip via helper functions
 *
 * Covers TASK 3.3.5
 *
 * @module tests/unit/encryption-extension
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  PHI_FIELDS,
  getPHIFields,
  hasPHIFields,
  encryptModelFields,
  decryptModelFields,
} from '@/lib/db/encryption-extension';
import { generateEncryptionKey } from '@/lib/encryption/phi';

// ============================================================================
// Setup: ensure encryption key is available for roundtrip tests
// ============================================================================

beforeAll(() => {
  if (!process.env.PHI_ENCRYPTION_KEY) {
    process.env.PHI_ENCRYPTION_KEY = generateEncryptionKey();
  }
});

// ============================================================================
// PHI_FIELDS registration
// ============================================================================

describe('PHI_FIELDS model registration', () => {
  const expectedModels = [
    'PatientProfile',
    'Intake',
    'Review',
    'Prescription',
    'Message',
    'PhysicianMessage',
    'PhysicianNote',
    'User',
  ];

  it('should have exactly 8 models registered', () => {
    const modelNames = Object.keys(PHI_FIELDS);
    expect(modelNames).toHaveLength(8);
  });

  it.each(expectedModels)('should include model "%s"', (model) => {
    expect(PHI_FIELDS).toHaveProperty(model);
    expect(Array.isArray(PHI_FIELDS[model])).toBe(true);
    expect(PHI_FIELDS[model].length).toBeGreaterThan(0);
  });

  it('should not include models without PHI fields', () => {
    // Verify non-PHI models are not present
    expect(PHI_FIELDS).not.toHaveProperty('Subscription');
    expect(PHI_FIELDS).not.toHaveProperty('AuditLog');
  });
});

// ============================================================================
// Field counts per model
// ============================================================================

describe('PHI_FIELDS field counts', () => {
  it('PatientProfile should have 17 PHI fields', () => {
    expect(PHI_FIELDS.PatientProfile).toHaveLength(17);
  });

  it('Intake should have 2 PHI fields', () => {
    expect(PHI_FIELDS.Intake).toHaveLength(2);
  });

  it('Review should have 5 PHI fields', () => {
    expect(PHI_FIELDS.Review).toHaveLength(5);
  });

  it('Prescription should have 5 PHI fields', () => {
    expect(PHI_FIELDS.Prescription).toHaveLength(5);
  });

  it('Message should have 2 PHI fields', () => {
    expect(PHI_FIELDS.Message).toHaveLength(2);
  });

  it('PhysicianMessage should have 2 PHI fields', () => {
    expect(PHI_FIELDS.PhysicianMessage).toHaveLength(2);
  });

  it('PhysicianNote should have 1 PHI field', () => {
    expect(PHI_FIELDS.PhysicianNote).toHaveLength(1);
  });

  it('User should have 2 PHI fields', () => {
    expect(PHI_FIELDS.User).toHaveLength(2);
  });
});

// ============================================================================
// Specific field presence
// ============================================================================

describe('PHI_FIELDS specific fields', () => {
  it('PatientProfile should include name, DOB, phone, address, billing, medical, insurance fields', () => {
    const fields = PHI_FIELDS.PatientProfile;
    expect(fields).toContain('firstName');
    expect(fields).toContain('lastName');
    expect(fields).toContain('dateOfBirth');
    expect(fields).toContain('phone');
    expect(fields).toContain('addressStreet');
    expect(fields).toContain('addressCity');
    expect(fields).toContain('addressZip');
    expect(fields).toContain('billingStreet');
    expect(fields).toContain('billingCity');
    expect(fields).toContain('billingState');
    expect(fields).toContain('billingZip');
    expect(fields).toContain('medicalHistory');
    expect(fields).toContain('currentMedications');
    expect(fields).toContain('allergies');
    expect(fields).toContain('insuranceProvider');
    expect(fields).toContain('insuranceMemberId');
    expect(fields).toContain('insuranceGroupNumber');
  });

  it('Intake should include formData and medicationList', () => {
    expect(PHI_FIELDS.Intake).toContain('formData');
    expect(PHI_FIELDS.Intake).toContain('medicationList');
  });

  it('Review should include clinical notes and related fields', () => {
    const fields = PHI_FIELDS.Review;
    expect(fields).toContain('clinicalNotes');
    expect(fields).toContain('contraindications');
    expect(fields).toContain('rejectionReason');
    expect(fields).toContain('alternativeRecommendation');
    expect(fields).toContain('instructions');
  });

  it('User should include mfaSecret and mfaBackupCodes', () => {
    expect(PHI_FIELDS.User).toContain('mfaSecret');
    expect(PHI_FIELDS.User).toContain('mfaBackupCodes');
  });
});

// ============================================================================
// Helper functions
// ============================================================================

describe('getPHIFields', () => {
  it('should return fields for a known model', () => {
    const fields = getPHIFields('PatientProfile');
    expect(fields).toEqual(PHI_FIELDS.PatientProfile);
  });

  it('should return empty array for unknown model', () => {
    const fields = getPHIFields('NonExistentModel');
    expect(fields).toEqual([]);
  });
});

describe('hasPHIFields', () => {
  it('should return true for models with PHI fields', () => {
    expect(hasPHIFields('PatientProfile')).toBe(true);
    expect(hasPHIFields('Intake')).toBe(true);
    expect(hasPHIFields('User')).toBe(true);
  });

  it('should return false for models without PHI fields', () => {
    expect(hasPHIFields('UnknownModel')).toBe(false);
  });
});

// ============================================================================
// Encrypt/decrypt roundtrip
// ============================================================================

describe('encrypt/decrypt roundtrip', () => {
  it('should roundtrip a PatientProfile string field (firstName)', () => {
    const data = { firstName: 'Jane', lastName: 'Doe', id: 'keep-this' };

    const encrypted = encryptModelFields('PatientProfile', data);

    // The encrypted values should be different from the originals
    expect(encrypted.firstName).not.toBe('Jane');
    expect(encrypted.lastName).not.toBe('Doe');
    // Non-PHI field should be unchanged
    expect(encrypted.id).toBe('keep-this');

    // Decrypt
    const decrypted = decryptModelFields('PatientProfile', encrypted);
    expect(decrypted.firstName).toBe('Jane');
    expect(decrypted.lastName).toBe('Doe');
    expect(decrypted.id).toBe('keep-this');
  });

  it('should roundtrip a Message model field (body)', () => {
    const data = { body: 'Hello doctor, I have a question.', subject: 'Question' };

    const encrypted = encryptModelFields('Message', data);
    expect(encrypted.body).not.toBe(data.body);
    expect(encrypted.subject).not.toBe(data.subject);

    const decrypted = decryptModelFields('Message', encrypted);
    expect(decrypted.body).toBe(data.body);
    expect(decrypted.subject).toBe(data.subject);
  });

  it('should roundtrip a Prescription model field', () => {
    const data = {
      medicationName: 'Naltrexone 50mg',
      dosage: '50mg daily',
      instructions: 'Take with food',
    };

    const encrypted = encryptModelFields('Prescription', data);
    const decrypted = decryptModelFields('Prescription', encrypted);

    expect(decrypted.medicationName).toBe('Naltrexone 50mg');
    expect(decrypted.dosage).toBe('50mg daily');
    expect(decrypted.instructions).toBe('Take with food');
  });

  it('should handle nullable fields (return null for null input)', () => {
    const data = {
      firstName: 'Jane',
      billingStreet: null,
      insuranceProvider: null,
    };

    const encrypted = encryptModelFields('PatientProfile', data);
    expect(encrypted.billingStreet).toBeNull();
    expect(encrypted.insuranceProvider).toBeNull();
    expect(encrypted.firstName).not.toBe('Jane');
  });

  it('should not modify data for models without PHI fields', () => {
    const data = { id: '123', amount: 50, status: 'active' };

    // Cast to allow calling with arbitrary model name
    const encrypted = encryptModelFields('Subscription' as keyof typeof PHI_FIELDS, data);

    // No PHI fields for Subscription, so data should be unchanged
    expect(encrypted.id).toBe('123');
    expect(encrypted.amount).toBe(50);
    expect(encrypted.status).toBe('active');
  });
});
