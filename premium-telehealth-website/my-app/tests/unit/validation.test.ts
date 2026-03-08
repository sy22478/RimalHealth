/**
 * Validation Unit Tests
 * Tests Zod schema validations
 * 
 * @module tests/unit/validation
 */

import { describe, it, expect } from 'vitest';
import { ConcernType, TreatmentGoal } from '@prisma/client';
import {
  medicalHistorySchema,
  medicationsSchema,
  auditCSchema,
  previousTreatmentSchema,
  consentSchema,
  createIntakeSchema,
  draftIntakeSchema,
  validateSection,
  isIntakeComplete,
} from '@/lib/intake/validations';

describe('Validations', () => {
  describe('medicalHistorySchema', () => {
    it('should validate valid medical history', () => {
      const data = {
        isPregnant: false,
        hasSeizureHistory: false,
        hasPsychiatricHistory: false,
        hasLiverDisease: false,
        hasKidneyDisease: false,
        hasHeartCondition: false,
      };
      
      const result = medicalHistorySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate with details when conditions are true', () => {
      const data = {
        isPregnant: true,
        isPregnantDetails: 'Second trimester',
        hasSeizureHistory: true,
        seizureDetails: 'Childhood seizures',
        hasPsychiatricHistory: false,
        hasLiverDisease: false,
        hasKidneyDisease: false,
        hasHeartCondition: false,
      };
      
      const result = medicalHistorySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept string boolean values', () => {
      const data = {
        isPregnant: 'true',
        hasSeizureHistory: 'false',
        hasPsychiatricHistory: 'false',
        hasLiverDisease: 'false',
        hasKidneyDisease: 'false',
        hasHeartCondition: 'false',
      };
      
      const result = medicalHistorySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid boolean strings', () => {
      const data = {
        isPregnant: 'invalid',
        hasSeizureHistory: false,
        hasPsychiatricHistory: false,
        hasLiverDisease: false,
        hasKidneyDisease: false,
        hasHeartCondition: false,
      };
      
      const result = medicalHistorySchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('medicationsSchema', () => {
    it('should validate when not taking medications', () => {
      const data = {
        takingMedications: false,
      };
      
      const result = medicationsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should require medication list when taking medications', () => {
      const data = {
        takingMedications: true,
        medicationList: '',
      };
      
      const result = medicationsSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should validate when taking medications with list', () => {
      const data = {
        takingMedications: true,
        medicationList: 'Aspirin, 81mg daily',
        medicationAllergies: 'Penicillin',
      };
      
      const result = medicationsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject whitespace-only medication list', () => {
      const data = {
        takingMedications: true,
        medicationList: '   ',
      };
      
      const result = medicationsSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('auditCSchema', () => {
    it('should validate complete AUDIT-C responses', () => {
      const data = {
        audit_1: '2',
        audit_2: '1',
        audit_3: '0',
        alcoholQuitAttempts: '1',
        alcoholQuitDetails: 'Tried last year',
        alcoholConcernLevel: 'moderately',
      };
      
      const result = auditCSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid audit_1 values', () => {
      const data = {
        audit_1: '5', // Invalid: must be 0-4
        audit_2: '1',
        audit_3: '0',
        alcoholQuitAttempts: '1',
        alcoholConcernLevel: 'moderately',
      };
      
      const result = auditCSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const data = {
        audit_1: '2',
        audit_2: '1',
        // Missing audit_3, alcoholQuitAttempts, alcoholConcernLevel
      };
      
      const result = auditCSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept optional quit details', () => {
      const data = {
        audit_1: '2',
        audit_2: '1',
        audit_3: '0',
        alcoholQuitAttempts: '0',
        alcoholConcernLevel: 'not',
      };
      
      const result = auditCSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid concern level', () => {
      const data = {
        audit_1: '2',
        audit_2: '1',
        audit_3: '0',
        alcoholQuitAttempts: '1',
        alcoholConcernLevel: 'invalid',
      };
      
      const result = auditCSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('previousTreatmentSchema', () => {
    it('should validate no previous treatment', () => {
      const data = {
        previousTreatment: false,
      };
      
      const result = previousTreatmentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate previous treatment with details', () => {
      const data = {
        previousTreatment: true,
        previousTreatmentDetails: 'Attended AA meetings for 6 months',
        previousMedications: 'Naltrexone',
      };
      
      const result = previousTreatmentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('consentSchema', () => {
    it('should validate all consents true', () => {
      const data = {
        hipaaConsent: true,
        termsConsent: true,
        telehealthConsent: true,
        treatmentConsent: true,
      };
      
      const result = consentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject false HIPAA consent', () => {
      const data = {
        hipaaConsent: false,
        termsConsent: true,
        telehealthConsent: true,
        treatmentConsent: true,
      };
      
      const result = consentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject false terms consent', () => {
      const data = {
        hipaaConsent: true,
        termsConsent: false,
        telehealthConsent: true,
        treatmentConsent: true,
      };
      
      const result = consentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject string "true" instead of boolean', () => {
      const data = {
        hipaaConsent: 'true',
        termsConsent: 'true',
        telehealthConsent: 'true',
        treatmentConsent: 'true',
      };
      
      const result = consentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('createIntakeSchema', () => {
    const baseValidData = {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '01/15/1985',
      phone: '5551234567',
      email: 'john.doe@example.com',
      addressStreet: '123 Main St',
      addressCity: 'Los Angeles',
      addressState: 'CA',
      addressZip: '90210',
      primaryConcern: ConcernType.ALCOHOL,
      treatmentGoal: TreatmentGoal.REDUCE,
    };

    describe('ALCOHOL concern type', () => {
      it('should validate complete alcohol intake', () => {
        const data = {
          ...baseValidData,
          primaryConcern: ConcernType.ALCOHOL,
          isPregnant: false,
          hasSeizureHistory: false,
          hasPsychiatricHistory: false,
          hasLiverDisease: false,
          hasKidneyDisease: false,
          hasHeartCondition: false,
          takingMedications: false,
          audit_1: '2',
          audit_2: '1',
          audit_3: '0',
          alcoholQuitAttempts: '1',
          alcoholConcernLevel: 'moderately',
          previousTreatment: false,
          hipaaConsent: true,
          termsConsent: true,
          telehealthConsent: true,
          treatmentConsent: true,
        };
        
        const schema = createIntakeSchema(ConcernType.ALCOHOL);
        const result = schema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject missing alcohol-specific fields', () => {
        const data = {
          ...baseValidData,
          primaryConcern: ConcernType.ALCOHOL,
        };
        
        const schema = createIntakeSchema(ConcernType.ALCOHOL);
        const result = schema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });

    describe('validation errors', () => {
      it('should reject invalid email', () => {
        const data = {
          ...baseValidData,
          email: 'invalid-email',
        };
        
        const schema = createIntakeSchema(ConcernType.ALCOHOL);
        const result = schema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject invalid date format', () => {
        const data = {
          ...baseValidData,
          dateOfBirth: '1985-01-15', // Wrong format
        };
        
        const schema = createIntakeSchema(ConcernType.ALCOHOL);
        const result = schema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject non-CA state', () => {
        const data = {
          ...baseValidData,
          addressState: 'NY',
        };
        
        const schema = createIntakeSchema(ConcernType.ALCOHOL);
        const result = schema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject invalid zip code', () => {
        const data = {
          ...baseValidData,
          addressZip: '1234', // Too short
        };
        
        const schema = createIntakeSchema(ConcernType.ALCOHOL);
        const result = schema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('draftIntakeSchema', () => {
    it('should accept partial data', () => {
      const data = {
        firstName: 'John',
      };
      
      const result = draftIntakeSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = draftIntakeSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept all fields as optional', () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        primaryConcern: ConcernType.ALCOHOL,
      };
      
      const result = draftIntakeSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should still validate email format if provided', () => {
      const data = {
        email: 'invalid-email',
      };
      
      const result = draftIntakeSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('validateSection', () => {
    it('should validate medical section', () => {
      const data = {
        isPregnant: false,
        hasSeizureHistory: false,
        hasPsychiatricHistory: false,
        hasLiverDisease: false,
        hasKidneyDisease: false,
        hasHeartCondition: false,
      };
      
      const result = validateSection('medical', data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid medical section', () => {
      const data = {
        isPregnant: 'invalid',
        hasSeizureHistory: false,
        hasPsychiatricHistory: false,
        hasLiverDisease: false,
        hasKidneyDisease: false,
        hasHeartCondition: false,
      };
      
      const result = validateSection('medical', data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate medications section', () => {
      const data = {
        takingMedications: false,
      };
      
      const result = validateSection('medications', data);
      expect(result.valid).toBe(true);
    });

    it('should validate alcohol section', () => {
      const data = {
        audit_1: '2',
        audit_2: '1',
        audit_3: '0',
        alcoholQuitAttempts: '1',
        alcoholConcernLevel: 'moderately',
      };
      
      const result = validateSection('alcohol', data);
      expect(result.valid).toBe(true);
    });

    it('should validate consent section', () => {
      const data = {
        hipaaConsent: true,
        termsConsent: true,
        telehealthConsent: true,
        treatmentConsent: true,
      };
      
      const result = validateSection('consent', data);
      expect(result.valid).toBe(true);
    });

    it('should handle unknown section gracefully', () => {
      const result = validateSection('unknown' as Parameters<typeof validateSection>[0], {});
      expect(result.valid).toBe(true);
    });
  });

  describe('isIntakeComplete', () => {
    it('should return true for complete ALCOHOL intake', () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '01/15/1985',
        phone: '5551234567',
        email: 'john@example.com',
        addressStreet: '123 Main St',
        addressCity: 'Los Angeles',
        addressState: 'CA',
        addressZip: '90210',
        primaryConcern: ConcernType.ALCOHOL,
        treatmentGoal: TreatmentGoal.REDUCE,
        isPregnant: false,
        hasSeizureHistory: false,
        hasPsychiatricHistory: false,
        hasLiverDisease: false,
        hasKidneyDisease: false,
        hasHeartCondition: false,
        takingMedications: false,
        audit_1: '2',
        audit_2: '1',
        audit_3: '0',
        alcoholQuitAttempts: '1',
        alcoholConcernLevel: 'moderately',
        previousTreatment: false,
        hipaaConsent: true,
        termsConsent: true,
        telehealthConsent: true,
        treatmentConsent: true,
      };
      
      expect(isIntakeComplete(ConcernType.ALCOHOL, data)).toBe(true);
    });

    it('should return false for incomplete intake', () => {
      const data = {
        firstName: 'John',
      };
      
      expect(isIntakeComplete(ConcernType.ALCOHOL, data)).toBe(false);
    });

    it('should return false for invalid data', () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
      };
      
      expect(isIntakeComplete(ConcernType.ALCOHOL, data)).toBe(false);
    });
  });
});
