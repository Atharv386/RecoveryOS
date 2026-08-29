import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyRazorpayWebhookSignature } from '../webhook.js';

describe('Razorpay Webhook HMAC Signature Verification', () => {
  const secret = 'test_webhook_secret_key_123';
  const rawBody = JSON.stringify({
    entity: 'event',
    account_id: 'acc_123',
    event: 'payment.failed',
    payload: { payment: { entity: { id: 'pay_123', status: 'failed' } } }
  });

  it('should verify authentic webhook payload with valid HMAC', () => {
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const isValid = verifyRazorpayWebhookSignature(rawBody, validSignature, secret);
    expect(isValid).toBe(true);
  });

  it('should reject tampered payload with mismatched signature', () => {
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const tamperedBody = rawBody + ' ';
    const isValid = verifyRazorpayWebhookSignature(tamperedBody, validSignature, secret);
    expect(isValid).toBe(false);
  });

  it('should reject invalid secret', () => {
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const isValid = verifyRazorpayWebhookSignature(rawBody, validSignature, 'wrong_secret');
    expect(isValid).toBe(false);
  });

  it('should reject missing or empty signatures safely', () => {
    expect(verifyRazorpayWebhookSignature(rawBody, undefined, secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(rawBody, '', secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature('', 'some_sig', secret)).toBe(false);
  });
});
