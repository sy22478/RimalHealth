/**
 * Unit tests for medication-catalog contraindication mapping.
 *
 * Focus: the Phase 3 Wegovy (GLP-1) contraindication flags map correctly from
 * the Phase 2 `Glp1FormData` fields, using vocabulary from clinical-config.
 * Also a small AUD regression so the existing alcohol mapping is untouched.
 */
import { describe, it, expect } from 'vitest';
import {
  MEDICATION_OPTIONS,
  checkContraindications,
  getMedicationsForConcern,
} from '@/lib/physician/review-types';
import type { Glp1FormData } from '@/lib/intake/glp1/types';
import type { IntakeFormData } from '@/types/intake';

const wegovy = MEDICATION_OPTIONS.find((m) => m.name === 'Wegovy')!;
const naltrexone = MEDICATION_OPTIONS.find((m) => m.name === 'Naltrexone')!;

/** A clean GLP-1 answer set with every contraindication negative. */
function baseGlp1(overrides: Partial<Glp1FormData> = {}): Glp1FormData {
  return {
    firstName: 'Test',
    lastName: 'Patient',
    dateOfBirth: '1990-01-01',
    biologicalSex: 'FEMALE',
    phone: '5551234567',
    addressStreet: '1 Main St',
    addressCity: 'Los Angeles',
    addressState: 'CA',
    addressZip: '90012',
    heightFeet: 5,
    heightInches: 10,
    weightLbs: 230,
    emergencyContactName: 'Jane Doe',
    emergencyContactPhone: '5559876543',
    emergencyContactRelationship: 'Spouse',
    highestAdultWeightLbs: 240,
    goalWeightLbs: 180,
    weightLossMethodsTried: [],
    weightChangePastYear: 'stable',
    hadBariatricSurgery: false,
    priorWeightLossMeds: false,
    medicalConditions: [],
    recentHospitalization: false,
    personalHistoryMTC: false,
    familyHistoryMTC: false,
    men2Syndrome: false,
    pancreatitisHistory: false,
    gallbladderDisease: false,
    severeGastroparesis: false,
    pregnancyStatus: 'none',
    endStageRenalDisease: false,
    suicidalIdeation: false,
    currentlyTakingMedications: false,
    medicationList: [],
    hasDrugAllergies: false,
    takingInsulinOrSulfonylurea: false,
    takingOtherGlp1: false,
    hasRecentLabs: false,
    dietPattern: 'balanced',
    exerciseFrequency: '1-2-week',
    alcoholUse: 'none',
    tobaccoUse: 'never',
    recreationalSubstances: false,
    stressLevel: 'low',
    emotionalEating: 'never',
    upcomingSurgery: false,
    eatingDisorderHistory: false,
    phq2Interest: '0',
    phq2Down: '0',
    mentalHealthConditions: [],
    currentMentalHealthTreatment: false,
    hasPrimaryCarePhysician: false,
    ackInfoAccurate: true,
    ackClinicalIndication: true,
    ackFollowUpCompliance: true,
    ...overrides,
  };
}

const asForm = (d: Glp1FormData): IntakeFormData =>
  d as unknown as IntakeFormData;

describe('Wegovy catalog entry', () => {
  it('exists with the expected shape', () => {
    expect(wegovy).toBeDefined();
    expect(wegovy.genericName).toBe('Semaglutide');
    expect(wegovy.category).toBe('WEIGHT_MANAGEMENT');
    expect(wegovy.dosages).toHaveLength(5);
    expect(wegovy.dosages).toContain('2.4mg weekly');
    expect(wegovy.contraindications.length).toBeGreaterThan(0);
    expect(wegovy.warnings.length).toBeGreaterThan(0);
  });

  it('is the only medication returned for the WEIGHT_MANAGEMENT concern', () => {
    const meds = getMedicationsForConcern('WEIGHT_MANAGEMENT');
    expect(meds.map((m) => m.name)).toEqual(['Wegovy']);
  });

  it('does not appear under the ALCOHOL concern', () => {
    const meds = getMedicationsForConcern('ALCOHOL');
    expect(meds.some((m) => m.name === 'Wegovy')).toBe(false);
  });
});

describe('checkContraindications — GLP-1 (Wegovy)', () => {
  it('flags nothing for a clean intake', () => {
    expect(checkContraindications(wegovy, asForm(baseGlp1()))).toEqual([]);
  });

  it('flags personal history of MTC', () => {
    const w = checkContraindications(wegovy, asForm(baseGlp1({ personalHistoryMTC: true })));
    expect(w.some((x) => /personal history of mtc/i.test(x))).toBe(true);
  });

  it('flags family history of MTC', () => {
    const w = checkContraindications(wegovy, asForm(baseGlp1({ familyHistoryMTC: true })));
    expect(w.some((x) => /family history of mtc/i.test(x))).toBe(true);
  });

  it('flags MEN2 syndrome', () => {
    const w = checkContraindications(wegovy, asForm(baseGlp1({ men2Syndrome: true })));
    expect(w.some((x) => /men2/i.test(x))).toBe(true);
  });

  it('flags pancreatitis history', () => {
    const w = checkContraindications(wegovy, asForm(baseGlp1({ pancreatitisHistory: true })));
    expect(w.some((x) => /pancreatitis/i.test(x))).toBe(true);
  });

  it('flags pregnancy for "pregnant" and "trying-to-conceive"', () => {
    expect(
      checkContraindications(wegovy, asForm(baseGlp1({ pregnancyStatus: 'pregnant' }))).some(
        (x) => /pregnancy/i.test(x),
      ),
    ).toBe(true);
    expect(
      checkContraindications(
        wegovy,
        asForm(baseGlp1({ pregnancyStatus: 'trying-to-conceive' })),
      ).some((x) => /pregnancy/i.test(x)),
    ).toBe(true);
  });

  it('does NOT hard-stop pregnancy for "breastfeeding"', () => {
    const w = checkContraindications(
      wegovy,
      asForm(baseGlp1({ pregnancyStatus: 'breastfeeding' })),
    );
    expect(w.some((x) => /pregnancy/i.test(x))).toBe(false);
  });

  it('flags gallbladder, gastroparesis, and end-stage renal disease', () => {
    const w = checkContraindications(
      wegovy,
      asForm(
        baseGlp1({
          gallbladderDisease: true,
          severeGastroparesis: true,
          endStageRenalDisease: true,
        }),
      ),
    );
    expect(w.some((x) => /gallbladder/i.test(x))).toBe(true);
    expect(w.some((x) => /gastroparesis/i.test(x))).toBe(true);
    expect(w.some((x) => /renal/i.test(x))).toBe(true);
  });
});

describe('checkContraindications — AUD regression', () => {
  it('still flags liver disease for Naltrexone', () => {
    const form = { hasLiverDisease: true } as unknown as IntakeFormData;
    const w = checkContraindications(naltrexone, form);
    expect(w.some((x) => /liver/i.test(x))).toBe(true);
  });

  it('flags nothing for Naltrexone with a clean AUD form', () => {
    const form = {} as unknown as IntakeFormData;
    expect(checkContraindications(naltrexone, form)).toEqual([]);
  });
});
