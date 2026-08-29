import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { buildApp } from '../apps/api/src/app.js';
import { AuthService } from '../apps/api/src/middleware/auth.middleware.js';
import { getDatabasePool } from '@recoveryos/db';

async function testApprovalsAndIdor() {
  console.log('--- TESTING APPROVALS & IDOR ---');
  const pool = getDatabasePool();
  const app = await buildApp();
  await app.ready();

  const merchantA = '00000000-0000-0000-0000-000000000000';
  const merchantB = '11111111-1111-1111-1111-111111111111';

  // Fetch a seeded user UUID from database
  const userRes = await pool.query(`SELECT id, merchant_id, role, email FROM users WHERE role = 'OPERATOR' LIMIT 1`);
  const realOperator = userRes.rows[0];

  // Token 1: Generated via demo-token endpoint (uses string 'user_operator_123')
  const demoToken = AuthService.signToken({
    userId: 'user_operator_123',
    merchantId: merchantA,
    email: 'demo_operator@acme.dev',
    role: 'OPERATOR'
  });

  // Token 2: Token with real PostgreSQL UUID
  const realUuidToken = AuthService.signToken({
    userId: realOperator.id,
    merchantId: realOperator.merchant_id,
    email: realOperator.email,
    role: 'OPERATOR'
  });

  // Find or create a case in AWAITING_APPROVAL state for merchant A
  const caseRes = await pool.query(
    `SELECT id FROM recovery_cases WHERE merchant_id = $1 AND state = 'AWAITING_APPROVAL' LIMIT 1`,
    [merchantA]
  );

  let awaitingCaseId = caseRes.rows[0]?.id;
  if (!awaitingCaseId) {
    // Create one
    const p = await pool.query(
      `INSERT INTO payments (merchant_id, razorpay_payment_id, amount_in_paise, currency, method, status)
       VALUES ($1, $2, 2500000, 'INR', 'card', 'failed') RETURNING id`,
      [merchantA, `pay_approval_test_${Date.now()}`]
    );
    const c = await pool.query(
      `INSERT INTO recovery_cases (merchant_id, payment_id, state)
       VALUES ($1, $2, 'AWAITING_APPROVAL') RETURNING id`,
      [merchantA, p.rows[0].id]
    );
    awaitingCaseId = c.rows[0].id;
  }

  console.log(`Testing Case ID: ${awaitingCaseId}`);

  // Test Approval with demo token (string userId)
  console.log('\n1. Testing POST /api/v1/cases/:id/approve with Demo Token (userId: "user_operator_123")...');
  const resDemo = await app.inject({
    method: 'POST',
    url: `/api/v1/cases/${awaitingCaseId}/approve`,
    headers: { authorization: `Bearer ${demoToken}` },
    payload: { notes: 'Approved via demo token' }
  });
  console.log(`Status: ${resDemo.statusCode}`);
  console.log(`Response: ${resDemo.payload}`);

  // Test Approval with Real UUID Token
  console.log('\n2. Testing POST /api/v1/cases/:id/approve with Real UUID Token...');
  const resReal = await app.inject({
    method: 'POST',
    url: `/api/v1/cases/${awaitingCaseId}/approve`,
    headers: { authorization: `Bearer ${realUuidToken}` },
    payload: { notes: 'Approved via real operator' }
  });
  console.log(`Status: ${resReal.statusCode}`);
  console.log(`Response: ${resReal.payload}`);

  // Test IDOR: Operator from Merchant B attempts to approve Merchant A's case
  const merchantBToken = AuthService.signToken({
    userId: realOperator.id,
    merchantId: merchantB,
    email: 'attacker@luxe.dev',
    role: 'OPERATOR'
  });

  console.log('\n3. Testing IDOR: Merchant B Operator approves Merchant A Case...');
  const resIdor = await app.inject({
    method: 'POST',
    url: `/api/v1/cases/${awaitingCaseId}/approve`,
    headers: { authorization: `Bearer ${merchantBToken}` },
    payload: { notes: 'IDOR attempt' }
  });
  console.log(`Status: ${resIdor.statusCode}`);
  console.log(`Response: ${resIdor.payload}`);

  await app.close();
  process.exit(0);
}

testApprovalsAndIdor().catch(console.error);
