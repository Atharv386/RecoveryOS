import { describe, it, expect } from 'vitest';
import { classifyWithFallback } from '../fallback.js';
import { FailureContext } from '../types.js';

describe('AI Fallback Classifier', () => {
  const baseContext: FailureContext = {
    merchantId: 'm_123',
    paymentId: 'pay_123',
    amountInPaise: 150000,
    currency: 'INR',
    method: 'card',
    attemptNumber: 1
  };

  it('should map insufficient balance to INSUFFICIENT_FUNDS with 6h cooling window', () => {
    const result = classifyWithFallback({
      ...baseContext,
      errorCode: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE'
    });

    expect(result.failure_class).toBe('INSUFFICIENT_FUNDS');
    expect(result.recommended_action).toBe('DELAYED_RETRY');
    expect(result.recommended_delay_minutes).toBe(360);
    expect(result.confidence).toBe(1.0);
  });

  it('should map OTP failure to AUTHENTICATION_FAILED with PAYMENT_LINK', () => {
    const result = classifyWithFallback({
      ...baseContext,
      errorCode: 'BAD_REQUEST_PAYMENT_OTP_INCORRECT'
    });

    expect(result.failure_class).toBe('AUTHENTICATION_FAILED');
    expect(result.recommended_action).toBe('PAYMENT_LINK');
    expect(result.recommended_delay_minutes).toBe(0);
  });

  it('should map card expiration to EXPIRED_INSTRUMENT with PAYMENT_LINK', () => {
    const result = classifyWithFallback({
      ...baseContext,
      errorCode: 'BAD_REQUEST_PAYMENT_CARD_EXPIRED'
    });

    expect(result.failure_class).toBe('EXPIRED_INSTRUMENT');
    expect(result.recommended_action).toBe('PAYMENT_LINK');
  });

  it('should map suspected fraud to SUSPECTED_FRAUD and MANUAL_ESCALATION', () => {
    const result = classifyWithFallback({
      ...baseContext,
      errorCode: 'BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD'
    });

    expect(result.failure_class).toBe('SUSPECTED_FRAUD');
    expect(result.recommended_action).toBe('MANUAL_ESCALATION');
  });

  it('should return safe default for unknown error codes', () => {
    const result = classifyWithFallback({
      ...baseContext,
      errorCode: 'SOME_UNSEEN_RANDOM_CODE'
    });

    expect(result.failure_class).toBe('UNKNOWN_ERROR');
    expect(result.recommended_action).toBe('PAYMENT_LINK');
  });
});
