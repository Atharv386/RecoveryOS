export interface DbMerchant {
  id: string;
  name: string;
  razorpay_account_id: string;
  webhook_secret: string;
  policy_config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DbPayment {
  id: string;
  merchant_id: string;
  customer_id: string | null;
  razorpay_payment_id: string;
  razorpay_order_id: string | null;
  amount_in_paise: number;
  currency: string;
  method: string;
  status: string;
  error_code: string | null;
  error_description: string | null;
  error_source: string | null;
  error_step: string | null;
  error_reason: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbRecoveryCase {
  id: string;
  merchant_id: string;
  payment_id: string;
  state: string;
  failure_class: string | null;
  attempt_count: number;
  max_attempts: number;
  next_action_at: Date | null;
  recovered_at: Date | null;
  recovered_amount_in_paise: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbAuditLog {
  id: string;
  merchant_id: string;
  case_id: string | null;
  actor: string;
  action: string;
  from_state: string | null;
  to_state: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}
