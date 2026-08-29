import { PolicyEvaluationContext, RuleEvaluationResult } from '../types.js';

export function evaluateCustomerConsentRule(context: PolicyEvaluationContext): RuleEvaluationResult {
  const { diagnosis, customerConsent, merchantConfig } = context;

  if (diagnosis.recommended_action === 'CUSTOMER_NOTIFICATION' && merchantConfig.require_consent_for_notifications) {
    const hasAnyConsent = customerConsent.sms || customerConsent.whatsapp || customerConsent.marketing;

    if (!hasAnyConsent) {
      return {
        ruleName: 'CustomerConsentRule',
        passed: false,
        reason: 'Customer has not provided messaging consent. Overriding action to safe email PAYMENT_LINK.',
        suggestedOverride: {
          actionType: 'PAYMENT_LINK',
          delayMinutes: 0
        }
      };
    }
  }

  return {
    ruleName: 'CustomerConsentRule',
    passed: true,
    reason: 'Customer communication consent verified.'
  };
}
