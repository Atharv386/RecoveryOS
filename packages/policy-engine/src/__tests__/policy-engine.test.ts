import { describe, it, expect } from 'vitest';
import { DeterministicPolicyEngine, PolicyEvaluationContext, MerchantPolicyConfig } from '../index.js';

describe('Deterministic Policy Engine (6 Rules)', () => {
  const defaultConfig: MerchantPolicyConfig = {
    max_retry_attempts: 2,
    cooling_window_hours: 6,
    max_auto_recovery_amount_paise: 1000000, // ₹10,000
    require_consent_for_notifications: true,
    min_ai_confidence_threshold: 0.70,
    allowed_channels: ['EMAIL', 'SMS'],
    require_approval_for_fraud_suspicion: true
  };

  it('should approve safe diagnosis matching all policy rules', () => {
    const context: PolicyEvaluationContext = {
      merchantConfig: defaultConfig,
      diagnosis: {
        failure_class: 'INSUFFICIENT_FUNDS',
        confidence: 0.95,
        recommended_action: 'DELAYED_RETRY',
        recommended_delay_minutes: 360,
        reasoning: 'Card balance insufficient'
      },
      amountInPaise: 149900, // ₹1,499
      currentAttemptCount: 0,
      customerConsent: { sms: true, whatsapp: false, marketing: true }
    };

    const decision = DeterministicPolicyEngine.evaluate(context);
    expect(decision.verdict).toBe('APPROVED');
    expect(decision.actionType).toBe('DELAYED_RETRY');
    expect(decision.delayMinutes).toBe(360);
    expect(decision.requiresManualApproval).toBe(false);
    expect(decision.rulesFired.every(r => r.passed)).toBe(true);
  });

  it('should downgrade AI proposal if cooling window is breached (Failure Demo C)', () => {
    const context: PolicyEvaluationContext = {
      merchantConfig: defaultConfig,
      diagnosis: {
        failure_class: 'INSUFFICIENT_FUNDS',
        confidence: 0.90,
        recommended_action: 'DELAYED_RETRY',
        recommended_delay_minutes: 10, // Unsafe short delay
        reasoning: 'Retry immediately'
      },
      amountInPaise: 149900,
      currentAttemptCount: 0,
      customerConsent: { sms: true, whatsapp: false, marketing: true }
    };

    const decision = DeterministicPolicyEngine.evaluate(context);
    expect(decision.verdict).toBe('DOWNGRADED');
    expect(decision.delayMinutes).toBe(360); // Overridden to 6 hours
    expect(decision.rulesFired.find(r => r.ruleName === 'CoolingWindowRule')?.passed).toBe(false);
  });

  it('should enforce MANUAL_REVIEW_REQUIRED for high-value transactions', () => {
    const context: PolicyEvaluationContext = {
      merchantConfig: defaultConfig,
      diagnosis: {
        failure_class: 'NETWORK_TIMEOUT',
        confidence: 0.95,
        recommended_action: 'DELAYED_RETRY',
        recommended_delay_minutes: 5,
        reasoning: 'Gateway timeout'
      },
      amountInPaise: 5000000, // ₹50,000 (Exceeds ₹10,000 limit)
      currentAttemptCount: 0,
      customerConsent: { sms: true, whatsapp: false, marketing: true }
    };

    const decision = DeterministicPolicyEngine.evaluate(context);
    expect(decision.verdict).toBe('MANUAL_REVIEW_REQUIRED');
    expect(decision.requiresManualApproval).toBe(true);
    expect(decision.rulesFired.find(r => r.ruleName === 'AmountThresholdRule')?.passed).toBe(false);
  });

  it('should override retry to payment link when retry budget is exhausted', () => {
    const context: PolicyEvaluationContext = {
      merchantConfig: defaultConfig,
      diagnosis: {
        failure_class: 'INSUFFICIENT_FUNDS',
        confidence: 0.90,
        recommended_action: 'DELAYED_RETRY',
        recommended_delay_minutes: 360,
        reasoning: 'Retry again'
      },
      amountInPaise: 149900,
      currentAttemptCount: 2, // 2/2 attempts already made
      customerConsent: { sms: true, whatsapp: false, marketing: true }
    };

    const decision = DeterministicPolicyEngine.evaluate(context);
    expect(decision.verdict).toBe('DOWNGRADED');
    expect(decision.actionType).toBe('PAYMENT_LINK');
    expect(decision.rulesFired.find(r => r.ruleName === 'RetryBudgetRule')?.passed).toBe(false);
  });

  it('should block retries on expired cards and force PAYMENT_LINK', () => {
    const context: PolicyEvaluationContext = {
      merchantConfig: defaultConfig,
      diagnosis: {
        failure_class: 'EXPIRED_INSTRUMENT',
        confidence: 0.95,
        recommended_action: 'DELAYED_RETRY', // Ineligible action
        recommended_delay_minutes: 60,
        reasoning: 'Card expired'
      },
      amountInPaise: 149900,
      currentAttemptCount: 0,
      customerConsent: { sms: true, whatsapp: false, marketing: true }
    };

    const decision = DeterministicPolicyEngine.evaluate(context);
    expect(decision.verdict).toBe('DOWNGRADED');
    expect(decision.actionType).toBe('PAYMENT_LINK');
    expect(decision.rulesFired.find(r => r.ruleName === 'FailureClassEligibilityRule')?.passed).toBe(false);
  });

  it('should mandate approval on suspected fraud', () => {
    const context: PolicyEvaluationContext = {
      merchantConfig: defaultConfig,
      diagnosis: {
        failure_class: 'SUSPECTED_FRAUD',
        confidence: 0.85,
        recommended_action: 'NO_ACTION',
        recommended_delay_minutes: 0,
        reasoning: 'Fraud alert'
      },
      amountInPaise: 149900,
      currentAttemptCount: 0,
      customerConsent: { sms: true, whatsapp: false, marketing: true }
    };

    const decision = DeterministicPolicyEngine.evaluate(context);
    expect(decision.verdict).toBe('MANUAL_REVIEW_REQUIRED');
    expect(decision.requiresManualApproval).toBe(true);
    expect(decision.actionType).toBe('MANUAL_ESCALATION');
  });
});
