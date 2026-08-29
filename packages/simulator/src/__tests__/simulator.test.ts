import { describe, it, expect } from 'vitest';
import { RecoveryTwinSimulator, SyntheticPaymentRecord } from '../index.js';
import { MerchantPolicyConfig } from '@recoveryos/policy-engine';

describe('Recovery Twin Simulator (Counterfactual Simulation Engine)', () => {
  const sampleRecords: SyntheticPaymentRecord[] = [
    {
      id: 'pay_001',
      amountInPaise: 150000,
      failureClass: 'INSUFFICIENT_FUNDS',
      errorCode: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
      customerHistory: { totalPayments: 5, successfulPayments: 5 },
      consent: { sms: true, whatsapp: true, marketing: true },
      groundTruth: { retrySuccessProbability: 0.40, paymentLinkSuccessProbability: 0.60 }
    },
    {
      id: 'pay_002',
      amountInPaise: 299900,
      failureClass: 'AUTHENTICATION_FAILED',
      errorCode: 'BAD_REQUEST_PAYMENT_OTP_INCORRECT',
      customerHistory: { totalPayments: 2, successfulPayments: 1 },
      consent: { sms: true, whatsapp: false, marketing: true },
      groundTruth: { retrySuccessProbability: 0.10, paymentLinkSuccessProbability: 0.80 }
    }
  ];

  const policyA: MerchantPolicyConfig = {
    max_retry_attempts: 1,
    cooling_window_hours: 6,
    max_auto_recovery_amount_paise: 1000000,
    require_consent_for_notifications: true,
    min_ai_confidence_threshold: 0.70,
    allowed_channels: ['EMAIL'],
    require_approval_for_fraud_suspicion: true
  };

  const policyB: MerchantPolicyConfig = {
    ...policyA,
    max_retry_attempts: 2
  };

  it('should simulate recovery without side effects or network calls', () => {
    const result = RecoveryTwinSimulator.simulate(sampleRecords, policyA);
    expect(result.totalCases).toBe(2);
    expect(result.interventionsScheduled).toBe(2);
    expect(result.recoveredCases).toBeGreaterThan(0);
    expect(result.recoveryRatePercent).toBeGreaterThan(0);
  });

  it('should compare baseline and proposed policies and output delta', () => {
    const comparison = RecoveryTwinSimulator.compare(sampleRecords, policyA, policyB);
    expect(comparison.baseline.totalCases).toBe(2);
    expect(comparison.proposed.totalCases).toBe(2);
    expect(comparison.delta).toBeDefined();
    expect(typeof comparison.delta.incrementalRecoveredPaise).toBe('number');
  });
});
