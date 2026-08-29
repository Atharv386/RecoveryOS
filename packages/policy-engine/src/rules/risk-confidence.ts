import { PolicyEvaluationContext, RuleEvaluationResult } from '../types.js';

export function evaluateRiskAndConfidenceRule(context: PolicyEvaluationContext): RuleEvaluationResult {
  const { diagnosis, merchantConfig } = context;

  // Check fraud suspicion first
  if (diagnosis.failure_class === 'SUSPECTED_FRAUD' && merchantConfig.require_approval_for_fraud_suspicion) {
    return {
      ruleName: 'RiskAndConfidenceRule',
      passed: false,
      reason: 'Suspected fraud detected. Policy mandates manual operator verification before any action.',
      suggestedOverride: {
        actionType: 'MANUAL_ESCALATION',
        requireManualApproval: true
      }
    };
  }

  // Check AI confidence threshold
  if (diagnosis.confidence < merchantConfig.min_ai_confidence_threshold) {
    return {
      ruleName: 'RiskAndConfidenceRule',
      passed: false,
      reason: `AI confidence (${diagnosis.confidence.toFixed(2)}) is below policy threshold (${merchantConfig.min_ai_confidence_threshold.toFixed(2)}). Escalating to manual operator review.`,
      suggestedOverride: {
        requireManualApproval: true
      }
    };
  }

  return {
    ruleName: 'RiskAndConfidenceRule',
    passed: true,
    reason: `Confidence (${diagnosis.confidence.toFixed(2)}) satisfies risk criteria.`
  };
}
