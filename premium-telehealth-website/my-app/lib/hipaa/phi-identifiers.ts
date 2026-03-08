/**
 * PHI Identifier Module
 * 
 * Provides utilities for identifying, classifying, and handling
 * Protected Health Information (PHI) fields.
 * 
 * HIPAA Compliance:
 * - Identifies 18 PHI identifiers per HIPAA
 * - Classifies sensitivity levels
 * - Provides field-level encryption guidance
 * 
 * @module lib/hipaa/phi-identifiers
 */

import { PHI_FIELDS } from '@/lib/constants';

// ============================================
// Types
// ============================================

export type PHICategory = 'identifiers' | 'medical' | 'billing' | 'contact' | 'demographics';

export type SensitivityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface PHIFieldDefinition {
  /** Field name */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** PHI category */
  category: PHICategory;
  /** Sensitivity level */
  sensitivity: SensitivityLevel;
  /** Whether field should be encrypted */
  encrypted: boolean;
  /** Whether field can be searched/queried */
  searchable: boolean;
  /** Whether field is required */
  required: boolean;
  /** Validation regex pattern */
  pattern?: RegExp;
  /** Example value for documentation */
  example?: string;
  /** Description */
  description?: string;
}

export interface PHIClassification {
  /** Whether object contains PHI */
  containsPhi: boolean;
  /** Detected PHI fields */
  fields: Array<{
    path: string;
    field: PHIFieldDefinition;
    value?: unknown;
  }>;
  /** Recommended actions */
  recommendations: string[];
}

// ============================================
// PHI Field Definitions
// ============================================

/**
 * Complete PHI field definitions with metadata
 * 
 * Defines all 18 HIPAA identifiers plus additional medical fields
 * with their sensitivity levels and handling requirements.
 */
