import { describe, it, expect, beforeEach } from 'vitest';
import { DiagnosisCache } from '../cache.js';
import { FailureContext } from '../types.js';

describe('DiagnosisCache (Section 14.2 Zero-Cost Optimization)', () => {
  const context: FailureContext = {
    merchantId: 'm_1',
    paymentId: 'pay_1',
    amountInPaise: 149900, // ₹1,499 -> MID_1K-5K
    currency: 'INR',
    method: 'card',
    errorCode: 'BAD_REQUEST_PAYMENT_CARD_EXPIRED',
    attemptNumber: 0
  };

  beforeEach(() => {
    DiagnosisCache.clear();
  });

  it('should generate deterministic cache key based on error_code, method, and amount bucket', () => {
    const key = DiagnosisCache.getCacheKey(context);
    expect(key).toBe('BAD_REQUEST_PAYMENT_CARD_EXPIRED:card:MID_1K-5K');
  });

  it('should cache and return diagnosis without calling external AI', () => {
    expect(DiagnosisCache.get(context)).toBeNull();

    const diagnosis = {
      failure_class: 'EXPIRED_INSTRUMENT' as const,
      confidence: 0.99,
      recommended_action: 'PAYMENT_LINK' as const,
      recommended_delay_minutes: 0,
      reasoning: 'Card is expired, send payment link.'
    };

    DiagnosisCache.set(context, diagnosis);

    const cached = DiagnosisCache.get(context);
    expect(cached).toEqual(diagnosis);

    const stats = DiagnosisCache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRatePercent).toBe(50.0);
  });
});
