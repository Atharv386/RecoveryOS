# RecoveryOS — Domain Model & Data Contracts Specification

## 1. Relational Database Schema (PostgreSQL)

All database entities are strongly typed, enforce tenant isolation via `merchant_id`, and record audit timestamps.

```sql
-- 1. Merchants & Tenant Configuration
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    razorpay_account_id VARCHAR(100) NOT NULL UNIQUE,
    webhook_secret VARCHAR(255) NOT NULL,
    policy_config JSONB NOT NULL DEFAULT '{
        "max_retry_attempts": 2,
        "cooling_window_hours": 6,
        "max_auto_recovery_amount": 1000000,
        "require_consent_for_notifications": true,
        "min_ai_confidence_threshold": 0.70
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users (Merchants and Operators)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    razorpay_customer_id VARCHAR(100),
    email VARCHAR(255),
    contact VARCHAR(50),
    has_marketing_consent BOOLEAN NOT NULL DEFAULT true,
    has_sms_consent BOOLEAN NOT NULL DEFAULT true,
    has_whatsapp_consent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_merchant_customer UNIQUE (merchant_id, razorpay_customer_id)
);

-- 4. Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    razorpay_payment_id VARCHAR(100) NOT NULL,
    razorpay_order_id VARCHAR(100),
    amount_in_paise BIGINT NOT NULL, -- Integer in paise (INR)
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    method VARCHAR(50) NOT NULL, -- 'card', 'upi', 'netbanking', 'emandate'
    status VARCHAR(50) NOT NULL, -- 'failed', 'captured', 'authorized', 'refunded'
    error_code VARCHAR(100),
    error_description TEXT,
    error_source VARCHAR(100),
    error_step VARCHAR(100),
    error_reason VARCHAR(100),
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_merchant_payment UNIQUE (merchant_id, razorpay_payment_id)
);

-- 5. Webhook Events (Append-only & Deduplicated)
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    razorpay_event_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- 'payment.failed', 'payment.captured', etc.
    signature_valid BOOLEAN NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_merchant_event UNIQUE (merchant_id, razorpay_event_id)
);

-- 6. Recovery Cases (Authoritative State Record)
CREATE TABLE recovery_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    state VARCHAR(50) NOT NULL CHECK (state IN (
        'DETECTED', 'DIAGNOSED', 'POLICY_EVALUATED', 
        'AWAITING_APPROVAL', 'ACTION_SCHEDULED', 'ACTION_EXECUTED', 
        'OUTCOME_UNKNOWN', 'RECONCILING', 'RECOVERED', 'EXHAUSTED', 'ESCALATED'
    )),
    failure_class VARCHAR(100), -- 'INSUFFICIENT_FUNDS', 'NETWORK_TIMEOUT', 'AUTH_FAILURE', 'EXPIRED_INSTRUMENT', 'SUSPECTED_FRAUD'
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 2,
    next_action_at TIMESTAMPTZ,
    recovered_at TIMESTAMPTZ,
    recovered_amount_in_paise BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. AI / Fallback Diagnoses (Immutable)
CREATE TABLE diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
    is_fallback BOOLEAN NOT NULL DEFAULT false,
    model_name VARCHAR(100),
    input_hash VARCHAR(64) NOT NULL, -- SHA256 of sanitized prompt input
    failure_class VARCHAR(100) NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0.000 AND confidence <= 1.000),
    reasoning TEXT NOT NULL,
    recommended_action VARCHAR(100) NOT NULL, -- 'DELAYED_RETRY', 'PAYMENT_LINK', 'NOTIFY_CUSTOMER', 'NO_ACTION'
    recommended_delay_minutes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Policy Decisions (Deterministic Trace)
CREATE TABLE policy_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
    diagnosis_id UUID NOT NULL REFERENCES diagnoses(id),
    verdict VARCHAR(50) NOT NULL CHECK (verdict IN ('APPROVED', 'DOWNGRADED', 'REJECTED', 'MANUAL_REVIEW_REQUIRED')),
    action_type VARCHAR(100) NOT NULL,
    delay_minutes INT NOT NULL,
    rules_fired JSONB NOT NULL, -- Array of { ruleName, status, reason }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Interventions (Bounded Action Log)
CREATE TABLE interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
    policy_decision_id UUID NOT NULL REFERENCES policy_decisions(id),
    action_type VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'SUCCESS', 'FAILED', 'TIMEOUT')),
    razorpay_reference_id VARCHAR(100),
    error_message TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Operator Approvals (Manual Review Gate)
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    decision VARCHAR(50) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Immutable Audit Log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    case_id UUID REFERENCES recovery_cases(id) ON DELETE SET NULL,
    actor VARCHAR(100) NOT NULL, -- 'SYSTEM_WEBHOOK', 'AI_WORKER', 'POLICY_ENGINE', 'RECONCILER', 'USER:<id>'
    action VARCHAR(100) NOT NULL,
    from_state VARCHAR(50),
    to_state VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & query speed
CREATE INDEX idx_recovery_cases_merchant_state ON recovery_cases(merchant_id, state);
CREATE INDEX idx_recovery_cases_next_action ON recovery_cases(state, next_action_at);
CREATE INDEX idx_payments_razorpay_id ON payments(razorpay_payment_id);
CREATE INDEX idx_webhook_events_dedup ON webhook_events(merchant_id, razorpay_event_id);
CREATE INDEX idx_audit_logs_case_id ON audit_logs(case_id);
```

