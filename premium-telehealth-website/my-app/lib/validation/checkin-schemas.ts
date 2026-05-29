/**
 * Server-side Zod validation for GLP-1 check-in submissions (Phase 4).
 *
 * Must stay in sync with `CHECK_IN_QUESTIONS` in
 * `lib/intake/glp1/clinical-config.ts`. Answers are persisted in the encrypted
 * `CheckIn.responses` JSON column. Zod v4 syntax.
 *
 * @module lib/validation/checkin-schemas
 */
import { z } from 'zod';

const severity = z.enum(['none', 'mild', 'moderate', 'severe']);

/** The check-in questionnaire answer set. */
export const checkInResponsesSchema = z.object({
  currentWeightLbs: z.number().min(50).max(1500),
  doseAdherence: z.enum(['none', 'one', 'two-plus']),
  nauseaSeverity: severity,
  vomitingSeverity: severity,
  abdominalPain: z.boolean(),
  otherSideEffects: z.string().max(2000).optional(),
});

export type CheckInResponses = z.infer<typeof checkInResponsesSchema>;

/** POST/PATCH body for submitting a check-in. */
export const submitCheckInSchema = z.object({
  responses: checkInResponsesSchema,
});

export type SubmitCheckInInput = z.infer<typeof submitCheckInSchema>;
