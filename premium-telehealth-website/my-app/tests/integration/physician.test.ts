/**
 * Physician Endpoints Integration Tests
 * 
 * Tests for:
 * - GET /api/physician/queue
 * - GET /api/physician/intake/[id]
 * - POST /api/physician/review
 * 
 * @module tests/integration/physician
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { Role, IntakeStatus, ReviewDecision } from '@prisma/client';

// Route handlers
import { GET as getQueueHandler } from '@/app/api/physician/queue/route';
import { GET as getIntakeHandler } from '@/app/api/physician/intake/[id]/route';
import { POST as reviewHandler } from '@/app/api/physician/review/route';

// Test helpers
import { createTestUser, getAuthHeaders, generateTestEmail } from '@/tests/helpers/auth';
import { getBasePrisma } from '@/lib/db/prisma';

const prisma = getBasePrisma();

// ============================================
// Request Helpers
// ============================================

function createMockRequest(
  body: unknown = null,
  options: {
    method?: string;
    headers?: Record<string, string>;
    url?: string;
  } = {}
): NextRequest {
  const url = options.url || 'http://localhost:3000/api/test';
  
  const init: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  
  if (body !== null) {
    init.body = JSON.stringify(body);
  }
  
  return new Request(url, init) as unknown as NextRequest;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return null;
}

// ============================================
// Queue Endpoint Tests
// ============================================

describe('GET /api/physician/queue', () => {
  describe('✅ Success Cases', () => {
    it('should return queue data for physician', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const request = createMockRequest(null, {
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await getQueueHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        items: expect.any(Array),
        stats: expect.objectContaining({
          totalPending: expect.any(Number),
          overdueCount: expect.any(Number),
          underReviewCount: expect.any(Number),
          newlySubmittedCount: expect.any(Number),
        }),
        lastUpdated: expect.any(String),
      });
    });

    it('should return queue data for admin', async () => {
      const admin = await createTestUser({ role: Role.ADMIN });
      const request = createMockRequest(null, {
        headers: getAuthHeaders(admin.accessToken),
      });
      
      const response = await getQueueHandler(request);
      
      expect(response.status).toBe(200);
    });

    it('should support query parameter filtering', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const request = createMockRequest(null, {
        url: 'http://localhost:3000/api/physician/queue?status=SUBMITTED&concernType=ALCOHOL',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await getQueueHandler(request);
      
      expect(response.status).toBe(200);
    });

    it('should support search query parameter', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const request = createMockRequest(null, {
        url: 'http://localhost:3000/api/physician/queue?search=john',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await getQueueHandler(request);
      
      expect(response.status).toBe(200);
    });

    it('should support sorting parameters', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const request = createMockRequest(null, {
        url: 'http://localhost:3000/api/physician/queue?sortBy=submittedAt&sortOrder=desc',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await getQueueHandler(request);
      
      expect(response.status).toBe(200);
    });
  });

  describe('❌ Unauthorized', () => {
    it('should return 401 when no token provided', async () => {
      const request = createMockRequest();
      
      const response = await getQueueHandler(request);
      
      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      const request = createMockRequest(null, {
        headers: getAuthHeaders('invalid-token'),
      });
      
      const response = await getQueueHandler(request);
      
      expect(response.status).toBe(401);
    });

    it('should return 403 for patient role', async () => {
      const patient = await createTestUser({ role: Role.PATIENT });
      const request = createMockRequest(null, {
        headers: getAuthHeaders(patient.accessToken),
      });
      
      const response = await getQueueHandler(request);
      
      expect(response.status).toBe(403);
    });
  });
});

// ============================================
// Intake Detail Endpoint Tests
// ============================================

describe('GET /api/physician/intake/[id]', () => {
  describe('✅ Success Cases', () => {
    it('should return intake details for physician', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const patient = await createTestUser({ role: Role.PATIENT });
      
      // Create an intake
      const intake = await prisma.intake.create({
        data: {
          patientId: patient.id,
          status: IntakeStatus.SUBMITTED,
          formData: JSON.stringify({
            severity: 'MODERATE',
            drinkingDaysPerWeek: 5,
            drinksPerDrinkingDay: 4,
            hasWithdrawalSymptoms: false,
            previousQuitAttempts: 2,
            medications: [],
            allergies: [],
            medicalConditions: [],
          }),
          submittedAt: new Date(),
        },
      });
      
      const request = createMockRequest(null, {
        url: `http://localhost:3000/api/physician/intake/${intake.id}`,
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const params = Promise.resolve({ id: intake.id });
      const response = await getIntakeHandler(request, { params });
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toHaveProperty('id', intake.id);
    });

    it('should return intake details for admin', async () => {
      const admin = await createTestUser({ role: Role.ADMIN });
      const patient = await createTestUser({ role: Role.PATIENT });
      
      const intake = await prisma.intake.create({
        data: {
          patientId: patient.id,
          status: IntakeStatus.SUBMITTED,
          formData: JSON.stringify({
            severity: 'MILD',
            drinksPerWeek: 14,
            previousQuitAttempts: 1,
            medications: [],
            allergies: [],
            medicalConditions: [],
          }),
          submittedAt: new Date(),
        },
      });
      
      const request = createMockRequest(null, {
        url: `http://localhost:3000/api/physician/intake/${intake.id}`,
        headers: getAuthHeaders(admin.accessToken),
      });
      
      const params = Promise.resolve({ id: intake.id });
      const response = await getIntakeHandler(request, { params });
      
      expect(response.status).toBe(200);
    });
  });

  describe('❌ Not Found', () => {
    it('should return 404 for non-existent intake', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const request = createMockRequest(null, {
        url: 'http://localhost:3000/api/physician/intake/non-existent-id',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const params = Promise.resolve({ id: 'non-existent-id' });
      const response = await getIntakeHandler(request, { params });
      
      expect(response.status).toBe(404);
    });
  });

  describe('❌ Unauthorized', () => {
    it('should return 401 when no token provided', async () => {
      const request = createMockRequest(null, {
        url: 'http://localhost:3000/api/physician/intake/some-id',
      });
      
      const params = Promise.resolve({ id: 'some-id' });
      const response = await getIntakeHandler(request, { params });
      
      expect(response.status).toBe(401);
    });

    it('should return 403 for patient role', async () => {
      const patient = await createTestUser({ role: Role.PATIENT });
      const request = createMockRequest(null, {
        url: 'http://localhost:3000/api/physician/intake/some-id',
        headers: getAuthHeaders(patient.accessToken),
      });
      
      const params = Promise.resolve({ id: 'some-id' });
      const response = await getIntakeHandler(request, { params });
      
      expect(response.status).toBe(403);
    });
  });
});

// ============================================
// Review Endpoint Tests
// ============================================

describe('POST /api/physician/review', () => {
  describe('✅ Success Cases', () => {
    it('should approve an intake with medication', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const patient = await createTestUser({ role: Role.PATIENT });
      
      // Create an intake to review
      const intake = await prisma.intake.create({
        data: {
          patientId: patient.id,
          status: IntakeStatus.SUBMITTED,
          formData: JSON.stringify({
            severity: 'MODERATE',
            drinkingDaysPerWeek: 5,
            drinksPerDrinkingDay: 4,
            hasWithdrawalSymptoms: false,
            previousQuitAttempts: 2,
            medications: [],
            allergies: [],
            medicalConditions: [],
          }),
          submittedAt: new Date(),
        },
      });
      
      const payload = {
        intakeId: intake.id,
        decision: 'APPROVE',
        clinicalNotes: 'Patient is a good candidate for medication-assisted treatment. Recommend Naltrexone 50mg daily.',
        medication: {
          name: 'Naltrexone',
          genericName: 'Naltrexone Hydrochloride',
          dosage: '50mg',
          quantity: 30,
          refills: 3,
          instructions: 'Take one tablet by mouth daily. Avoid alcohol while taking this medication.',
        },
      };
      
      const request = createMockRequest(payload, {
        method: 'POST',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await reviewHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        reviewId: expect.any(String),
        intakeStatus: 'APPROVED',
        prescriptionId: expect.any(String),
      });
    });

    it('should reject an intake with reason', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const patient = await createTestUser({ role: Role.PATIENT });
      
      const intake = await prisma.intake.create({
        data: {
          patientId: patient.id,
          status: IntakeStatus.SUBMITTED,
          formData: JSON.stringify({
            severity: 'SEVERE',
            drinksPerWeek: 28,
            previousQuitAttempts: 0,
            medications: [],
            allergies: [],
            medicalConditions: [],
          }),
          submittedAt: new Date(),
        },
      });
      
      const payload = {
        intakeId: intake.id,
        decision: 'REJECT',
        clinicalNotes: 'Patient does not meet criteria for telehealth treatment.',
        rejectionReason: 'Contraindications present that require in-person evaluation.',
        alternativeRecommendation: 'Please schedule an in-person appointment with your primary care physician.',
      };
      
      const request = createMockRequest(payload, {
        method: 'POST',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await reviewHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        intakeStatus: 'REJECTED',
      });
    });

    it('should request additional information', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const patient = await createTestUser({ role: Role.PATIENT });
      
      const intake = await prisma.intake.create({
        data: {
          patientId: patient.id,
          status: IntakeStatus.SUBMITTED,
          formData: JSON.stringify({
            severity: 'MODERATE',
            drinkingDaysPerWeek: 3,
            drinksPerDrinkingDay: 3,
            hasWithdrawalSymptoms: false,
            previousQuitAttempts: 1,
            medications: [],
            allergies: [],
            medicalConditions: [],
          }),
          submittedAt: new Date(),
        },
      });
      
      const payload = {
        intakeId: intake.id,
        decision: 'NEEDS_INFO',
        clinicalNotes: 'Need more information before making treatment decision.',
        requestedInfo: 'Please provide details about your previous quit attempts including dates and methods used.',
      };
      
      const request = createMockRequest(payload, {
        method: 'POST',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await reviewHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        intakeStatus: 'NEEDS_INFO',
      });
    });
  });

  describe('❌ Validation Errors', () => {
    it('should return 400 when intakeId is missing', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const payload = {
        decision: 'APPROVE',
        clinicalNotes: 'Test notes',
      };
      
      const request = createMockRequest(payload, {
        method: 'POST',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await reviewHandler(request);
      
      expect(response.status).toBe(400);
    });

    it('should return 400 when decision is invalid', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const payload = {
        intakeId: 'some-id',
        decision: 'INVALID_DECISION',
        clinicalNotes: 'Test notes',
      };
      
      const request = createMockRequest(payload, {
        method: 'POST',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await reviewHandler(request);
      
      expect(response.status).toBe(400);
    });

    it('should return 400 when clinical notes are too short', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const payload = {
        intakeId: 'some-id',
        decision: 'APPROVE',
        clinicalNotes: 'Short',
      };
      
      const request = createMockRequest(payload, {
        method: 'POST',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await reviewHandler(request);
      
      expect(response.status).toBe(400);
    });

    it('should return 400 when medication is missing for APPROVE decision', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const payload = {
        intakeId: 'some-id',
        decision: 'APPROVE',
        clinicalNotes: 'Patient is approved for treatment without medication details.',
      };
      
      const request = createMockRequest(payload, {
        method: 'POST',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await reviewHandler(request);
      
      expect(response.status).toBe(400);
    });

    it('should return 400 when rejectionReason is missing for REJECT decision', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const payload = {
        intakeId: 'some-id',
        decision: 'REJECT',
        clinicalNotes: 'Patient is not approved for treatment.',
      };
      
      const request = createMockRequest(payload, {
        method: 'POST',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await reviewHandler(request);
      
      expect(response.status).toBe(400);
    });

    it('should return 400 when requestedInfo is missing for NEEDS_INFO decision', async () => {
      const physician = await createTestUser({ role: Role.PHYSICIAN });
      const payload = {
        intakeId: 'some-id',
        decision: 'NEEDS_INFO',
        clinicalNotes: 'Need more information.',
      };
      
      const request = createMockRequest(payload, {
        method: 'POST',
        headers: getAuthHeaders(physician.accessToken),
      });
      
      const response = await reviewHandler(request);
      
      expect(response.status).toBe(400);
    });
  });

  describe('❌ Unauthorized', () => {
    it('should return 401 when no token provided', async () => {
      const payload = {
        intakeId: 'some-id',
        decision: 'APPROVE',
        clinicalNotes: 'Test notes',
      };
      
      const request = createMockRequest(payload, { method: 'POST' });
      
      const response = await reviewHandler(request);
      
      expect(response.status).toBe(401);
    });

    it('should return 403 for patient role', async () => {
      const patient = await createTestUser({ role: Role.PATIENT });
      const payload = {
        intakeId: 'some-id',
        decision: 'APPROVE',
        clinicalNotes: 'Test notes',
      };
      
      const request = createMockRequest(payload, {
        method: 'POST',
        headers: getAuthHeaders(patient.accessToken),
      });
      
      const response = await reviewHandler(request);
      
      expect(response.status).toBe(403);
    });
  });
});
