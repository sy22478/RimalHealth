/**
 * Webhook Integration Tests
 * 
 * Tests for:
 * - POST /api/webhooks/stripe
 * 
 * @module tests/integration/webhooks
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

// Route handlers
import { POST as stripeWebhookHandler } from '@/app/api/webhooks/stripe/route';

// Test helpers
import { createTestUser } from '@/tests/helpers/auth';
import { getBasePrisma } from '@/lib/db/prisma';

const prisma = getBasePrisma();

// ============================================
// Stripe Test Helpers
// ============================================

// Mock Stripe for testing
const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
  },
  subscriptions: {
    retrieve: vi.fn(),
  },
};

vi.mock('stripe', () => ({
  default: vi.fn(() => mockStripe),
}));

/**
 * Create a mock Stripe event
 */
function createMockStripeEvent(
  type: string,
  data: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `evt_${Date.now()}`,
    object: 'event',
    api_version: '2026-01-28.clover',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: {
      object: data,
    },
  };
}

/**
 * Create a mock checkout session
 */
function createMockCheckoutSession(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `cs_${Date.now()}`,
    object: 'checkout.session',
    amount_total: 5000,
    currency: 'usd',
    customer: `cus_${Date.now()}`,
    customer_email: `test${Date.now()}@example.com`,
    subscription: `sub_${Date.now()}`,
    payment_intent: `pi_${Date.now()}`,
    status: 'complete',
    ...overrides,
  };
}

/**
 * Create a mock subscription
 */
function createMockSubscription(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `sub_${Date.now()}`,
    object: 'subscription',
    status: 'active',
    billing_cycle_anchor: Math.floor(Date.now() / 1000),
    cancel_at_period_end: false,
    items: {
      data: [{
        id: `si_${Date.now()}`,
        price: {
          id: `price_${Date.now()}`,
          unit_amount: 5000,
          currency: 'usd',
        },
      }],
    },
    ...overrides,
  };
}

/**
 * Create a mock invoice
 */
function createMockInvoice(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `in_${Date.now()}`,
    object: 'invoice',
    amount_due: 5000,
    currency: 'usd',
    status: 'paid',
    subscription: `sub_${Date.now()}`,
    charge: `ch_${Date.now()}`,
    ...overrides,
  };
}

// ============================================
// Request Helpers
// ============================================

function createMockWebhookRequest(
  payload: string,
  signature: string = 'test-signature'
): NextRequest {
  const url = 'http://localhost:3000/api/webhooks/stripe';
  
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  }) as unknown as NextRequest;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return null;
}

// ============================================
// Stripe Webhook Tests
// ============================================

