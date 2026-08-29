import crypto from 'crypto';
import { FailureContext } from './types.js';

export function buildSanitizedPrompt(context: FailureContext): { prompt: string; inputHash: string } {
  // Strip any accidental PII, take only derived features
  const sanitized = {
    amount: (context.amountInPaise / 100).toFixed(2),
    currency: context.currency,
    method: context.method,
    errorCode: context.errorCode ?? 'UNKNOWN',
    errorDescription: context.errorDescription ?? 'No description provided',
    errorSource: context.errorSource ?? 'gateway',
    errorStep: context.errorStep ?? 'payment_authorization',
    errorReason: context.errorReason ?? 'unspecified',
    attemptNumber: context.attemptNumber,
    customerReliabilityScore: context.customerHistory
      ? (context.customerHistory.successfulPayments / Math.max(context.customerHistory.totalPayments, 1)).toFixed(2)
      : 'unknown'
  };

  const payloadString = JSON.stringify(sanitized, null, 2);
  const inputHash = crypto.createHash('sha256').update(payloadString).digest('hex');

  const prompt = `You are the AI Diagnostic Engine of RecoveryOS, an automated revenue recovery system.
Analyze the following payment failure telemetry from Razorpay and classify the failure root cause, appropriate recovery action, delay, and confidence score.

Payment Failure Context:
${payloadString}

Instructions:
1. Classify failure_class into one of: 'INSUFFICIENT_FUNDS', 'NETWORK_TIMEOUT', 'AUTHENTICATION_FAILED', 'EXPIRED_INSTRUMENT', 'SUSPECTED_FRAUD', 'GATEWAY_ERROR', 'LIMIT_EXCEEDED', 'UNKNOWN_ERROR'.
2. Recommend an action: 'DELAYED_RETRY', 'PAYMENT_LINK', 'CUSTOMER_NOTIFICATION', 'NO_ACTION', 'MANUAL_ESCALATION'.
3. Set recommended_delay_minutes (e.g., 360 for insufficient funds, 0 for immediate retry if transient gateway glitch, 0 for link).
4. Provide a confidence score between 0.00 and 1.00.
5. Provide a concise explanation under 100 words in 'reasoning'.

Respond ONLY with a valid JSON object matching the requested schema.`;

  return { prompt, inputHash };
}
