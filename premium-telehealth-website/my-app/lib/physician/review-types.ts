/**
 * Physician Review Types and Constants
 * 
 * Client-safe exports that don't import server-only modules
 */

import { IntakeFormData, IntakeScores, RiskAssessment } from '@/types/intake';
import { ReviewDecision } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface ReviewSubmission {
  intakeId: string;
  physicianId: string;
  decision: ReviewDecision;
  clinicalNotes: string;
  medication?: MedicationSelection;
  rejectionReason?: string;
  alternativeRecommendation?: string;
  requestedInfo?: string;
}

export interface MedicationSelection {
  name: string;
  genericName: string;
  dosage: string;
  quantity: number;
  refills: number;
  instructions: string;
  pharmacyId?: string;
}

export interface IntakeWithPatient {
  id: string;
  patientId: string;
  status: string;
  submittedAt: Date | null;
  formData: IntakeFormData;
  scores?: IntakeScores;
  riskAssessment?: RiskAssessment;
  createdAt?: Date;
  updatedAt?: Date;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    email: string;
    phone: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    } | null;
  };
  previousIntakes?: Array<{
    id: string;
    submittedAt: Date;
    status: string;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

export const REJECTION_REASONS = [
  'Contraindicated medication condition',
  'Incomplete medical information',
  'Requires in-person evaluation',
  'Outside scope of telehealth',
  'Active substance use incompatible with treatment',
  'Patient not appropriate for medication-assisted treatment',
  'Safety concerns requiring immediate in-person care',
  'Other (specify in notes)',
] as const;

export const MEDICATIONS = {
  ALCOHOL: [
    { name: 'Naltrexone', dosages: ['50mg daily'] },
    { name: 'Disulfiram', dosages: ['250mg daily', '500mg daily'] },
    { name: 'Acamprosate', dosages: ['666mg TID'] },
  ],
} as const;

// ============================================================================
// Medication Options (Full definitions for UI)
// ============================================================================

export interface MedicationOption {
  name: string;
  genericName: string;
  category: 'ALCOHOL';
  dosages: string[];
  defaultDosage: string;
  defaultQuantity: number;
  defaultRefills: number;
  defaultInstructions: string;
  contraindications: string[];
  warnings: string[];
}

export const MEDICATION_OPTIONS: MedicationOption[] = [
  // Alcohol medications
  {
    name: 'Naltrexone',
    genericName: 'Naltrexone HCl',
    category: 'ALCOHOL',
    dosages: ['50mg daily', '25mg daily (start)'],
    defaultDosage: '50mg daily',
    defaultQuantity: 30,
    defaultRefills: 5,
    defaultInstructions: 'Take once daily with food. Avoid if using opioids.',
    contraindications: ['Current opioid use', 'Acute opioid withdrawal', 'Severe liver disease'],
    warnings: ['May cause nausea', 'Monitor liver function'],
  },
  {
    name: 'Acamprosate',
    genericName: 'Acamprosate Calcium',
    category: 'ALCOHOL',
    dosages: ['666mg TID', '333mg TID (start)'],
    defaultDosage: '666mg TID',
    defaultQuantity: 180,
    defaultRefills: 5,
    defaultInstructions: 'Take three times daily with meals.',
    contraindications: ['Severe renal impairment'],
    warnings: ['May cause diarrhea', 'Maintain abstinence before starting'],
  },
  {
    name: 'Disulfiram',
    genericName: 'Disulfiram',
    category: 'ALCOHOL',
    dosages: ['250mg daily', '500mg daily (start)'],
    defaultDosage: '250mg daily',
    defaultQuantity: 30,
    defaultRefills: 5,
    defaultInstructions: 'Take once daily. AVOID ALL ALCOHOL including hidden sources.',
    contraindications: ['Severe heart disease', 'Psychosis', 'Recent alcohol use'],
    warnings: ['Severe reaction with alcohol', 'Liver monitoring required'],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get medications filtered by concern type
 */
export function getMedicationsForConcern(concernType: string): MedicationOption[] {
  // Platform now focuses exclusively on alcohol use disorder (smoking removed 2026-02-28)
  return MEDICATION_OPTIONS.filter(med => med.category === 'ALCOHOL');
}

/**
 * Check for contraindications based on patient medical history
 */
export function checkContraindications(
  medication: MedicationOption,
  formData: IntakeFormData
): string[] {
  const warnings: string[] = [];

  // Check medication-specific contraindications
  for (const contraindication of medication.contraindications) {
    const lowerContra = contraindication.toLowerCase();

    const form = formData as unknown as Record<string, boolean | string | undefined>;
    if (lowerContra.includes('liver') && form.hasLiverDisease) {
      warnings.push(`Liver disease: ${contraindication}`);
    }
    if (lowerContra.includes('kidney') && form.hasKidneyDisease) {
      warnings.push(`Kidney disease: ${contraindication}`);
    }
    if (lowerContra.includes('seizure') && form.hasSeizureHistory) {
      warnings.push(`Seizure history: ${contraindication}`);
    }
    if (lowerContra.includes('heart') && form.hasHeartCondition) {
      warnings.push(`Heart condition: ${contraindication}`);
    }
    if (lowerContra.includes('pregnant') && form.isPregnant) {
      warnings.push(`Pregnancy: ${contraindication}`);
    }
  }

  return warnings;
}
