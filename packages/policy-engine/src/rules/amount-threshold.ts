import { PolicyEvaluationContext, RuleEvaluationResult } from '../types.js';

export function evaluateAmountThresholdRule(context: PolicyEvaluationContext): RuleEvaluationResult {
  const { amountInPaise, merchantConfig } = context;

  if (amountInPaise > merchantConfig.max_auto_recovery_amount_paise) {
    const formattedAmount = (amountInPaise / 100).toFixed(2);
    const formattedLimit = (merchantConfig.max_auto_recovery_amount_paise / 100).toFixed(2);

    return {
      ruleName: 'AmountThresholdRule',
      passed: false,
      reason: `Recovery amount (₹${formattedAmount}) exceeds merchant automatic recovery limit (₹${formattedLimit}). Escalating to manual operator approval.`,
      suggestedOverride: {
        requireManualApproval: true
      }
    };
  }

  return {
    ruleName: 'AmountThresholdRule',
    passed: true,
    reason: `Recovery amount (₹${(amountInPaise / 100).toFixed(2)}) is within automatic recovery limit.`
  };
}