describe('POST /api/webhooks/stripe', () => {
  beforeAll(() => {
    // Reset mocks before tests
    vi.clearAllMocks();
  });

  describe('✅ Signature Verification', () => {
    it('should return 400 when signature is missing', async () => {
      const url = 'http://localhost:3000/api/webhooks/stripe';
      const request = new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }) as unknown as NextRequest;
      
      const response = await stripeWebhookHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        error: 'Missing signature',
      });
    });

    it('should return 400 when signature is invalid', async () => {
      const payload = JSON.stringify(createMockStripeEvent('test.event'));
      const request = createMockWebhookRequest(payload, 'invalid-signature');
      
      // Mock constructEvent to throw error
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      
      const response = await stripeWebhookHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        error: 'Invalid signature',
      });
    });
  });

  describe('✅ Event Handling', () => {
    it('should handle checkout.session.completed event', async () => {
      // Create a test user first
      const user = await createTestUser();
      
      const checkoutSession = createMockCheckoutSession({
        customer_email: user.email,
      });
      
      const event = createMockStripeEvent('checkout.session.completed', checkoutSession);
      const payload = JSON.stringify(event);
      
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue(createMockSubscription());
      
      const request = createMockWebhookRequest(payload);
      
      const response = await stripeWebhookHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        received: true,
      });
    });

    it('should handle invoice.payment_succeeded event', async () => {
      const subscription = createMockSubscription();
      const invoice = createMockInvoice({
        subscription: subscription.id,
      });
      
      const event = createMockStripeEvent('invoice.payment_succeeded', invoice);
      const payload = JSON.stringify(event);
      
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      
      const request = createMockWebhookRequest(payload);
      
      const response = await stripeWebhookHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        received: true,
      });
    });

    it('should handle invoice.payment_failed event', async () => {
      const subscription = createMockSubscription();
      const invoice = createMockInvoice({
        subscription: subscription.id,
        status: 'open',
      });
      
      const event = createMockStripeEvent('invoice.payment_failed', invoice);
      const payload = JSON.stringify(event);
      
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      
      const request = createMockWebhookRequest(payload);
      
      const response = await stripeWebhookHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        received: true,
      });
    });

    it('should handle customer.subscription.deleted event', async () => {
      const subscription = createMockSubscription({
        status: 'canceled',
      });
      
      const event = createMockStripeEvent('customer.subscription.deleted', subscription);
      const payload = JSON.stringify(event);
      
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      
      const request = createMockWebhookRequest(payload);
      
      const response = await stripeWebhookHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        received: true,
      });
    });

    it('should handle customer.subscription.updated event', async () => {
      const subscription = createMockSubscription({
        status: 'active',
        cancel_at_period_end: true,
      });
      
      const event = createMockStripeEvent('customer.subscription.updated', subscription);
      const payload = JSON.stringify(event);
      
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      
      const request = createMockWebhookRequest(payload);
      
      const response = await stripeWebhookHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        received: true,
      });
    });

    it('should handle unknown event types gracefully', async () => {
      const event = createMockStripeEvent('unknown.event', { id: 'test' });
      const payload = JSON.stringify(event);
      
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      
      const request = createMockWebhookRequest(payload);
      
      const response = await stripeWebhookHandler(request);
      const body = await parseResponse(response);
      
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        received: true,
      });
    });
  });

  describe('❌ Error Handling', () => {
    it('should return 200 even when event processing fails (to prevent retries)', async () => {
      const user = await createTestUser();
      
      const checkoutSession = createMockCheckoutSession({
        customer_email: user.email,
      });
      
      const event = createMockStripeEvent('checkout.session.completed', checkoutSession);
      const payload = JSON.stringify(event);
      
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      
      // Force an error during processing
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Stripe API error'));
      
      const request = createMockWebhookRequest(payload);
      
      const response = await stripeWebhookHandler(request);
      const body = await parseResponse(response);
      
      // Should still return 200 to prevent Stripe retries
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        received: true,
        error: 'Processing error',
      });
    });

    it('should handle missing customer email in checkout session', async () => {
      const checkoutSession = createMockCheckoutSession({
        customer_email: null,
      });
      
      const event = createMockStripeEvent('checkout.session.completed', checkoutSession);
      const payload = JSON.stringify(event);
      
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      
      const request = createMockWebhookRequest(payload);
      
      const response = await stripeWebhookHandler(request);
      
      // Should return 200 but log error internally
      expect(response.status).toBe(200);
    });

    it('should handle user not found for checkout session', async () => {
      const checkoutSession = createMockCheckoutSession({
        customer_email: 'nonexistent@example.com',
      });
      
      const event = createMockStripeEvent('checkout.session.completed', checkoutSession);
      const payload = JSON.stringify(event);
      
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      
      const request = createMockWebhookRequest(payload);
      
      const response = await stripeWebhookHandler(request);
      
      // Should return 200 but log error internally
      expect(response.status).toBe(200);
    });
  });

  describe('✅ Idempotency', () => {
    it('should handle duplicate checkout.session.completed events', async () => {
      const user = await createTestUser();
      
      const checkoutSession = createMockCheckoutSession({
        customer_email: user.email,
      });
      
      const event = createMockStripeEvent('checkout.session.completed', checkoutSession);
      const payload = JSON.stringify(event);
      
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue(createMockSubscription());
      
      // First request
      const request1 = createMockWebhookRequest(payload);
      const response1 = await stripeWebhookHandler(request1);
      
      expect(response1.status).toBe(200);
      
      // Second request (duplicate)
      const request2 = createMockWebhookRequest(payload);
      const response2 = await stripeWebhookHandler(request2);
      
      // Should still succeed (idempotent)
      expect(response2.status).toBe(200);
    });
  });
});

// ============================================
// Webhook Security Tests
// ============================================

describe('Webhook Security', () => {
  it('should reject requests with tampered payload', async () => {
    const originalPayload = JSON.stringify(createMockStripeEvent('test.event'));
    const tamperedPayload = originalPayload + 'tampered';
    
    const request = createMockWebhookRequest(tamperedPayload, 'valid-signature');
    
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    
    const response = await stripeWebhookHandler(request);
    
    expect(response.status).toBe(400);
  });

  it('should reject requests with wrong timestamp', async () => {
    const event = createMockStripeEvent('test.event');
    event.created = Math.floor(Date.now() / 1000) - 1000; // Old timestamp
    const payload = JSON.stringify(event);
    
    const request = createMockWebhookRequest(payload, 'valid-signature');
    
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Timestamp too old');
    });
    
    const response = await stripeWebhookHandler(request);
    
    expect(response.status).toBe(400);
  });

  it('should require webhook secret', async () => {
    // Temporarily remove webhook secret
    const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = '';
    
    const event = createMockStripeEvent('test.event');
    const payload = JSON.stringify(event);
    
    const request = createMockWebhookRequest(payload);
    
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('No webhook secret configured');
    });
    
    const response = await stripeWebhookHandler(request);
    
    // Restore secret
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    
    expect(response.status).toBe(400);
  });
});
