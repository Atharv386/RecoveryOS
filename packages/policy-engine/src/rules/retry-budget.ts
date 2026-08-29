import { PolicyEvaluationContext, RuleEvaluationResult } from '../types.js';

export function evaluateRetryBudgetRule(context: PolicyEvaluationContext): RuleEvaluationResult {
  const { currentAttemptCount, merchantConfig, diagnosis } = context;

  if (currentAttemptCount >= merchantConfig.max_retry_attempts) {
    if (diagnosis.recommended_action === 'DELAYED_RETRY') {
      return {
        ruleName: 'RetryBudgetRule',
        passed: false,
        reason: `Maximum retry budget exhausted (${currentAttemptCount}/${merchantConfig.max_retry_attempts}). Overriding DELAYED_RETRY to PAYMENT_LINK.`,
        suggestedOverride: {
          actionType: 'PAYMENT_LINK',
          delayMinutes: 0
        }
      };
    }
  }

  return {
    ruleName: 'RetryBudgetRule',
    passed: true,
    reason: `Retry budget healthy (${currentAttemptCount}/${merchantConfig.max_retry_attempts}).`
  };
}
