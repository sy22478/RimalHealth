/**
 * Encryption Roundtrip Tests
 * Tests the FULL encrypt -> store -> retrieve -> decrypt cycle for all
 * encrypted models defined in PHI_FIELDS.
 *
 * Covers TASK 2.10.1
 *
 * @module tests/unit/encryption-roundtrip
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  encryptPHI,
  decryptPHI,
  isEncrypted,
  encryptJSON,
  decryptJSON,
  generateEncryptionKey,
} from '@/lib/encryption/phi';
import {
  PHI_FIELDS,
  encryptModelFields,
  decryptModelFields,
} from '@/lib/db/encryption-extension';

// ============================================================================
// Setup
// ============================================================================

beforeAll(() => {
  if (!process.env.PHI_ENCRYPTION_KEY) {
    process.env.PHI_ENCRYPTION_KEY = generateEncryptionKey();
  }
});

// ============================================================================
// 1. encryptPHI -> decryptPHI roundtrip for various string types
// ============================================================================

describe('encryptPHI -> decryptPHI roundtrip', () => {
  it('should roundtrip an empty string (passthrough)', () => {
    // encryptPHI returns '' for empty string
    const encrypted = encryptPHI('');
    expect(encrypted).toBe('');
    const decrypted = decryptPHI(encrypted);
    expect(decrypted).toBe('');
  });

  it('should roundtrip a short string', () => {
    const original = 'Hi';
    const encrypted = encryptPHI(original);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decryptPHI(encrypted)).toBe(original);
  });

  it('should roundtrip a typical PHI string (name)', () => {
    const original = 'Jane Marie Doe-Smith';
    const encrypted = encryptPHI(original);
    expect(decryptPHI(encrypted)).toBe(original);
  });

  it('should roundtrip a long string (10 KB)', () => {
    const original = 'X'.repeat(10 * 1024); // 10 KB
    const encrypted = encryptPHI(original);
    expect(isEncrypted(encrypted)).toBe(true);
    const decrypted = decryptPHI(encrypted);
    expect(decrypted).toBe(original);
    expect(decrypted).toHaveLength(10 * 1024);
  });

  it('should roundtrip unicode characters', () => {
    const original = 'Nombres: Jose, Direccion: Calle 123, Ciudad: Bogota \u00e9\u00e8\u00ea\u00eb\u00f1 \u4e2d\u6587 \ud83c\udfe5\ud83d\udc8a';
    const encrypted = encryptPHI(original);
    expect(decryptPHI(encrypted)).toBe(original);
  });

  it('should roundtrip strings with special characters', () => {
    const original = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~\n\t\r';
    const encrypted = encryptPHI(original);
    expect(decryptPHI(encrypted)).toBe(original);
  });

  it('should roundtrip strings with newlines and tabs', () => {
    const original = 'Line 1\nLine 2\n\tIndented\r\nWindows line';
    const encrypted = encryptPHI(original);
    expect(decryptPHI(encrypted)).toBe(original);
  });

  it('should roundtrip strings containing the encryption prefix', () => {
    // Edge case: a plaintext that looks like it could be encrypted but is not valid format
    const original = 'enc:v1:not:really:encrypted:data:extra';
    const encrypted = encryptPHI(original);
    // The string has 7 parts, not 6, so isEncrypted returns false and it gets encrypted
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decryptPHI(encrypted)).toBe(original);
  });
});

// ============================================================================
// 2. Random IV produces different ciphertext each time
// ============================================================================

describe('Random IV (non-deterministic encryption)', () => {
  it('should produce different ciphertext each call for the same plaintext', () => {
    const plaintext = 'Identical input';
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      results.add(encryptPHI(plaintext));
    }
    // All 10 ciphertexts should be unique
    expect(results.size).toBe(10);
  });

  it('should decrypt all unique ciphertexts to the same plaintext', () => {
    const plaintext = 'Same value for all';
    const ciphertexts: string[] = [];
    for (let i = 0; i < 5; i++) {
      ciphertexts.push(encryptPHI(plaintext));
    }
    for (const ct of ciphertexts) {
      expect(decryptPHI(ct)).toBe(plaintext);
    }
  });
});

// ============================================================================
// 3. Idempotency: decryptPHI on non-encrypted string returns original
// ============================================================================

describe('decryptPHI idempotency on non-encrypted strings', () => {
  it('should return a plaintext string unchanged', () => {
    const plain = 'John Doe';
    expect(decryptPHI(plain)).toBe(plain);
  });

  it('should return an empty string unchanged', () => {
    expect(decryptPHI('')).toBe('');
  });

  it('should return a string with colons unchanged (not matching format)', () => {
    const plain = 'foo:bar:baz';
    expect(decryptPHI(plain)).toBe(plain);
  });

  it('should return a string starting with "enc:" but invalid format unchanged', () => {
    const partial = 'enc:v1:only:three';
    expect(decryptPHI(partial)).toBe(partial);
  });
});

// ============================================================================
// 4. encryptModelFields encrypts ALL registered fields for PatientProfile
// ============================================================================

describe('encryptModelFields for PatientProfile (17 fields)', () => {
  const mockProfile: Record<string, unknown> = {
    id: 'profile-123',
    userId: 'user-456',
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: '1990-01-15',
    phone: '555-123-4567',
    addressStreet: '123 Main St',
    addressCity: 'Los Angeles',
    addressZip: '90001',
    billingStreet: '456 Billing Ave',
    billingCity: 'San Francisco',
    billingState: 'CA',
    billingZip: '94102',
    medicalHistory: { conditions: ['hypertension'] },
    currentMedications: { meds: ['lisinopril'] },
    allergies: { list: ['penicillin'] },
    insuranceProvider: 'Blue Cross',
    insuranceMemberId: 'BC12345678',
    insuranceGroupNumber: 'GRP001',
    // Non-PHI field
    state: 'CA',
  };

  it('should encrypt all 17 PHI fields', () => {
    const encrypted = encryptModelFields('PatientProfile', { ...mockProfile });

    for (const field of PHI_FIELDS.PatientProfile) {
      const value = encrypted[field];
      if (value === null) continue; // nullable fields that were null
      expect(
        typeof value === 'string' && isEncrypted(value),
        `Expected field "${field}" to be encrypted, got: ${String(value).slice(0, 60)}`
      ).toBe(true);
    }
  });

  it('should NOT encrypt non-PHI fields', () => {
    const encrypted = encryptModelFields('PatientProfile', { ...mockProfile });
    expect(encrypted.id).toBe('profile-123');
    expect(encrypted.userId).toBe('user-456');
    expect(encrypted.state).toBe('CA');
  });
});

// ============================================================================
// 5. decryptModelFields decrypts them back to original values
// ============================================================================

describe('decryptModelFields roundtrip for PatientProfile', () => {
  const mockProfile: Record<string, unknown> = {
    id: 'profile-123',
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: '1990-01-15',
    phone: '555-123-4567',
    addressStreet: '123 Main St',
    addressCity: 'Los Angeles',
    addressZip: '90001',
    billingStreet: '456 Billing Ave',
    billingCity: 'San Francisco',
    billingState: 'CA',
    billingZip: '94102',
    medicalHistory: { conditions: ['hypertension'] },
    currentMedications: { meds: ['lisinopril'] },
    allergies: { list: ['penicillin'] },
    insuranceProvider: 'Blue Cross',
    insuranceMemberId: 'BC12345678',
    insuranceGroupNumber: 'GRP001',
    state: 'CA',
  };

  it('should decrypt all PatientProfile fields back to originals', () => {
    const encrypted = encryptModelFields('PatientProfile', { ...mockProfile });
    const decrypted = decryptModelFields('PatientProfile', encrypted);

    // String fields
    expect(decrypted.firstName).toBe('Jane');
    expect(decrypted.lastName).toBe('Doe');
    expect(decrypted.dateOfBirth).toBe('1990-01-15');
    expect(decrypted.phone).toBe('555-123-4567');
    expect(decrypted.addressStreet).toBe('123 Main St');
    expect(decrypted.addressCity).toBe('Los Angeles');
    expect(decrypted.addressZip).toBe('90001');
    expect(decrypted.billingStreet).toBe('456 Billing Ave');
    expect(decrypted.billingCity).toBe('San Francisco');
    expect(decrypted.billingState).toBe('CA');
    expect(decrypted.billingZip).toBe('94102');
    expect(decrypted.insuranceProvider).toBe('Blue Cross');
    expect(decrypted.insuranceMemberId).toBe('BC12345678');
    expect(decrypted.insuranceGroupNumber).toBe('GRP001');

    // JSON fields
    expect(decrypted.medicalHistory).toEqual({ conditions: ['hypertension'] });
    expect(decrypted.currentMedications).toEqual({ meds: ['lisinopril'] });
    expect(decrypted.allergies).toEqual({ list: ['penicillin'] });

    // Non-PHI field unchanged
    expect(decrypted.id).toBe('profile-123');
    expect(decrypted.state).toBe('CA');
  });
});

// ============================================================================
// 6. Roundtrip for EACH model: create mock data, encrypt, decrypt, compare
// ============================================================================

describe('Roundtrip per model', () => {
  const mockData: Record<string, Record<string, unknown>> = {
    PatientProfile: {
      id: 'pp-1',
      firstName: 'Alice',
      lastName: 'Smith',
      dateOfBirth: '1985-06-20',
      phone: '310-555-0100',
      addressStreet: '789 Oak Dr',
      addressCity: 'Pasadena',
      addressZip: '91101',
      billingStreet: null,
      billingCity: null,
      billingState: null,
      billingZip: null,
      medicalHistory: { notes: 'None' },
      currentMedications: { list: [] },
      allergies: { list: ['aspirin'] },
      insuranceProvider: 'Aetna',
      insuranceMemberId: 'AET9999',
      insuranceGroupNumber: 'G100',
    },
    Intake: {
      id: 'intake-1',
      formData: { q1: 'answer1', q2: 'answer2', nested: { deep: true } },
      medicationList: 'Aspirin 81mg, Lisinopril 10mg',
    },
    Review: {
      id: 'review-1',
      clinicalNotes: 'Patient presents with moderate AUD. AUDIT-C score 7.',
      contraindications: { items: ['hepatic impairment'] },
      rejectionReason: null,
      alternativeRecommendation: null,
      instructions: 'Start at 25mg for 3 days, then increase to 50mg daily.',
    },
    Prescription: {
      id: 'rx-1',
      medicationName: 'Naltrexone 50mg',
      dosage: '50mg once daily',
      pharmacyName: 'CVS Pharmacy',
      instructions: 'Take with food. Avoid alcohol.',
      pharmacyAddress: '100 Pharmacy Ln, LA, CA 90001',
    },
    Message: {
      id: 'msg-1',
      subject: 'Follow-up question',
      body: 'Doctor, I have been experiencing mild nausea. Is this expected?',
    },
    PhysicianMessage: {
      id: 'pmsg-1',
      subject: 'Re: Follow-up question',
      body: 'Yes, mild nausea is a common side effect that typically resolves in 1-2 weeks.',
    },
    PhysicianNote: {
      id: 'pn-1',
      content: 'Patient tolerating medication well. No contraindications identified.',
    },
    User: {
      id: 'user-1',
      email: 'alice@test.com',
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      mfaBackupCodes: { codes: ['11111111', '22222222', '33333333'] },
    },
  };

  for (const [model, data] of Object.entries(mockData)) {
    it(`should roundtrip all PHI fields for ${model}`, () => {
      const original = { ...data };
      const encrypted = encryptModelFields(
        model as keyof typeof PHI_FIELDS,
        { ...data }
      );

      // Every PHI field should be encrypted (unless null)
      for (const field of PHI_FIELDS[model]) {
        const originalVal = original[field];
        const encryptedVal = encrypted[field];

        if (originalVal === null || originalVal === undefined) {
          expect(encryptedVal).toBeNull();
        } else {
          expect(
            typeof encryptedVal === 'string' && isEncrypted(encryptedVal),
            `${model}.${field} should be encrypted`
          ).toBe(true);
        }
      }

      // Decrypt and compare
      const decrypted = decryptModelFields(
        model as keyof typeof PHI_FIELDS,
        encrypted
      );

      for (const field of PHI_FIELDS[model]) {
        expect(decrypted[field]).toEqual(original[field]);
      }

      // Non-PHI fields should be unchanged
      expect(decrypted.id).toBe(original.id);
    });
  }
});

// ============================================================================
// 7. NULL values pass through unchanged
// ============================================================================

describe('NULL / undefined handling', () => {
  it('should pass null through unchanged for nullable PatientProfile fields', () => {
    const data = {
      firstName: 'Bob',
      billingStreet: null,
      billingCity: null,
      billingState: null,
      billingZip: null,
      medicalHistory: null,
      currentMedications: null,
      allergies: null,
      insuranceProvider: null,
      insuranceMemberId: null,
      insuranceGroupNumber: null,
    };

    const encrypted = encryptModelFields('PatientProfile', data);

    expect(encrypted.billingStreet).toBeNull();
    expect(encrypted.billingCity).toBeNull();
    expect(encrypted.billingState).toBeNull();
    expect(encrypted.billingZip).toBeNull();
    expect(encrypted.medicalHistory).toBeNull();
    expect(encrypted.currentMedications).toBeNull();
    expect(encrypted.allergies).toBeNull();
    expect(encrypted.insuranceProvider).toBeNull();
    expect(encrypted.insuranceMemberId).toBeNull();
    expect(encrypted.insuranceGroupNumber).toBeNull();

    // firstName should be encrypted
    expect(isEncrypted(encrypted.firstName as string)).toBe(true);
  });

  it('should pass null through on decrypt', () => {
    const data = {
      clinicalNotes: null,
      contraindications: null,
      rejectionReason: null,
      alternativeRecommendation: null,
      instructions: null,
    };

    const decrypted = decryptModelFields('Review', data);
    expect(decrypted.clinicalNotes).toBeNull();
    expect(decrypted.contraindications).toBeNull();
    expect(decrypted.rejectionReason).toBeNull();
    expect(decrypted.alternativeRecommendation).toBeNull();
    expect(decrypted.instructions).toBeNull();
  });

  it('should handle undefined values in non-nullable fields gracefully', () => {
    const data = { firstName: undefined, lastName: 'Doe' };
    const encrypted = encryptModelFields('PatientProfile', data);
    // undefined non-nullable field gets converted to null by encryptField
    expect(encrypted.firstName).toBeNull();
    expect(isEncrypted(encrypted.lastName as string)).toBe(true);
  });
});

// ============================================================================
// 8. Empty string encrypts and decrypts correctly
// ============================================================================

describe('Empty string handling', () => {
  it('encryptPHI returns empty string for empty input (passthrough)', () => {
    expect(encryptPHI('')).toBe('');
  });

  it('decryptPHI returns empty string for empty input (passthrough)', () => {
    expect(decryptPHI('')).toBe('');
  });

  it('encryptJSON/decryptJSON roundtrip with empty object', () => {
    const encrypted = encryptJSON({});
    expect(encrypted).not.toBeNull();
    expect(isEncrypted(encrypted!)).toBe(true);
    const decrypted = decryptJSON(encrypted);
    expect(decrypted).toEqual({});
  });
});

// ============================================================================
// 9. Very long strings (10 KB) encrypt and decrypt correctly
// ============================================================================

describe('Large payload encryption', () => {
  it('should handle a 10 KB string field', () => {
    const longValue = 'A'.repeat(10 * 1024);
    const data = { body: longValue, subject: 'Short' };
    const encrypted = encryptModelFields('Message', data);
    const decrypted = decryptModelFields('Message', encrypted);
    expect(decrypted.body).toBe(longValue);
    expect((decrypted.body as string).length).toBe(10 * 1024);
  });

  it('should handle a 10 KB JSON field', () => {
    const largeObject = {
      data: 'Y'.repeat(10 * 1024),
      nested: { deep: true },
    };
    const data = { formData: largeObject, medicationList: null };
    const encrypted = encryptModelFields('Intake', data);
    const decrypted = decryptModelFields('Intake', encrypted);
    expect(decrypted.formData).toEqual(largeObject);
  });

  it('should handle a 10 KB medication list string', () => {
    const longMedList = 'Medication entry; '.repeat(600); // ~10.8 KB
    const data = { formData: { q1: 'a' }, medicationList: longMedList };
    const encrypted = encryptModelFields('Intake', data);
    const decrypted = decryptModelFields('Intake', encrypted);
    expect(decrypted.medicationList).toBe(longMedList);
  });
});
