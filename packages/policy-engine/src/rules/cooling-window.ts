import { PolicyEvaluationContext, RuleEvaluationResult } from '../types.js';

export function evaluateCoolingWindowRule(context: PolicyEvaluationContext): RuleEvaluationResult {
  const { diagnosis, merchantConfig } = context;

  // Enforce cooling window for INSUFFICIENT_FUNDS or DELAYED_RETRY
  if (diagnosis.failure_class === 'INSUFFICIENT_FUNDS' && diagnosis.recommended_action === 'DELAYED_RETRY') {
    const minRequiredMinutes = merchantConfig.cooling_window_hours * 60;

    if (diagnosis.recommended_delay_minutes < minRequiredMinutes) {
      return {
        ruleName: 'CoolingWindowRule',
        passed: false,
        reason: `AI proposed delay of ${diagnosis.recommended_delay_minutes}m for INSUFFICIENT_FUNDS. Enforced policy minimum cooling window of ${minRequiredMinutes}m (${merchantConfig.cooling_window_hours}h).`,
        suggestedOverride: {
          delayMinutes: minRequiredMinutes
        }
      };
    }
  }

  return {
    ruleName: 'CoolingWindowRule',
    passed: true,
    reason: `Cooling window constraint satisfied (${diagnosis.recommended_delay_minutes}m).`
  };
}
