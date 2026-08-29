import pg from 'pg';

export const INITIAL_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    razorpay_account_id VARCHAR(100) NOT NULL UNIQUE,
    webhook_secret VARCHAR(255) NOT NULL,
    policy_config JSONB NOT NULL DEFAULT '{
        "max_retry_attempts": 2,
        "cooling_window_hours": 6,
        "max_auto_recovery_amount_paise": 1000000,
        "require_consent_for_notifications": true,
        "min_ai_confidence_threshold": 0.70
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
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

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    razorpay_payment_id VARCHAR(100) NOT NULL,
    razorpay_order_id VARCHAR(100),
    amount_in_paise BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
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

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    razorpay_event_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    signature_valid BOOLEAN NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_merchant_event UNIQUE (merchant_id, razorpay_event_id)
);

CREATE TABLE IF NOT EXISTS recovery_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    state VARCHAR(50) NOT NULL CHECK (state IN (
        'DETECTED', 'DIAGNOSED', 'POLICY_EVALUATED', 
        'AWAITING_APPROVAL', 'ACTION_SCHEDULED', 'ACTION_EXECUTED', 
        'OUTCOME_UNKNOWN', 'RECONCILING', 'RECOVERED', 'EXHAUSTED', 'ESCALATED'
    )),
    failure_class VARCHAR(100),
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 2,
    next_action_at TIMESTAMPTZ,
    recovered_at TIMESTAMPTZ,
    recovered_amount_in_paise BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
    is_fallback BOOLEAN NOT NULL DEFAULT false,
    model_name VARCHAR(100),
    input_hash VARCHAR(64) NOT NULL,
    failure_class VARCHAR(100) NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    reasoning TEXT NOT NULL,
    recommended_action VARCHAR(100) NOT NULL,
    recommended_delay_minutes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
    diagnosis_id UUID NOT NULL REFERENCES diagnoses(id),
    verdict VARCHAR(50) NOT NULL CHECK (verdict IN ('APPROVED', 'DOWNGRADED', 'REJECTED', 'MANUAL_REVIEW_REQUIRED')),
    action_type VARCHAR(100) NOT NULL,
    delay_minutes INT NOT NULL,
    rules_fired JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interventions (
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

CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    decision VARCHAR(50) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    case_id UUID REFERENCES recovery_cases(id) ON DELETE SET NULL,
    actor VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    from_state VARCHAR(50),
    to_state VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_cases_merchant_state ON recovery_cases(merchant_id, state);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_next_action ON recovery_cases(state, next_action_at);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_id ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_dedup ON webhook_events(merchant_id, razorpay_event_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_case_id ON audit_logs(case_id);
`;

export async function runMigrations(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(INITIAL_SCHEMA_SQL);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