export const PHI_FIELD_DEFINITIONS: Record<string, PHIFieldDefinition> = {
  // Identifiers (18 HIPAA identifiers)
  name: {
    name: 'name',
    displayName: 'Full Name',
    category: 'identifiers',
    sensitivity: 'critical',
    encrypted: true,
    searchable: true,
    required: true,
    example: 'John Doe',
    description: 'Patient full name',
  },
  firstName: {
    name: 'firstName',
    displayName: 'First Name',
    category: 'identifiers',
    sensitivity: 'critical',
    encrypted: true,
    searchable: true,
    required: true,
    example: 'John',
    description: 'Patient first name',
  },
  lastName: {
    name: 'lastName',
    displayName: 'Last Name',
    category: 'identifiers',
    sensitivity: 'critical',
    encrypted: true,
    searchable: true,
    required: true,
    example: 'Doe',
    description: 'Patient last name',
  },
  dateOfBirth: {
    name: 'dateOfBirth',
    displayName: 'Date of Birth',
    category: 'identifiers',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    example: '1985-06-15',
    description: 'Patient date of birth (YYYY-MM-DD)',
  },
  ssn: {
    name: 'ssn',
    displayName: 'Social Security Number',
    category: 'identifiers',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    pattern: /^\d{3}-?\d{2}-?\d{4}$/,
    example: '123-45-6789',
    description: 'Social Security Number',
  },
  mrn: {
    name: 'mrn',
    displayName: 'Medical Record Number',
    category: 'identifiers',
    sensitivity: 'high',
    encrypted: true,
    searchable: true,
    required: true,
    example: 'MRN123456789',
    description: 'Medical Record Number',
  },
  healthPlanId: {
    name: 'healthPlanId',
    displayName: 'Health Plan ID',
    category: 'identifiers',
    sensitivity: 'high',
    encrypted: true,
    searchable: true,
    required: false,
    example: 'HP123456789',
    description: 'Health plan beneficiary number',
  },
  accountNumber: {
    name: 'accountNumber',
    displayName: 'Account Number',
    category: 'identifiers',
    sensitivity: 'high',
    encrypted: true,
    searchable: true,
    required: false,
    example: 'ACC123456',
    description: 'Any other account number',
  },
  certificateNumber: {
    name: 'certificateNumber',
    displayName: 'Certificate Number',
    category: 'identifiers',
    sensitivity: 'high',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Certificate/license number',
  },
  deviceId: {
    name: 'deviceId',
    displayName: 'Device Identifier',
    category: 'identifiers',
    sensitivity: 'medium',
    encrypted: true,
    searchable: true,
    required: false,
    description: 'Device identifier or serial number',
  },
  biometric: {
    name: 'biometric',
    displayName: 'Biometric Identifier',
    category: 'identifiers',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Fingerprints, retinal scans, etc.',
  },
  photo: {
    name: 'photo',
    displayName: 'Photograph',
    category: 'identifiers',
    sensitivity: 'high',
    encrypted: false,
    searchable: false,
    required: false,
    description: 'Full-face photographs',
  },
  
  // Contact Information
  email: {
    name: 'email',
    displayName: 'Email Address',
    category: 'contact',
    sensitivity: 'high',
    encrypted: true,
    searchable: true,
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    example: 'patient@example.com',
    description: 'Email address',
  },
  phone: {
    name: 'phone',
    displayName: 'Phone Number',
    category: 'contact',
    sensitivity: 'high',
    encrypted: true,
    searchable: false,
    required: true,
    pattern: /^\+?1?\d{10,15}$/,
    example: '+14155551234',
    description: 'Phone number',
  },
  address: {
    name: 'address',
    displayName: 'Street Address',
    category: 'contact',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: true,
    example: '123 Main St, Apt 4B',
    description: 'Street address',
  },
  city: {
    name: 'city',
    displayName: 'City',
    category: 'contact',
    sensitivity: 'medium',
    encrypted: true,
    searchable: false,
    required: true,
    example: 'Los Angeles',
    description: 'City',
  },
  state: {
    name: 'state',
    displayName: 'State',
    category: 'contact',
    sensitivity: 'low',
    encrypted: false,
    searchable: true,
    required: true,
    pattern: /^[A-Z]{2}$/,
    example: 'CA',
    description: 'State (2-letter code)',
  },
  zipCode: {
    name: 'zipCode',
    displayName: 'ZIP Code',
    category: 'contact',
    sensitivity: 'medium',
    encrypted: true,
    searchable: false,
    required: true,
    pattern: /^\d{5}(-\d{4})?$/,
    example: '90210',
    description: 'ZIP code',
  },
  
  // Medical Information
  medicalHistory: {
    name: 'medicalHistory',
    displayName: 'Medical History',
    category: 'medical',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Patient medical history',
  },
  currentMedications: {
    name: 'currentMedications',
    displayName: 'Current Medications',
    category: 'medical',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Current medications',
  },
  allergies: {
    name: 'allergies',
    displayName: 'Allergies',
    category: 'medical',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Known allergies',
  },
  diagnosis: {
    name: 'diagnosis',
    displayName: 'Diagnosis',
    category: 'medical',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Medical diagnosis',
  },
  symptoms: {
    name: 'symptoms',
    displayName: 'Symptoms',
    category: 'medical',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Reported symptoms',
  },
  treatmentPlan: {
    name: 'treatmentPlan',
    displayName: 'Treatment Plan',
    category: 'medical',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Treatment plan details',
  },
  notes: {
    name: 'notes',
    displayName: 'Clinical Notes',
    category: 'medical',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Clinical notes',
  },
  labResults: {
    name: 'labResults',
    displayName: 'Lab Results',
    category: 'medical',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Laboratory test results',
  },
  vitalSigns: {
    name: 'vitalSigns',
    displayName: 'Vital Signs',
    category: 'medical',
    sensitivity: 'high',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Patient vital signs',
  },
  
  // Billing Information
  insuranceProvider: {
    name: 'insuranceProvider',
    displayName: 'Insurance Provider',
    category: 'billing',
    sensitivity: 'high',
    encrypted: true,
    searchable: true,
    required: false,
    example: 'Blue Cross CA',
    description: 'Health insurance provider',
  },
  insurancePolicyNumber: {
    name: 'insurancePolicyNumber',
    displayName: 'Policy Number',
    category: 'billing',
    sensitivity: 'high',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Insurance policy number',
  },
  insuranceGroupNumber: {
    name: 'insuranceGroupNumber',
    displayName: 'Group Number',
    category: 'billing',
    sensitivity: 'medium',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Insurance group number',
  },
  paymentMethod: {
    name: 'paymentMethod',
    displayName: 'Payment Method',
    category: 'billing',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Payment method details (masked)',
  },
  billingAddress: {
    name: 'billingAddress',
    displayName: 'Billing Address',
    category: 'billing',
    sensitivity: 'critical',
    encrypted: true,
    searchable: false,
    required: false,
    description: 'Billing address',
  },
  
  // Demographics
  gender: {
    name: 'gender',
    displayName: 'Gender',
    category: 'demographics',
    sensitivity: 'medium',
    encrypted: false,
    searchable: true,
    required: false,
    description: 'Gender identity',
  },
  race: {
    name: 'race',
    displayName: 'Race/Ethnicity',
    category: 'demographics',
    sensitivity: 'medium',
    encrypted: false,
    searchable: true,
    required: false,
    description: 'Race or ethnicity',
  },
  language: {
    name: 'language',
    displayName: 'Preferred Language',
    category: 'demographics',
    sensitivity: 'low',
    encrypted: false,
    searchable: true,
    required: false,
    description: 'Preferred language',
  },
};

