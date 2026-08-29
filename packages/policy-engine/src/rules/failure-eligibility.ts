import { PolicyEvaluationContext, RuleEvaluationResult } from '../types.js';
import { FailureClass, RecommendedAction } from '@recoveryos/ai-diagnosis';

const ELIGIBLE_ACTIONS_MAP: Record<FailureClass, ReadonlySet<RecommendedAction>> = {
  INSUFFICIENT_FUNDS: new Set<RecommendedAction>(['DELAYED_RETRY', 'PAYMENT_LINK', 'CUSTOMER_NOTIFICATION']),
  NETWORK_TIMEOUT: new Set<RecommendedAction>(['DELAYED_RETRY', 'PAYMENT_LINK']),
  GATEWAY_ERROR: new Set<RecommendedAction>(['DELAYED_RETRY', 'PAYMENT_LINK']),
  AUTHENTICATION_FAILED: new Set<RecommendedAction>(['PAYMENT_LINK', 'CUSTOMER_NOTIFICATION', 'NO_ACTION']),
  EXPIRED_INSTRUMENT: new Set<RecommendedAction>(['PAYMENT_LINK', 'CUSTOMER_NOTIFICATION', 'MANUAL_ESCALATION']),
  SUSPECTED_FRAUD: new Set<RecommendedAction>(['MANUAL_ESCALATION', 'NO_ACTION']),
  LIMIT_EXCEEDED: new Set<RecommendedAction>(['PAYMENT_LINK', 'CUSTOMER_NOTIFICATION', 'DELAYED_RETRY']),
  UNKNOWN_ERROR: new Set<RecommendedAction>(['PAYMENT_LINK', 'CUSTOMER_NOTIFICATION', 'MANUAL_ESCALATION'])
};

export function evaluateFailureEligibilityRule(context: PolicyEvaluationContext): RuleEvaluationResult {
  const { diagnosis } = context;
  const allowedSet = ELIGIBLE_ACTIONS_MAP[diagnosis.failure_class] ?? new Set<RecommendedAction>(['PAYMENT_LINK']);

  if (!allowedSet.has(diagnosis.recommended_action)) {
    // Determine safe fallback action based on failure class
    const safeFallback: RecommendedAction =
      diagnosis.failure_class === 'SUSPECTED_FRAUD' ? 'MANUAL_ESCALATION' : 'PAYMENT_LINK';

    return {
      ruleName: 'FailureClassEligibilityRule',
      passed: false,
      reason: `Action '${diagnosis.recommended_action}' is ineligible for failure class '${diagnosis.failure_class}'. Overriding to '${safeFallback}'.`,
      suggestedOverride: {
        actionType: safeFallback,
        delayMinutes: 0
      }
    };
  }

  return {
    ruleName: 'FailureClassEligibilityRule',
    passed: true,
    reason: `Action '${diagnosis.recommended_action}' is fully eligible for '${diagnosis.failure_class}'.`
  };
}
