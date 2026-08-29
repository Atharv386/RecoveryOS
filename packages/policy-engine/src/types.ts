import { z } from 'zod';
import { DiagnosisOutput, RecommendedAction } from '@recoveryos/ai-diagnosis';

export const PolicyVerdictEnum = z.enum([
  'APPROVED',
  'DOWNGRADED',
  'REJECTED',
  'MANUAL_REVIEW_REQUIRED'
]);

export type PolicyVerdict = z.infer<typeof PolicyVerdictEnum>;

export const MerchantPolicyConfigSchema = z.object({
  max_retry_attempts: z.number().int().min(0).max(5).default(2),
  cooling_window_hours: z.number().int().min(1).max(72).default(6),
  max_auto_recovery_amount_paise: z.number().int().min(100).max(50000000).default(1000000), // ₹10,000 max
  require_consent_for_notifications: z.boolean().default(true),
  min_ai_confidence_threshold: z.number().min(0.1).max(1.0).default(0.70),
  allowed_channels: z.array(z.enum(['SMS', 'EMAIL', 'WHATSAPP'])).default(['EMAIL', 'SMS']),
  require_approval_for_fraud_suspicion: z.boolean().default(true)
});

export type MerchantPolicyConfig = z.infer<typeof MerchantPolicyConfigSchema>;

export interface PolicyEvaluationContext {
  merchantConfig: MerchantPolicyConfig;
  diagnosis: DiagnosisOutput;
  amountInPaise: number;
  currentAttemptCount: number;
  customerConsent: {
    sms: boolean;
    whatsapp: boolean;
    marketing: boolean;
  };
}

export interface RuleEvaluationResult {
  ruleName: string;
  passed: boolean;
  reason: string;
  suggestedOverride?: {
    actionType?: RecommendedAction;
    delayMinutes?: number;
    requireManualApproval?: boolean;
    rejectCase?: boolean;
  };
}

export interface PolicyDecision {
  verdict: PolicyVerdict;
  actionType: RecommendedAction;
  delayMinutes: number;
  requiresManualApproval: boolean;
  rulesFired: RuleEvaluationResult[];
}
