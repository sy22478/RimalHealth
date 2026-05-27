/**
 * Physician Review Types and Constants
 * 
 * Client-safe exports that don't import server-only modules
 */

import { IntakeFormData, IntakeScores, RiskAssessment } from '@/types/intake';
import { ReviewDecision } from '@prisma/client';
import {
  CONTRAINDICATIONS,
  GLP1_MEDICATION_WARNINGS,
  PREGNANCY_HARD_STOP_VALUES,
} from '@/lib/intake/glp1/clinical-config';

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
    /** Raw YYYY-MM-DD string — kept as string to avoid UTC serialization bug
     *  where a Date constructed from YYYY-MM-DD on a UTC server renders a day
     *  early in negative-offset timezones like PST. */
    dateOfBirth: string;
    email: string;
    phone: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    } | null;
    preferredPharmacy?: {
      name: string;
      phone: string | null;
      address: string;
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
  review?: {
    decision: string;
    clinicalNotes: string | null;
    rejectionReason: string | null;
    alternativeRecommendation: string | null;
    completedAt: Date | null;
    physicianName: string | null;
  } | null;
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
  WEIGHT_MANAGEMENT: [
    {
      name: 'Wegovy',
      dosages: [
        '0.25mg weekly',
        '0.5mg weekly',
        '1mg weekly',
        '1.7mg weekly',
        '2.4mg weekly',
      ],
    },
  ],
} as const;

// ============================================================================
// Medication Options (Full definitions for UI)
// ============================================================================

export interface MedicationOption {
  name: string;
  genericName: string;
  category: 'ALCOHOL' | 'WEIGHT_MANAGEMENT';
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
  // Weight-management medications (GLP-1). Single formulary entry: Wegovy.
  // Clinical fields below are PLACEHOLDERS — see TODO(clinical) notes.
  // Contraindications/warnings are sourced from the GLP-1 clinical-config
  // (single source of truth) rather than re-authored here.
  {
    name: 'Wegovy',
    genericName: 'Semaglutide',
    category: 'WEIGHT_MANAGEMENT',
    // Titration steps month 1→4 plus the 2.4mg maintenance dose. Titration
    // scheduling itself (the stepped escalation) is Phase 4 — the physician
    // simply selects the appropriate strength when prescribing.
    dosages: [
      '0.25mg weekly',
      '0.5mg weekly',
      '1mg weekly',
      '1.7mg weekly',
      '2.4mg weekly',
    ],
    defaultDosage: '0.25mg weekly', // TODO(clinical): confirm starting dose
    defaultQuantity: 4, // TODO(clinical): 4 single-dose pens = ~1 month of weekly injections
    defaultRefills: 0, // TODO(clinical): confirm — may require monthly re-evaluation
    defaultInstructions:
      'Inject subcutaneously once weekly in the abdomen, thigh, or upper arm. Rotate injection sites. Take on the same day each week, with or without meals. TODO(clinical): confirm full administration instructions.',
    contraindications: CONTRAINDICATIONS.map((c) => c.condition),
    warnings: GLP1_MEDICATION_WARNINGS,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get medications filtered by concern type
 */
export function getMedicationsForConcern(concernType: string): MedicationOption[] {
  // Filter by the requested concern. `concernType` is the intake's
  // `formData.primaryConcern` ('ALCOHOL' or 'WEIGHT_MANAGEMENT'), which matches
  // the MedicationOption.category literal.
  return MEDICATION_OPTIONS.filter((med) => med.category === concernType);
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
    // --- AUD (alcohol) medication contraindications ---
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
    if (
      lowerContra.includes('pregnant') &&
      (form.isPregnant ||
        PREGNANCY_HARD_STOP_VALUES.includes(String(form.pregnancyStatus ?? '')))
    ) {
      warnings.push(`Pregnancy: ${contraindication}`);
    }

    // --- GLP-1 (Wegovy) contraindications ---
    // Field names match `glp1IntakeFormSchema` (Phase 2); the condition strings
    // come from clinical-config CONTRAINDICATIONS, so the substrings below are
    // matched against that vocabulary.
    if (lowerContra.includes('medullary') && lowerContra.includes('personal') && form.personalHistoryMTC) {
      warnings.push(`Personal history of MTC: ${contraindication}`);
    }
    if (lowerContra.includes('medullary') && lowerContra.includes('family') && form.familyHistoryMTC) {
      warnings.push(`Family history of MTC: ${contraindication}`);
    }
    if (lowerContra.includes('endocrine neoplasia') && form.men2Syndrome) {
      warnings.push(`MEN2 syndrome: ${contraindication}`);
    }
    if (lowerContra.includes('pancreatitis') && form.pancreatitisHistory) {
      warnings.push(`Pancreatitis history: ${contraindication}`);
    }
    if (lowerContra.includes('gallbladder') && form.gallbladderDisease) {
      warnings.push(`Gallbladder disease: ${contraindication}`);
    }
    if (lowerContra.includes('gastroparesis') && form.severeGastroparesis) {
      warnings.push(`Gastroparesis: ${contraindication}`);
    }
    if (lowerContra.includes('renal') && form.endStageRenalDisease) {
      warnings.push(`End-stage renal disease: ${contraindication}`);
    }
  }

  return warnings;
}
