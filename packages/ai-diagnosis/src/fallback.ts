import { FailureContext, FailureClass, RecommendedAction } from './types.js';
import { DiagnosisOutput } from './schema.js';

interface ErrorCodeRule {
  failureClass: FailureClass;
  action: RecommendedAction;
  delayMinutes: number;
  reasoning: string;
}

const ERROR_CODE_MAP: Record<string, ErrorCodeRule> = {
  // Insufficient funds
  'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE': {
    failureClass: 'INSUFFICIENT_FUNDS',
    action: 'DELAYED_RETRY',
    delayMinutes: 360, // 6 hours cooling window
    reasoning: 'Deterministic fallback: Customer account has insufficient funds. Delayed retry scheduled after cooling window.'
  },
  'INSUFFICIENT_FUNDS': {
    failureClass: 'INSUFFICIENT_FUNDS',
    action: 'DELAYED_RETRY',
    delayMinutes: 360,
    reasoning: 'Deterministic fallback: Insufficient funds. Delayed retry scheduled.'
  },

  // Network & Gateway timeouts
  'GATEWAY_ERROR': {
    failureClass: 'GATEWAY_ERROR',
    action: 'DELAYED_RETRY',
    delayMinutes: 15,
    reasoning: 'Deterministic fallback: Upstream payment gateway error. Short retry scheduled.'
  },
  'GATEWAY_TIMEOUT': {
    failureClass: 'NETWORK_TIMEOUT',
    action: 'DELAYED_RETRY',
    delayMinutes: 10,
    reasoning: 'Deterministic fallback: Gateway network timeout. Retrying after brief pause.'
  },

  // Auth / 3DS / OTP failures
  'BAD_REQUEST_PAYMENT_OTP_INCORRECT': {
    failureClass: 'AUTHENTICATION_FAILED',
    action: 'PAYMENT_LINK',
    delayMinutes: 0,
    reasoning: 'Deterministic fallback: 3DS/OTP authentication failed. Sending payment link for customer checkout.'
  },
  'BAD_REQUEST_PAYMENT_DECLINED_BY_BANK': {
    failureClass: 'AUTHENTICATION_FAILED',
    action: 'PAYMENT_LINK',
    delayMinutes: 0,
    reasoning: 'Deterministic fallback: Card declined by issuing bank. Customer presence required.'
  },

  // Expired instruments
  'BAD_REQUEST_PAYMENT_CARD_EXPIRED': {
    failureClass: 'EXPIRED_INSTRUMENT',
    action: 'PAYMENT_LINK',
    delayMinutes: 0,
    reasoning: 'Deterministic fallback: Card is expired. Sending payment link to update payment method.'
  },

  // Suspected fraud / high risk
  'BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD': {
    failureClass: 'SUSPECTED_FRAUD',
    action: 'MANUAL_ESCALATION',
    delayMinutes: 0,
    reasoning: 'Deterministic fallback: Suspected fraud detected. Halting automated recovery for manual compliance review.'
  }
};

/**
 * Pure deterministic fallback classifier when AI is disabled or unreachable.
 */
export function classifyWithFallback(context: FailureContext): DiagnosisOutput {
  const code = (context.errorCode || '').toUpperCase();
  const rule = ERROR_CODE_MAP[code];

  if (rule) {
    return {
      failure_class: rule.failureClass,
      confidence: 1.0,
      recommended_action: rule.action,
      recommended_delay_minutes: rule.delayMinutes,
      reasoning: rule.reasoning
    };
  }

  // Generic fallback if unknown error code
  return {
    failure_class: 'UNKNOWN_ERROR',
    confidence: 0.5,
    recommended_action: 'PAYMENT_LINK',
    recommended_delay_minutes: 0,
    reasoning: `Deterministic fallback: Unmapped error code '${context.errorCode ?? 'N/A'}'. Emitting payment link as safe default.`
  };
}
