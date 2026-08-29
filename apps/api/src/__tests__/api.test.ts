import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import crypto from 'crypto';

describe('RecoveryOS API Integration Tests', () => {
  let app: FastifyInstance;
  const webhookSecret = 'test_webhook_secret_key';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DEMO_MODE = 'true';
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health should return health payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.service).toBe('RecoveryOS API');
    expect(body.status).toBeDefined();
  });

  it('POST /api/v1/webhooks/razorpay should verify HMAC and accept valid webhook', async () => {
    const payload = {
      entity: 'event',
      account_id: 'acc_test_123',
      event: 'payment.failed',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_test_001',
            amount: 149900,
            currency: 'INR',
            status: 'failed',
            error_code: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE'
          }
        }
      }
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/razorpay',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': signature
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.received).toBe(true);
    expect(['queued', 'queued_offline']).toContain(body.status);
  });

  it('POST /api/v1/webhooks/razorpay should reject invalid HMAC signature with 400', async () => {
    const payload = { event: 'payment.failed' };
    const rawBody = JSON.stringify(payload);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/razorpay',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': 'invalid_forged_signature_hex'
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Invalid webhook signature');
  });

  it('POST /api/v1/simulator/run should simulate counterfactual batch', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/simulator/run',
      headers: { 'content-type': 'application/json' },
      payload: {
        policy: {
          max_retry_attempts: 2,
          cooling_window_hours: 6,
          max_auto_recovery_amount_paise: 1000000,
          require_consent_for_notifications: true,
          min_ai_confidence_threshold: 0.70,
          allowed_channels: ['EMAIL', 'SMS'],
          require_approval_for_fraud_suspicion: true
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.is_simulation).toBe(true);
    expect(body.simulation_results.totalCases).toBeGreaterThan(0);
  });

  it('POST /api/v1/chaos/inject should toggle AI outage switch', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chaos/inject',
      headers: { 'content-type': 'application/json' },
      payload: {
        scenario: 'TOGGLE_AI_OUTAGE',
        parameters: { ai_enabled: false }
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.scenario).toBe('TOGGLE_AI_OUTAGE');
    expect(body.ai_enabled).toBe(false);
  });
});
