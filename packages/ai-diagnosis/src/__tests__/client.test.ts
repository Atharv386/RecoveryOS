import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIDiagnosisService } from '../client.js';
import { DiagnosisCache } from '../cache.js';
import { FailureContext } from '../types.js';

describe('Groq Free-Tier AIDiagnosisService Verification', () => {
  beforeEach(() => {
    DiagnosisCache.clear();
  });

  const sampleContext: FailureContext = {
    merchantId: 'm_test_1',
    paymentId: 'pay_test_123',
    amountInPaise: 149900,
    currency: 'INR',
    method: 'card',
    errorCode: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
    errorDescription: 'Your card has insufficient funds for this transaction',
    errorSource: 'bank',
    errorStep: 'payment_authorization',
    attemptNumber: 0,
    customerHistory: {
      totalPayments: 5,
      successfulPayments: 4
    }
  };

  it('should run deterministic fallback when AI is disabled or unconfigured', async () => {
    const service = new AIDiagnosisService({
      enabled: false
    });

    const result = await service.diagnose(sampleContext);
    expect(result.isFallback).toBe(true);
    expect(result.modelName).toBe('deterministic_fallback_v1');
    expect(result.diagnosis.failure_class).toBe('INSUFFICIENT_FUNDS');
    expect(result.diagnosis.recommended_action).toBe('DELAYED_RETRY');
    expect(result.inputHash).toBeDefined();
  });

  it('should successfully parse and validate live Groq Llama 3.3 70B JSON output', async () => {
    const service = new AIDiagnosisService({
      enabled: true,
      apiKey: 'gsk_test_groq_key_123',
      modelName: 'llama-3.3-70b-versatile'
    });

    // Mock Groq API JSON response
    vi.spyOn(service, 'callGroq').mockResolvedValue(
      JSON.stringify({
        failure_class: 'INSUFFICIENT_FUNDS',
        confidence: 0.96,
        recommended_action: 'DELAYED_RETRY',
        recommended_delay_minutes: 360,
        reasoning: 'Llama 3.3 70B: Customer balance insufficient. Applying standard 6-hour cooling window.'
      })
    );

    const result = await service.diagnose(sampleContext);

    expect(result.isFallback).toBe(false);
    expect(result.modelName).toBe('llama-3.3-70b-versatile');
    expect(result.diagnosis.failure_class).toBe('INSUFFICIENT_FUNDS');
    expect(result.diagnosis.confidence).toBe(0.96);
    expect(result.diagnosis.recommended_delay_minutes).toBe(360);
    expect(result.diagnosis.reasoning).toContain('Llama 3.3 70B');
  });

  it('should automatically fall back if Groq times out or throws an error', async () => {
    const service = new AIDiagnosisService({
      enabled: true,
      apiKey: 'gsk_test_groq_key_123',
      timeoutMs: 50
    });

    vi.spyOn(service, 'callGroq').mockRejectedValue(new Error('Groq rate limit exceeded (HTTP 429)'));

    const result = await service.diagnose(sampleContext);

    // Gracefully degrades to rule fallback
    expect(result.isFallback).toBe(true);
    expect(result.modelName).toContain('fallback');
    expect(result.diagnosis.failure_class).toBe('INSUFFICIENT_FUNDS');
  });

  it('should automatically fall back if Groq returns invalid schema or hallucinated fields', async () => {
    const service = new AIDiagnosisService({
      enabled: true,
      apiKey: 'gsk_test_groq_key_123'
    });

    vi.spyOn(service, 'callGroq').mockResolvedValue(
      JSON.stringify({
        unknown_hallucinated_field: true
      })
    );

    const result = await service.diagnose(sampleContext);

    // Zod validator catches bad output and falls back to deterministic rules
    expect(result.isFallback).toBe(true);
    expect(result.diagnosis.failure_class).toBe('INSUFFICIENT_FUNDS');
  });
});