---

## 2. Zod Runtime Schema Contracts

### 2.1 AI Structured Output Schema (`DiagnosisOutputSchema`)

```typescript
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

export const RecommendedActionEnum = z.enum([
  'DELAYED_RETRY',
  'PAYMENT_LINK',
  'CUSTOMER_NOTIFICATION',
  'NO_ACTION',
  'MANUAL_ESCALATION'
]);

export const DiagnosisOutputSchema = z.object({
  failure_class: FailureClassEnum,
  confidence: z.number().min(0.0).max(1.0),
  recommended_action: RecommendedActionEnum,
  recommended_delay_minutes: z.number().int().min(0).max(10080), // Max 7 days
  reasoning: z.string().min(5).max(500),
  metadata_signals: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
});

export type DiagnosisOutput = z.infer<typeof DiagnosisOutputSchema>;
```

### 2.2 Merchant Policy Configuration Schema

```typescript
export const MerchantPolicyConfigSchema = z.object({
  max_retry_attempts: z.number().int().min(0).max(5).default(2),
  cooling_window_hours: z.number().int().min(1).max(72).default(6),
  max_auto_recovery_amount_paise: z.number().int().min(100).max(50000000).default(1000000), // Default ₹10,000 max
  require_consent_for_notifications: z.boolean().default(true),
  min_ai_confidence_threshold: z.number().min(0.1).max(1.0).default(0.70),
  allowed_channels: z.array(z.enum(['SMS', 'EMAIL', 'WHATSAPP'])).default(['EMAIL', 'SMS']),
  require_approval_for_fraud_suspicion: z.boolean().default(true)
});

export type MerchantPolicyConfig = z.infer<typeof MerchantPolicyConfigSchema>;
```

### 2.3 Policy Evaluation Output Contract

```typescript
export const PolicyVerdictEnum = z.enum([
  'APPROVED',
  'DOWNGRADED',
  'REJECTED',
  'MANUAL_REVIEW_REQUIRED'
]);

export const RuleEvaluationResultSchema = z.object({
  rule_name: z.string(),
  passed: z.boolean(),
  reason: z.string(),
  suggested_override: z.object({
    action_type: RecommendedActionEnum.optional(),
    delay_minutes: z.number().int().optional()
  }).optional()
});

export const PolicyDecisionSchema = z.object({
  verdict: PolicyVerdictEnum,
  action_type: RecommendedActionEnum,
  delay_minutes: z.number().int().min(0),
  rules_fired: z.array(RuleEvaluationResultSchema),
  requires_manual_approval: z.boolean()
});

export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
```
