import { z } from 'zod';

export const FailureClassEnum = z.enum([
  'INSUFFICIENT_FUNDS',
  'NETWORK_TIMEOUT',
  'AUTHENTICATION_FAILED',
  'EXPIRED_INSTRUMENT',
  'SUSPECTED_FRAUD',
  'GATEWAY_ERROR',
  'LIMIT_EXCEEDED',
  'UNKNOWN_ERROR'
]);

export type FailureClass = z.infer<typeof FailureClassEnum>;

export const RecommendedActionEnum = z.enum([
  'DELAYED_RETRY',
  'PAYMENT_LINK',
  'CUSTOMER_NOTIFICATION',
  'NO_ACTION',
  'MANUAL_ESCALATION'
]);

export type RecommendedAction = z.infer<typeof RecommendedActionEnum>;

export interface FailureContext {
  merchantId: string;
  paymentId: string;
  amountInPaise: number;
  currency: string;
  method: string;
  errorCode?: string;
  errorDescription?: string;
  errorSource?: string;
  errorStep?: string;
  errorReason?: string;
  attemptNumber: number;
  customerHistory?: {
    totalPayments: number;
    successfulPayments: number;
    lastPaymentStatus?: string;
  };
}
