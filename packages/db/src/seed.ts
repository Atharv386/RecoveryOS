import { getDatabasePool } from './pool.js';
import { runMigrations } from './migrations.js';

export async function seedDatabase(): Promise<void> {
  const pool = getDatabasePool();
  console.log('🔄 Running migrations...');
  await runMigrations(pool);

  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database with realistic merchants, customers, payments, and recovery cases...');
    await client.query('BEGIN');

    // 1. Seed Merchants
    const merchantRes = await client.query(
      `INSERT INTO merchants (id, name, razorpay_account_id, webhook_secret, policy_config)
       VALUES 
       ('00000000-0000-0000-0000-000000000000', 'Acme Cloud SaaS', 'acc_acme_saas_001', 'sec_acme_webhook_123', '{
         "max_retry_attempts": 2,
         "cooling_window_hours": 6,
         "max_auto_recovery_amount_paise": 1000000,
         "require_consent_for_notifications": true,
         "min_ai_confidence_threshold": 0.70,
         "allowed_channels": ["EMAIL", "SMS"],
         "require_approval_for_fraud_suspicion": true
       }'::jsonb),
       ('11111111-1111-1111-1111-111111111111', 'Luxe D2C Fashion', 'acc_luxe_d2c_002', 'sec_luxe_webhook_456', '{
         "max_retry_attempts": 1,
         "cooling_window_hours": 12,
         "max_auto_recovery_amount_paise": 500000,
         "require_consent_for_notifications": true,
         "min_ai_confidence_threshold": 0.80,
         "allowed_channels": ["EMAIL", "SMS", "WHATSAPP"],
         "require_approval_for_fraud_suspicion": true
       }'::jsonb)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`
    );
    const merchantId = merchantRes.rows[0].id;

    // 2. Seed Users
    await client.query(
      `INSERT INTO users (id, merchant_id, email, password_hash, role)
       VALUES 
       ('22222222-2222-2222-2222-222222222222', $1, 'admin@acme.dev', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQmG6W65WvWk9', 'ADMIN'),
       ('33333333-3333-3333-3333-333333333333', $1, 'operator@acme.dev', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQmG6W65WvWk9', 'OPERATOR'),
       ('44444444-4444-4444-4444-444444444444', $1, 'viewer@acme.dev', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQmG6W65WvWk9', 'VIEWER')
       ON CONFLICT (email) DO NOTHING`,
      [merchantId]
    );

    // 3. Seed Customers
    const customerRes = await client.query(
      `INSERT INTO customers (merchant_id, razorpay_customer_id, email, contact, has_sms_consent, has_whatsapp_consent, has_marketing_consent)
       VALUES 
       ($1, 'cust_rzp_001', 'rohit.sharma@example.com', '+919876543210', true, true, true),
       ($1, 'cust_rzp_002', 'priya.patel@example.com', '+919876543211', true, false, true),
       ($1, 'cust_rzp_003', 'rahul.verma@example.com', '+919876543212', false, false, false),
       ($1, 'cust_rzp_004', 'ananya.iyer@example.com', '+919876543213', true, true, true)
       ON CONFLICT (merchant_id, razorpay_customer_id) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, razorpay_customer_id`,
      [merchantId]
    );

    const customers = customerRes.rows;

    // 4. Seed Payments & Recovery Cases Across Diverse States
    const failureScenarios = [
      {
        paymentId: 'pay_rzp_seed_001',
        amountInPaise: 149900,
        method: 'card',
        errorCode: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
        errorDesc: 'Customer account had insufficient balance',
        state: 'RECOVERED',
        failureClass: 'INSUFFICIENT_FUNDS',
        attemptCount: 1,
        recoveredAmount: 149900
      },
      {
        paymentId: 'pay_rzp_seed_002',
        amountInPaise: 299900,
        method: 'card',
        errorCode: 'BAD_REQUEST_PAYMENT_CARD_EXPIRED',
        errorDesc: 'Card is expired',
        state: 'ACTION_SCHEDULED',
        failureClass: 'EXPIRED_INSTRUMENT',
        attemptCount: 1,
        recoveredAmount: null
      },
      {
        paymentId: 'pay_rzp_seed_003',
        amountInPaise: 499900,
        method: 'upi',
        errorCode: 'BAD_REQUEST_PAYMENT_OTP_INCORRECT',
        errorDesc: 'UPI PIN incorrect',
        state: 'ACTION_EXECUTED',
        failureClass: 'AUTHENTICATION_FAILED',
        attemptCount: 1,
        recoveredAmount: null
      },
      {
        paymentId: 'pay_rzp_seed_004',
        amountInPaise: 1500000, // ₹15,000 (High value)
        method: 'netbanking',
        errorCode: 'GATEWAY_TIMEOUT',
        errorDesc: 'Bank gateway timed out during processing',
        state: 'AWAITING_APPROVAL',
        failureClass: 'NETWORK_TIMEOUT',
        attemptCount: 0,
        recoveredAmount: null
      },
      {
        paymentId: 'pay_rzp_seed_005',
        amountInPaise: 89900,
        method: 'card',
        errorCode: 'GATEWAY_TIMEOUT',
        errorDesc: 'Socket hangup during payment capture',
        state: 'OUTCOME_UNKNOWN',
        failureClass: 'NETWORK_TIMEOUT',
        attemptCount: 1,
        recoveredAmount: null
      },
      {
        paymentId: 'pay_rzp_seed_006',
        amountInPaise: 2500000,
        method: 'card',
        errorCode: 'BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD',
        errorDesc: 'High risk fraud pattern detected by issuing bank',
        state: 'ESCALATED',
        failureClass: 'SUSPECTED_FRAUD',
        attemptCount: 0,
        recoveredAmount: null
      }
    ];

    for (let i = 0; i < failureScenarios.length; i++) {
      const s = failureScenarios[i];
      const customer = customers[i % customers.length];

      // Insert Payment
      const payRes = await client.query(
        `INSERT INTO payments (
           merchant_id, customer_id, razorpay_payment_id, amount_in_paise,
           currency, method, status, error_code, error_description
         )
         VALUES ($1, $2, $3, $4, 'INR', $5, 'failed', $6, $7)
         ON CONFLICT (merchant_id, razorpay_payment_id) DO UPDATE SET status = EXCLUDED.status
         RETURNING id`,
        [merchantId, customer?.id || null, s.paymentId, s.amountInPaise, s.method, s.errorCode, s.errorDesc]
      );
      const paymentDbId = payRes.rows[0].id;

      // Insert Recovery Case
      const caseRes = await client.query(
        `INSERT INTO recovery_cases (
           merchant_id, payment_id, state, failure_class, attempt_count,
           max_attempts, recovered_amount_in_paise, recovered_at
         )
         VALUES ($1, $2, $3, $4, $5, 2, $6::bigint, CASE WHEN $6::bigint IS NOT NULL THEN NOW() ELSE NULL END)
         RETURNING id`,
        [merchantId, paymentDbId, s.state, s.failureClass, s.attemptCount, s.recoveredAmount]
      );
      const caseId = caseRes.rows[0].id;

      // Insert Diagnosis
      const diagRes = await client.query(
        `INSERT INTO diagnoses (
           case_id, is_fallback, model_name, input_hash, failure_class,
           confidence, reasoning, recommended_action, recommended_delay_minutes
         )
         VALUES ($1, false, 'gemini-2.5-flash', 'hash_seed_${i}', $2, 0.95, $3, 'DELAYED_RETRY', 360)
         RETURNING id`,
        [caseId, s.failureClass, s.errorDesc]
      );
      const diagId = diagRes.rows[0].id;

      // Insert Policy Decision
      const polRes = await client.query(
        `INSERT INTO policy_decisions (
           case_id, diagnosis_id, verdict, action_type, delay_minutes, rules_fired
         )
         VALUES ($1, $2, 'APPROVED', 'DELAYED_RETRY', 360, '[{"ruleName":"RetryBudgetRule","passed":true,"reason":"Budget healthy"},{"ruleName":"CoolingWindowRule","passed":true,"reason":"Enforced 6h"}]'::jsonb)
         RETURNING id`,
        [caseId, diagId]
      );
      const polId = polRes.rows[0].id;

      // Insert Intervention if scheduled/executed
      if (s.state === 'ACTION_EXECUTED' || s.state === 'RECOVERED' || s.state === 'OUTCOME_UNKNOWN') {
        await client.query(
          `INSERT INTO interventions (
             case_id, policy_decision_id, action_type, idempotency_key, status, razorpay_reference_id
           )
           VALUES ($1, $2, 'PAYMENT_LINK', 'idem_seed_${i}', 'SUCCESS', 'plink_seed_${i}')`,
          [caseId, polId]
        );
      }

      // Insert Audit Log
      await client.query(
        `INSERT INTO audit_logs (
           merchant_id, case_id, actor, action, from_state, to_state, metadata
         )
         VALUES ($1, $2, 'SEED_RUNNER', 'TRANSITION_${s.state}', 'DETECTED', $3, '{"seed":true}'::jsonb)`,
        [merchantId, caseId, s.state]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Database seeded successfully with realistic data!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Execute directly if run via tsx/node CLI
seedDatabase()
  .then(() => {
    console.log('Seeder completed.');
  })
  .catch((err) => {
    console.error('Seeder failed:', err);
  });
