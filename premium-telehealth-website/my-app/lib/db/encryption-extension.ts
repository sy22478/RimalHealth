/**
 * Prisma Client Extension for Automatic PHI Encryption
 * Uses Prisma Client Extensions (Prisma 5.x+ recommended approach)
 *
 * Automatically encrypts PHI fields on create/update
 * Automatically decrypts PHI fields on read
 *
 * HIPAA Compliance:
 * - All PHI fields are encrypted at rest using AES-256-GCM
 * - Encryption/decryption happens transparently via extension
 * - Supports nested JSON objects
 */

import { encryptPHI, decryptPHI, isEncrypted, encryptJSON, decryptJSON } from '../encryption/phi';

// Define which fields contain PHI and should be encrypted
// Maps model names to their PHI field names
export const PHI_FIELDS: Record<string, string[]> = {
  PatientProfile: [
    'firstName',
    'lastName',
    'dateOfBirth',
    'phone',
    'addressStreet',
    'addressCity',
    'addressZip',
    'billingStreet',
    'billingCity',
    'billingState',
    'billingZip',
    'medicalHistory',
    'currentMedications',
    'allergies',
    'insuranceProvider',
    'insuranceMemberId',
    'insuranceGroupNumber',
  ],
  Intake: [
    'formData',
    'medicationList',
  ],
  Review: [
    'clinicalNotes',
    'contraindications',
    'rejectionReason',
    'alternativeRecommendation',
    'instructions',
  ],
  Prescription: [
    'medicationName',
    'dosage',
    'pharmacyName',
    'instructions',
    'pharmacyAddress',
  ],
  Message: [
    'subject',
    'body',
  ],
  PhysicianMessage: [
    'subject',
    'body',
  ],
  PhysicianNote: [
    'content',
  ],
  User: [
    'mfaSecret',
    'mfaBackupCodes',
  ],
};

// JSON fields that need special handling (serialized before encryption)
const JSON_FIELDS: Record<string, string[]> = {
  PatientProfile: ['medicalHistory', 'currentMedications', 'allergies'],
  Intake: ['formData'],
  Review: ['contraindications'],
  User: ['mfaBackupCodes'],
};

// Fields that can be null/undefined
const NULLABLE_FIELDS: Record<string, Set<string>> = {
  PatientProfile: new Set([
    'billingStreet',
    'billingCity',
    'billingState',
    'billingZip',
    'medicalHistory',
    'currentMedications',
    'allergies',
    'insuranceProvider',
    'insuranceMemberId',
    'insuranceGroupNumber',
  ]),
  Intake: new Set(['medicationList']),
  Review: new Set([
    'clinicalNotes',
    'contraindications',
    'rejectionReason',
    'alternativeRecommendation',
    'instructions',
  ]),
  Prescription: new Set(['pharmacyName', 'pharmacyAddress']),
  Message: new Set(['subject']),
  PhysicianMessage: new Set(['subject']),
  User: new Set(['mfaSecret', 'mfaBackupCodes']),
};

/**
 * Check if a field is a JSON field for a given model
 */
function isJSONField(model: string, field: string): boolean {
  return JSON_FIELDS[model]?.includes(field) ?? false;
}

/**
 * Check if a field is nullable for a given model
 */
function isNullableField(model: string, field: string): boolean {
  return NULLABLE_FIELDS[model]?.has(field) ?? false;
}

/**
 * Encrypt a single field value
 */
function encryptField(
  model: string,
  field: string,
  value: unknown
): string | null {
  // Handle null/undefined for nullable fields
  if ((value === null || value === undefined) && isNullableField(model, field)) {
    return null;
  }

  // Skip if already encrypted (idempotent)
  if (typeof value === 'string' && isEncrypted(value)) {
    return value;
  }

  // Handle JSON fields
  if (isJSONField(model, field)) {
    if (value === null || value === undefined) {
      return null;
    }
    return encryptJSON(value as Record<string, unknown>);
  }

  // Handle string fields
  if (typeof value === 'string') {
    return encryptPHI(value);
  }

  // Convert other types to string and encrypt
  if (value !== null && value !== undefined) {
    return encryptPHI(String(value));
  }

  return null;
}

/**
 * Decrypt a single field value
 */