// ============================================
// Field Lookup Functions
// ============================================

/**
 * Get PHI field definition by name
 * 
 * @param fieldName - Field name
 * @returns Field definition or undefined
 */
export function getPHIField(fieldName: string): PHIFieldDefinition | undefined {
  return PHI_FIELD_DEFINITIONS[fieldName];
}

/**
 * Check if a field is a PHI field
 * 
 * @param fieldName - Field name to check
 * @returns True if field is PHI
 */
export function isPHIField(fieldName: string): boolean {
  return fieldName in PHI_FIELD_DEFINITIONS;
}

/**
 * Check if a field should be encrypted
 * 
 * @param fieldName - Field name
 * @returns True if field should be encrypted
 */
export function shouldEncryptField(fieldName: string): boolean {
  const field = PHI_FIELD_DEFINITIONS[fieldName];
  return field?.encrypted ?? false;
}

/**
 * Check if a field is searchable
 * 
 * @param fieldName - Field name
 * @returns True if field can be searched
 */
export function isSearchableField(fieldName: string): boolean {
  const field = PHI_FIELD_DEFINITIONS[fieldName];
  return field?.searchable ?? false;
}

/**
 * Get sensitivity level for a field
 * 
 * @param fieldName - Field name
 * @returns Sensitivity level or undefined
 */
export function getFieldSensitivity(fieldName: string): SensitivityLevel | undefined {
  return PHI_FIELD_DEFINITIONS[fieldName]?.sensitivity;
}

// ============================================
// Field Collections
// ============================================

/**
 * Get all PHI field names
 * 
 * @returns Array of all PHI field names
 */
export function getAllPHIFields(): string[] {
  return Object.keys(PHI_FIELD_DEFINITIONS);
}

/**
 * Get PHI fields by category
 * 
 * @param category - PHI category
 * @returns Array of field names
 */
export function getFieldsByCategory(category: PHICategory): string[] {
  return Object.values(PHI_FIELD_DEFINITIONS)
    .filter(field => field.category === category)
    .map(field => field.name);
}

/**
 * Get fields by sensitivity level
 * 
 * @param level - Sensitivity level
 * @returns Array of field names
 */
export function getFieldsBySensitivity(level: SensitivityLevel): string[] {
  return Object.values(PHI_FIELD_DEFINITIONS)
    .filter(field => field.sensitivity === level)
    .map(field => field.name);
}

/**
 * Get all fields that should be encrypted
 * 
 * @returns Array of field names
 */
export function getEncryptedFields(): string[] {
  return Object.values(PHI_FIELD_DEFINITIONS)
    .filter(field => field.encrypted)
    .map(field => field.name);
}

/**
 * Get all searchable fields
 * 
 * @returns Array of field names
 */
export function getSearchableFields(): string[] {
  return Object.values(PHI_FIELD_DEFINITIONS)
    .filter(field => field.searchable)
    .map(field => field.name);
}

// ============================================
// Object Classification
// ============================================

/**
 * Classify an object for PHI content
 * 
 * Analyzes an object and identifies all PHI fields present.
 * 
 * @param obj - Object to classify
 * @param path - Current path (for nested objects)
 * @returns Classification result
 */
export function classifyPHI(
  obj: Record<string, unknown>,
  path: string = ''
): PHIClassification {
  const fields: PHIClassification['fields'] = [];
  
  function traverse(current: Record<string, unknown>, currentPath: string) {
    for (const [key, value] of Object.entries(current)) {
      const fullPath = currentPath ? `${currentPath}.${key}` : key;
      
      if (isPHIField(key)) {
        fields.push({
          path: fullPath,
          field: PHI_FIELD_DEFINITIONS[key],
          value: typeof value === 'string' || typeof value === 'number' ? value : undefined,
        });
      }
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        traverse(value as Record<string, unknown>, fullPath);
      }
    }
  }
  
  traverse(obj, path);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  const criticalFields = fields.filter(f => f.field.sensitivity === 'critical');
  const unencryptedCritical = criticalFields.filter(f => 
    typeof f.value === 'string' && !f.value.includes(':') // Rough check for encryption
  );
  
  if (unencryptedCritical.length > 0) {
    recommendations.push(
      `Encrypt ${unencryptedCritical.length} critical sensitivity fields`
    );
  }
  
  if (fields.length > 0) {
    recommendations.push('Ensure all PHI access is audit logged');
    recommendations.push('Validate user authorization before PHI access');
  }
  
  return {
    containsPhi: fields.length > 0,
    fields,
    recommendations,
  };
}

