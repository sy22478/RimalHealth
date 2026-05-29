/**
 * Field-key and enum-value labels for human-readable display.
 *
 * Intake forms, profiles, and physician views all share many of the same
 * camelCase keys and raw enum values. Without a central mapping, raw strings
 * like "depression-anxiety", "MALE", or "primaryGoal" leak into the UI.
 *
 * Use {@link humanizeFieldKey} for camelCase field keys (e.g., "drinkingDaysPerWeek").
 * Use {@link humanizeValue} for enum values (e.g., "MALE", "abstinence").
 * Both are idempotent — already-human-readable strings pass through unchanged.
 *
 * @module lib/utils/labels
 */

export const FIELD_LABELS: Record<string, string> = {
  pharmacyName: 'Pharmacy Name',
  pharmacyAddress: 'Pharmacy Address',
  pharmacyCity: 'City',
  pharmacyState: 'State',
  pharmacyZip: 'ZIP Code',
  pharmacyPhone: 'Phone',
  drinkingDaysPerWeek: 'Drinking Days Per Week',
  drinksPerDay: 'Drinks Per Day',
  lastDrink: 'Last Drink',
  bingeDrinking: 'Binge Drinking',
  previousTreatments: 'Previous Treatments',
  seeingTherapist: 'Currently Seeing a Therapist',
  primaryGoal: 'Treatment Goal',
  motivationLevel: 'Motivation Level',
  supportSystem: 'Support System',
  biologicalSex: 'Biological Sex',
  biologicalSexOther: 'Biological Sex (Other)',
  drugAllergies: 'Drug Allergies',
  liverCondition: 'Liver Condition',
  recentLiverTests: 'Recent Liver Tests',
  liverTests: 'Recent Liver Tests',
  pregnancyStatus: 'Pregnancy Status',
  medicalHistory: 'Medical History',
  currentMedications: 'Current Medications',
  opioidUse: 'Current Opioid Use',
  opioidMaintenance: 'On Opioid Maintenance Therapy',
};

export const VALUE_LABELS: Record<string, string> = {
  none: 'None',
  normal: 'Normal',
  abstinence: 'Abstinence',
  'harm-reduction': 'Harm Reduction',
  reduction: 'Reduction',
  unsure: 'Unsure',
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
  alcohol: 'Alcohol Use Disorder',
  ALCOHOL: 'Alcohol Use Disorder',
  'weight-management': 'Weight Management',
  WEIGHT_MANAGEMENT: 'Weight Management',
  smoking: 'Smoking',
  SMOKING: 'Smoking',
  both: 'Alcohol & Smoking',
  BOTH: 'Alcohol & Smoking',
  QUIT: 'Quit / Abstinence',
  REDUCE: 'Reduce',
  EXPLORE: 'Explore Options',
  'depression-anxiety': 'Depression / Anxiety',
  depression: 'Depression',
  anxiety: 'Anxiety',
  bipolar: 'Bipolar disorder',
  schizophrenia: 'Schizophrenia',
  ptsd: 'PTSD',
  'other-medical': 'Other Medical Condition',
  'high-blood-pressure': 'High Blood Pressure',
  hypertension: 'Hypertension',
  diabetes: 'Diabetes',
  'heart-disease': 'Heart Disease',
  heart: 'Heart Condition',
  'liver-disease': 'Liver Disease',
  'kidney-disease': 'Kidney Disease',
  kidney: 'Kidney Disease',
  seizures: 'Seizure History',
  thyroid: 'Thyroid Disorder',
  cirrhosis: 'Cirrhosis',
  'acute-hepatitis': 'Acute Hepatitis',
  'liver-failure': 'Liver Failure',
  'elevated-enzymes': 'Elevated Liver Enzymes',
  'mild-elevated': 'Mildly Elevated',
  'significant-elevated': 'Significantly Elevated',
  'no-tests': 'No Recent Tests',
  pregnant: 'Currently Pregnant',
  breastfeeding: 'Currently Breastfeeding',
  'planning-pregnancy': 'Planning Pregnancy',
  naltrexone: 'Naltrexone Allergy',
  other: 'Other',
  very: 'Very Motivated',
  somewhat: 'Somewhat Motivated',
  strong: 'Strong Support System',
  limited: 'Limited Support',
  '1-2': '1-2',
  '3-4': '3-4',
  '5-6': '5-6',
  '7+': '7 or more',
  everyday: 'Every Day',
  today: 'Today',
  yesterday: 'Yesterday',
  '2-7days': '2-7 days ago',
  'more-than-week': 'More than a week ago',
  'inpatient-rehab': 'Inpatient Rehab',
  'outpatient-program': 'Outpatient Program',
  'aa-12step': 'AA / 12-step Program',
  medication: 'Medication-Assisted Treatment',
  counseling: 'Counseling / Therapy',
  detox: 'Medical Detox',
  true: 'Yes',
  false: 'No',
};

/**
 * Convert a camelCase or known field key to a human-readable label.
 * Falls back to splitting on capital letters and title-casing the result.
 */
export function humanizeFieldKey(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Convert a raw enum value (e.g., "MALE", "depression-anxiety") to a label.
 * Already-human-readable strings (e.g., "Depression") pass through unchanged.
 */
export function humanizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const str = String(value);
  return VALUE_LABELS[str] || str;
}

/**
 * Map an array of raw enum values to human-readable labels.
 * Non-string items are coerced before lookup; empty strings are dropped.
 */
export function humanizeValueList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => humanizeValue(v))
    .filter((s) => s.length > 0);
}