function decryptField(
  model: string,
  field: string,
  value: unknown
): unknown {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Skip if not encrypted
  if (typeof value !== 'string' || !isEncrypted(value)) {
    return value;
  }

  // Handle JSON fields
  if (isJSONField(model, field)) {
    try {
      return decryptJSON(value);
    } catch {
      // If decryption fails, return as-is (might be unencrypted data)
      return value;
    }
  }

  // Handle string fields
  try {
    return decryptPHI(value);
  } catch {
    // If decryption fails, return as-is (might be unencrypted data)
    return value;
  }
}

/**
 * Encrypt PHI fields in a data object
 */
function encryptPHIFields(
  model: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const phiFields = PHI_FIELDS[model];
  if (!phiFields || phiFields.length === 0) {
    return data;
  }

  const encrypted: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    encrypted[key] = data[key];
  }

  for (const field of phiFields) {
    if (field in encrypted) {
      encrypted[field] = encryptField(model, field, encrypted[field]);
    }
  }

  return encrypted;
}

/**
 * Decrypt PHI fields in a result object
 */
function decryptPHIFields<T>(
  model: string,
  data: T
): T {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const phiFields = PHI_FIELDS[model];
  if (!phiFields || phiFields.length === 0) {
    return data;
  }

  const record = data as Record<string, unknown>;
  const decrypted: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    decrypted[key] = record[key];
  }

  for (const field of phiFields) {
    if (field in decrypted) {
      decrypted[field] = decryptField(model, field, decrypted[field]);
    }
  }

  return decrypted as T;
}

/**
 * Map of Prisma relation field names to their target model names.
 * This allows the encryption extension to recursively decrypt PHI fields
 * on nested included relations, not just the top-level queried model.
 */
const RELATION_TO_MODEL: Record<string, string> = {
  // User relations
  patientProfile: 'PatientProfile',
  physician: 'Physician',
  intakes: 'Intake',
  messages: 'Message',
  subscriptions: 'Subscription',
  invoices: 'Invoice',
  sessions: 'Session',
  passwordResets: 'PasswordReset',
  consentRecords: 'ConsentRecord',
  disclosureRestrictions: 'DisclosureRestriction',
  // PatientProfile relations
  user: 'User',
  preferredPharmacy: 'Pharmacy',
  documents: 'Document',
  // Intake relations
  patient: 'User',
  reviews: 'Review',
  prescriptions: 'Prescription',
  // Review relations
  intake: 'Intake',
  // Prescription relations
  pharmacy: 'Pharmacy',
  refillRequests: 'RefillRequest',
  // Physician relations
  physicianNotes: 'PhysicianNote',
  sentMessages: 'PhysicianMessage',
  receivedMessages: 'PhysicianMessage',
  // PhysicianMessage relations
  sender: 'Physician',
  recipient: 'Physician',
  parent: 'PhysicianMessage',
  replies: 'PhysicianMessage',
};

/**
 * Recursively decrypt PHI fields in nested objects/arrays.
 * Walks into nested relations using RELATION_TO_MODEL mapping
 * so that included relations (e.g., patient.patientProfile) are
 * also decrypted automatically.
 */
function decryptNestedPHIFields<T>(model: string, data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => decryptNestedPHIFields(model, item)) as T;
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    // First, decrypt PHI fields for this model
    const decrypted = decryptPHIFields(model, data as Record<string, unknown>);

    // Then recursively decrypt any nested relations
    for (const key of Object.keys(decrypted)) {
      const nestedModel = RELATION_TO_MODEL[key];
      if (nestedModel && decrypted[key] != null && typeof decrypted[key] === 'object') {
        decrypted[key] = decryptNestedPHIFields(nestedModel, decrypted[key]);
      }
    }

    return decrypted as T;
  }

  return data;
}

/**
 * Create Prisma Client extension for PHI encryption
 *
 * Usage:
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { createEncryptionExtension } from './encryption-extension';
 *
 * const prisma = new PrismaClient().$extends(createEncryptionExtension());
 * ```
 */