// ============================================
// Validation
// ============================================

/**
 * Validate a PHI field value
 * 
 * @param fieldName - Field name
 * @param value - Value to validate
 * @returns Validation result
 */
export function validatePHIField(
  fieldName: string,
  value: unknown
): { valid: boolean; error?: string } {
  const field = PHI_FIELD_DEFINITIONS[fieldName];
  
  if (!field) {
    return { valid: true }; // Not a known PHI field
  }
  
  if (field.required && (value === undefined || value === null || value === '')) {
    return { 
      valid: false, 
      error: `${field.displayName} is required` 
    };
  }
  
  if (value && field.pattern && typeof value === 'string') {
    if (!field.pattern.test(value)) {
      return { 
        valid: false, 
        error: `${field.displayName} format is invalid` 
      };
    }
  }
  
  return { valid: true };
}

/**
 * Validate all PHI fields in an object
 * 
 * @param obj - Object to validate
 * @returns Validation results
 */
export function validatePHIFields(
  obj: Record<string, unknown>
): Array<{ field: string; valid: boolean; error?: string }> {
  const results: Array<{ field: string; valid: boolean; error?: string }> = [];
  
  for (const key of Object.keys(obj)) {
    if (isPHIField(key)) {
      const result = validatePHIField(key, obj[key]);
      results.push({ field: key, ...result });
    }
  }
  
  return results;
}

// ============================================
// Masking
// ============================================

/**
 * Mask a PHI value for display
 * 
 * @param fieldName - Field name
 * @param value - Value to mask
 * @returns Masked value
 */
export function maskPHIValue(fieldName: string, value: string): string {
  const field = PHI_FIELD_DEFINITIONS[fieldName];
  
  if (!field) return value;
  
  switch (field.category) {
    case 'identifiers':
      if (fieldName === 'ssn') {
        return value.replace(/\d{3}-?\d{2}/, '***-**');
      }
      if (fieldName === 'firstName' || fieldName === 'lastName' || fieldName === 'name') {
        return value.charAt(0) + '*'.repeat(value.length - 1);
      }
      return '*'.repeat(value.length);
      
    case 'contact':
      if (fieldName === 'email') {
        const [local, domain] = value.split('@');
        return local.charAt(0) + '***@' + domain;
      }
      if (fieldName === 'phone') {
        return value.slice(-4).padStart(value.length, '*');
      }
      if (fieldName === 'address') {
        return '***';
      }
      return '*'.repeat(Math.min(value.length, 10));
      
    case 'medical':
      return '[REDACTED]';
      
    default:
      return '*'.repeat(Math.min(value.length, 8));
  }
}

/**
 * Mask all PHI fields in an object
 * 
 * @param obj - Object to mask
 * @returns Object with masked values
 */
export function maskPHIFields<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  
  for (const key of Object.keys(result)) {
    if (isPHIField(key) && typeof result[key] === 'string') {
      (result as Record<string, string>)[key] = maskPHIValue(
        key, 
        result[key] as string
      );
    }
  }
  
  return result;
}

// ============================================
// HIPAA 18 Identifiers
// ============================================

/**
 * The 18 HIPAA identifiers that qualify as PHI
 * 
 * @see https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html
 */
export const HIPAA_18_IDENTIFIERS = [
  'Names',
  'Geographic subdivisions smaller than state',
  'Dates (except year)',
  'Phone numbers',
  'Fax numbers',
  'Email addresses',
  'SSN',
  'MRN',
  'Health plan numbers',
  'Account numbers',
  'Certificate/license numbers',
  'Vehicle identifiers',
  'Device identifiers',
  'Web URLs',
  'IP addresses',
  'Biometric identifiers',
  'Full-face photos',
  'Any other unique identifying number',
] as const;

/**
 * Check if field is one of the 18 HIPAA identifiers
 * 
 * @param fieldName - Field name
 * @returns True if it's a HIPAA identifier
 */
export function isHIPAAIdentifier(fieldName: string): boolean {
  const identifierFields = [
    'name', 'firstName', 'lastName',
    'dateOfBirth', 'admissionDate', 'dischargeDate',
    'phone', 'fax', 'email',
    'ssn', 'mrn', 'healthPlanId',
    'accountNumber', 'certificateNumber',
    'deviceId', 'url', 'ipAddress',
    'biometric', 'photo',
  ];
  
  return identifierFields.includes(fieldName);
}
