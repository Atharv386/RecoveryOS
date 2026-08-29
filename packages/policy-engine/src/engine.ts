import { PolicyEvaluationContext, PolicyDecision, PolicyVerdict, RuleEvaluationResult } from './types.js';
import { evaluateRetryBudgetRule } from './rules/retry-budget.js';
import { evaluateCoolingWindowRule } from './rules/cooling-window.js';
import { evaluateAmountThresholdRule } from './rules/amount-threshold.js';
import { evaluateCustomerConsentRule } from './rules/customer-consent.js';
import { evaluateFailureEligibilityRule } from './rules/failure-eligibility.js';
import { evaluateRiskAndConfidenceRule } from './rules/risk-confidence.js';
import { RecommendedAction } from '@recoveryos/ai-diagnosis';

export class DeterministicPolicyEngine {
  public static evaluate(context: PolicyEvaluationContext): PolicyDecision {
    const rulesFired: RuleEvaluationResult[] = [];

    // Run all 6 rules deterministically
    rulesFired.push(evaluateRetryBudgetRule(context));
    rulesFired.push(evaluateCoolingWindowRule(context));
    rulesFired.push(evaluateAmountThresholdRule(context));
    rulesFired.push(evaluateCustomerConsentRule(context));
    rulesFired.push(evaluateFailureEligibilityRule(context));
    rulesFired.push(evaluateRiskAndConfidenceRule(context));

    let finalAction: RecommendedAction = context.diagnosis.recommended_action;
    let finalDelayMinutes: number = context.diagnosis.recommended_delay_minutes;
    let requiresApproval = false;
    let hasDowngrade = false;
    let hasRejection = false;

    // Aggregate rule overrides
    for (const res of rulesFired) {
      if (!res.passed && res.suggestedOverride) {
        if (res.suggestedOverride.actionType) {
          finalAction = res.suggestedOverride.actionType;
          hasDowngrade = true;
        }
        if (res.suggestedOverride.delayMinutes !== undefined) {
          finalDelayMinutes = res.suggestedOverride.delayMinutes;
          hasDowngrade = true;
        }
        if (res.suggestedOverride.requireManualApproval) {
          requiresApproval = true;
        }
        if (res.suggestedOverride.rejectCase) {
          hasRejection = true;
        }
      }
    }

    let verdict: PolicyVerdict = 'APPROVED';

    if (hasRejection) {
      verdict = 'REJECTED';
    } else if (requiresApproval) {
      verdict = 'MANUAL_REVIEW_REQUIRED';
    } else if (hasDowngrade) {
      verdict = 'DOWNGRADED';
    }

    return {
      verdict,
      actionType: finalAction,
      delayMinutes: finalDelayMinutes,
      requiresManualApproval: requiresApproval,
      rulesFired
    };
  }
}