export function createEncryptionExtension() {
  return {
    name: 'phi-encryption',
    query: {
      $allModels: {
        // Intercept create operations
        async create<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: { data?: Record<string, unknown> };
          query: (args: { data?: Record<string, unknown> }) => Promise<T>;
        }): Promise<T> {
          if (PHI_FIELDS[model] && args.data) {
            args = {
              ...args,
              data: encryptPHIFields(model, args.data)
            };
          }

          const result = await query(args);
          // Use model (PascalCase) directly for PHI_FIELDS lookup — not camelCase
          return decryptNestedPHIFields(model, result);
        },

        // Intercept createMany operations
        async createMany<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: { data?: Record<string, unknown>[] | Record<string, unknown> };
          query: (args: { data?: Record<string, unknown>[] | Record<string, unknown> }) => Promise<T>;
        }): Promise<T> {
          if (PHI_FIELDS[model] && args.data) {
            if (Array.isArray(args.data)) {
              args = {
                ...args,
                data: args.data.map(item => encryptPHIFields(model, item))
              };
            } else {
              args = {
                ...args,
                data: encryptPHIFields(model, args.data)
              };
            }
          }

          return query(args);
        },

        // Intercept update operations
        async update<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: { data?: Record<string, unknown> };
          query: (args: { data?: Record<string, unknown> }) => Promise<T>;
        }): Promise<T> {
          if (PHI_FIELDS[model] && args.data) {
            args = {
              ...args,
              data: encryptPHIFields(model, args.data)
            };
          }

          const result = await query(args);
          return decryptNestedPHIFields(model, result);
        },

        // Intercept updateMany operations
        async updateMany<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: { data?: Record<string, unknown> };
          query: (args: { data?: Record<string, unknown> }) => Promise<T>;
        }): Promise<T> {
          if (PHI_FIELDS[model] && args.data) {
            args = {
              ...args,
              data: encryptPHIFields(model, args.data)
            };
          }

          return query(args);
        },

        // Intercept upsert operations
        async upsert<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: { create?: Record<string, unknown>; update?: Record<string, unknown> };
          query: (args: { create?: Record<string, unknown>; update?: Record<string, unknown> }) => Promise<T>;
        }): Promise<T> {
          if (PHI_FIELDS[model]) {
            const newArgs = { ...args };
            if (args.create) {
              newArgs.create = encryptPHIFields(model, args.create);
            }
            if (args.update) {
              newArgs.update = encryptPHIFields(model, args.update);
            }
            args = newArgs;
          }

          const result = await query(args);
          return decryptNestedPHIFields(model, result);
        },

        // Intercept findUnique operations
        async findUnique<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<T>;
        }): Promise<T> {
          const result = await query(args);
          return decryptNestedPHIFields(model, result);
        },

        // Intercept findFirst operations
        async findFirst<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<T>;
        }): Promise<T> {
          const result = await query(args);
          return decryptNestedPHIFields(model, result);
        },

        // Intercept findMany operations
        async findMany<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<T>;
        }): Promise<T> {
          const result = await query(args);
          return decryptNestedPHIFields(model, result);
        },

        // Intercept findFirstOrThrow operations
        async findFirstOrThrow<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<T>;
        }): Promise<T> {
          const result = await query(args);
          return decryptNestedPHIFields(model, result);
        },

        // Intercept findUniqueOrThrow operations
        async findUniqueOrThrow<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<T>;
        }): Promise<T> {
          const result = await query(args);
          return decryptNestedPHIFields(model, result);
        },

        // Intercept delete operations
        async delete<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<T>;
        }): Promise<T> {
          const result = await query(args);
          return decryptNestedPHIFields(model, result);
        },

        // Intercept deleteMany operations
        async deleteMany<T>({ model, args, query }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<T>;
        }): Promise<T> {
          return query(args);
        },
      },
    },
  };
}

/**
 * Manual encryption helper for non-extension scenarios
 * Use when you need to encrypt data outside of Prisma operations
 */
export function encryptModelFields<T extends Record<string, unknown>>(
  model: keyof typeof PHI_FIELDS,
  data: T
): Record<string, unknown> {
  return encryptPHIFields(model as string, data);
}

/**
 * Manual decryption helper for non-extension scenarios
 * Use when you need to decrypt data outside of Prisma operations
 */
export function decryptModelFields<T>(
  model: keyof typeof PHI_FIELDS,
  data: T
): T {
  return decryptPHIFields(model as string, data);
}

/**
 * Get the list of PHI fields for a model
 * Useful for logging, audit trails, or selective encryption
 */
export function getPHIFields(model: string): string[] {
  return PHI_FIELDS[model] ?? [];
}

/**
 * Check if a model has PHI fields
 */
export function hasPHIFields(model: string): boolean {
  return model in PHI_FIELDS && PHI_FIELDS[model].length > 0;
}
