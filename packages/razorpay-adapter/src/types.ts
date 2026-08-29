import { z } from 'zod';

export const RazorpayPaymentStatusEnum = z.enum([
  'created',
  'authorized',
  'captured',
  'refunded',
  'failed'
]);

export type RazorpayPaymentStatus = z.infer<typeof RazorpayPaymentStatusEnum>;

export interface RazorpayPaymentDetails {
  id: string;
  entity: 'payment';
  amount: number; // In paise
  currency: string;
  status: RazorpayPaymentStatus;
  order_id: string | null;
  method: string;
  error_code: string | null;
  error_description: string | null;
  error_source: string | null;
  error_step: string | null;
  error_reason: string | null;
  created_at: number;
}

export interface PaymentLinkResult {
  id: string;
  short_url: string;
  status: 'created' | 'partially_paid' | 'paid' | 'expired' | 'cancelled';
  amount: number;
}

export interface RazorpayWebhookPayload {
  entity: 'event';
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: RazorpayPaymentDetails;
    };
  };
  created_at: number;
}
