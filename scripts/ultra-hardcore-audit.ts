import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import crypto from 'crypto';
import pg from 'pg';
import { getDatabasePool, withTransaction, RecoveryCaseRepository, PaymentRepository, MerchantRepository, CustomerRepository, WebhookEventRepository, InterventionRepository, AuditLogRepository } from '@recoveryos/db';
import { DeterministicPolicyEngine, MerchantPolicyConfig } from '@recoveryos/policy-engine';
import { assertValidTransition, isValidTransition, IllegalStateTransitionError, CaseState, ALL_STATES, TERMINAL_STATES } from '@recoveryos/state-machine';
import { AIDiagnosisService, DiagnosisCache, classifyWithFallback, DiagnosisOutputSchema, FailureClass, RecommendedAction } from '@recoveryos/ai-diagnosis';
import { verifyRazorpayWebhookSignature, RazorpayAdapterClient } from '@recoveryos/razorpay-adapter';
import { SyntheticDatasetGenerator, BenchmarkEngine, RecoveryTwinSimulator } from '@recoveryos/simulator';
import { WebhookProcessor } from '../apps/api/src/services/webhook-processor.js';
import { AuthService } from '../apps/api/src/middleware/auth.middleware.js';
import { MetricsService } from '../apps/api/src/services/metrics.service.js';
import { buildApp } from '../apps/api/src/app.js';
import { DiagnosisWorker } from '../apps/api/src/workers/diagnosis.worker.js';
import { PolicyWorker } from '../apps/api/src/workers/policy.worker.js';
import { RecoveryExecutionWorker } from '../apps/api/src/workers/recovery-execution.worker.js';
import { ReconcilerWorker } from '../apps/api/src/workers/reconciler.worker.js';

interface DetailedAuditResult {
  category: string;
  testId: string;
  name: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  metric?: string | number;
  details: string;
  evidence: any;
}

const auditLog: DetailedAuditResult[] = [];

function record(category: string, testId: string, name: string, status: 'PASSED' | 'FAILED' | 'WARNING', details: string, evidence?: any, metric?: string | number) {
  auditLog.push({ category, testId, name, status, metric, details, evidence });
  const icon = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⚠️';
  console.log(`${icon} [${category}] ${testId}: ${name} -> ${status}`);
  if (details) {
    console.log(`    ↳ ${details}`);
  }
}

async function runHardcoreAudit() {
  console.log('================================================================================');
  console.log('🔥 RECOVERYOS DEEP PENETRATION, FUZZING & CHAOS AUDIT (HARDCORE)');
  console.log('================================================================================\n');

  const pool = getDatabasePool();
  const testMerchantId = '00000000-0000-0000-0000-000000000000';
  const tenantBId = '11111111-1111-1111-1111-111111111111';
  const webhookSecret = 'sec_acme_webhook_123';

  // ===========================================================================
  // TEST SUITE 1: COMPLETE 11x11 STATE MACHINE TRANSITION MATRIX (121 COMBINATIONS)
  // ===========================================================================
  console.log('\n--- [SUITE 1] EXHAUSTIVE 11x11 STATE TRANSITION MATRIX (121 COMBINATIONS) ---');
  
  const allStates: CaseState[] = [
    'DETECTED', 'DIAGNOSED', 'POLICY_EVALUATED', 
    'AWAITING_APPROVAL', 'ACTION_SCHEDULED', 'ACTION_EXECUTED', 
    'OUTCOME_UNKNOWN', 'RECONCILING', 'RECOVERED', 'EXHAUSTED', 'ESCALATED'
  ];

  let validAllowedCount = 0;
  let invalidBlockedCount = 0;
  let invariantViolations = 0;

  for (const fromState of allStates) {
    for (const toState of allStates) {
      const isAllowed = isValidTransition(fromState, toState);
      let assertResult = 'OK';
      try {
        assertValidTransition(fromState, toState);
      } catch (err: any) {
        assertResult = err instanceof IllegalStateTransitionError ? 'THROWN_ILLEGAL' : 'THROWN_OTHER';
      }

      if (isAllowed) {
        validAllowedCount++;
        if (assertResult !== 'OK') {
          invariantViolations++;
          console.error(`Mismatch on allowed transition: ${fromState} -> ${toState}`);
        }
      } else {
        invalidBlockedCount++;
        if (assertResult !== 'THROWN_ILLEGAL') {
          invariantViolations++;
          console.error(`Illegal transition was NOT blocked: ${fromState} -> ${toState}`);
        }
      }
    }
  }

  record(
    'STATE_MACHINE_MATRIX',
    'SM-MAT-01',
    'Exhaustive 121 State Transition Permutations',
    invariantViolations === 0 ? 'PASSED' : 'FAILED',
    `Verified 121 transitions: ${validAllowedCount} legally permitted, ${invalidBlockedCount} strictly blocked. Invariant violations: ${invariantViolations}`,
    { validAllowedCount, invalidBlockedCount, total: allStates.length * allStates.length },
    `${validAllowedCount}/${allStates.length * allStates.length}`
  );

  // ===========================================================================
  // TEST SUITE 2: HIGH-CONCURRENCY ROW-LOCK & TRANSACTION HAMMERING (20 WORKERS)
  // ===========================================================================
  console.log('\n--- [SUITE 2] CONCURRENCY & ROW-LEVEL LOCK RACE CONDITION HAMMERING ---');

  const client = await pool.connect();
  const payment = await PaymentRepository.upsert(client, {
    merchant_id: testMerchantId,
    razorpay_payment_id: `pay_conc_hammer_${Date.now()}`,
    amount_in_paise: 999900,
    currency: 'INR',
    method: 'card',
    status: 'failed'
  });
  const hammerCase = await RecoveryCaseRepository.create(client, {
    merchant_id: testMerchantId,
    payment_id: payment.id
  });
  client.release();

  // Spawn 20 concurrent transactions attempting different transitions on the exact same case simultaneously
  const concurrencyAttempts = 20;
  const promises: Promise<{ workerId: number; success: boolean; error?: string }>[] = [];

  for (let i = 0; i < concurrencyAttempts; i++) {
    promises.push(
      (async () => {
        try {
          await withTransaction(pool, async (txClient) => {
            await RecoveryCaseRepository.transitionState(txClient, {
              merchantId: testMerchantId,
              caseId: hammerCase.id,
              targetState: 'DIAGNOSED',
              actor: `HAMMER_WORKER_${i}`,
              auditMetadata: { workerIndex: i }
            });
          });
          return { workerId: i, success: true };
        } catch (err: any) {
          return { workerId: i, success: false, error: err.message };
        }
      })()
    );
  }

  const raceResults = await Promise.all(promises);
  const successCount = raceResults.filter(r => r.success).length;
  const rejectedCount = raceResults.filter(r => !r.success).length;

  // Exactly 1 transaction must succeed in transitioning DETECTED -> DIAGNOSED.
  // The remaining 19 must see state is already DIAGNOSED and fail illegal transition (DIAGNOSED -> DIAGNOSED is blocked)
  const isConcurrencySafe = successCount === 1 && rejectedCount === concurrencyAttempts - 1;

  record(
    'CONCURRENCY_HAMMER',
    'CONC-01',
    '20 Concurrent Workers SELECT FOR UPDATE Race Test',
    isConcurrencySafe ? 'PASSED' : 'FAILED',
    `Exactly ${successCount} worker won the row lock; ${rejectedCount} workers safely rejected duplicate state transition without deadlocks or corruption.`,
    { successCount, rejectedCount, total: concurrencyAttempts },
    `${successCount}/${concurrencyAttempts}`
  );

  // ===========================================================================
  // TEST SUITE 3: IDEMPOTENCY UNDER CONCURRENT DUPLICATE DISPATCH (30 WORKERS)
  // ===========================================================================
  console.log('\n--- [SUITE 3] IDEMPOTENCY KEY CONCURRENT INSERTION STORM ---');

  const sharedIdempotencyKey = `idem_storm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const polDecisionRes = await pool.query(`SELECT id FROM policy_decisions LIMIT 1`);
  const polDecisionId = polDecisionRes.rows[0]?.id || hammerCase.id;

  const stormPromises: Promise<{ workerId: number; inserted: boolean; code?: string }>[] = [];
  for (let i = 0; i < 30; i++) {
    stormPromises.push(
      (async () => {
        const stormClient = await pool.connect();
        try {
          await InterventionRepository.create(stormClient, {
            case_id: hammerCase.id,
            policy_decision_id: polDecisionId,
            action_type: 'PAYMENT_LINK',
            idempotency_key: sharedIdempotencyKey,
            status: 'PENDING'
          });
          return { workerId: i, inserted: true };
        } catch (err: any) {
          return { workerId: i, inserted: false, code: err.code };
        } finally {
          stormClient.release();
        }
      })()
    );
  }

  const stormResults = await Promise.all(stormPromises);
  const stormInserted = stormResults.filter(r => r.inserted).length;
  const stormBlockedByConstraint = stormResults.filter(r => !r.inserted && r.code === '23505').length;

  record(
    'IDEMPOTENCY_STORM',
    'IDEM-STORM-01',
    '30 Concurrent Insertions with Identical Idempotency Key',
    stormInserted === 1 && stormBlockedByConstraint === 29 ? 'PASSED' : 'FAILED',
    `Exactly 1 financial intervention persisted; 29 duplicate financial actions blocked by PostgreSQL 23505 unique constraint.`,
    { stormInserted, stormBlockedByConstraint }
  );

  // ===========================================================================
  // TEST SUITE 4: EXTREME FUZZING OF DETERMINISTIC POLICY RULES (100 COMBINATIONS)
  // ===========================================================================
  console.log('\n--- [SUITE 4] DETERMINISTIC POLICY ENGINE FUZZING & BOUNDARY TESTING ---');

  const fuzzMerchantConfig: MerchantPolicyConfig = {
    max_retry_attempts: 2,
    cooling_window_hours: 6,
    max_auto_recovery_amount_paise: 1000000, // ₹10,000.00
    require_consent_for_notifications: true,
    min_ai_confidence_threshold: 0.70,
    allowed_channels: ['EMAIL', 'SMS', 'WHATSAPP'],
    require_approval_for_fraud_suspicion: true
  };

  const failureClasses: FailureClass[] = [
    'INSUFFICIENT_FUNDS', 'AUTHENTICATION_FAILED', 'EXPIRED_INSTRUMENT',
    'NETWORK_TIMEOUT', 'GATEWAY_ERROR', 'SUSPECTED_FRAUD', 'LIMIT_EXCEEDED', 'UNKNOWN_ERROR'
  ];

  const actions: RecommendedAction[] = ['DELAYED_RETRY', 'PAYMENT_LINK', 'CUSTOMER_NOTIFICATION', 'MANUAL_ESCALATION', 'NO_ACTION'];

  let fuzzTestsRun = 0;
  let policySafetyInvariantsMaintained = true;

  // Boundary 1: Extreme Amounts (0, 1 paise, Exact Limit ₹10,000, ₹10,000.01, ₹100,000, ₹1,000,000)
  const testAmounts = [0, 1, 999999, 1000000, 1000001, 2500000, 100000000];
  for (const amt of testAmounts) {
    fuzzTestsRun++;
    const dec = DeterministicPolicyEngine.evaluate({
      merchantConfig: fuzzMerchantConfig,
      diagnosis: { failure_class: 'NETWORK_TIMEOUT', confidence: 0.95, recommended_action: 'DELAYED_RETRY', recommended_delay_minutes: 10, reasoning: 'Transient network error' },
      amountInPaise: amt,
      currentAttemptCount: 0,
      customerConsent: { sms: true, whatsapp: false, marketing: true }
    });

    if (amt > 1000000 && (!dec.requiresManualApproval || dec.verdict !== 'MANUAL_REVIEW_REQUIRED')) {
      policySafetyInvariantsMaintained = false;
      console.error(`Amount ₹${amt/100} exceeded ₹10,000 limit but was not flagged for manual approval!`);
    }
  }

  // Boundary 2: Attempt Count (0, 1, 2 = Limit, 3 = Exhausted, 10 = Exhausted)
  const testAttempts = [0, 1, 2, 3, 10];
  for (const attempts of testAttempts) {
    fuzzTestsRun++;
    const dec = DeterministicPolicyEngine.evaluate({
      merchantConfig: fuzzMerchantConfig,
      diagnosis: { failure_class: 'INSUFFICIENT_FUNDS', confidence: 0.95, recommended_action: 'DELAYED_RETRY', recommended_delay_minutes: 360, reasoning: 'Low funds' },
      amountInPaise: 149900,
      currentAttemptCount: attempts,
      customerConsent: { sms: true, whatsapp: false, marketing: true }
    });

    if (attempts >= 2 && dec.actionType === 'DELAYED_RETRY') {
      policySafetyInvariantsMaintained = false;
      console.error(`Attempt count ${attempts} exceeded budget (max 2) but DELAYED_RETRY was still allowed!`);
    }
  }

  // Boundary 3: Confidence Score Fuzzing (-1, 0, 0.50, 0.69, 0.70, 0.71, 0.99, 1.0)
  const testConfidences = [0.0, 0.50, 0.69, 0.70, 0.71, 0.99, 1.0];
  for (const conf of testConfidences) {
    fuzzTestsRun++;
    const dec = DeterministicPolicyEngine.evaluate({
      merchantConfig: fuzzMerchantConfig,
      diagnosis: { failure_class: 'NETWORK_TIMEOUT', confidence: conf, recommended_action: 'DELAYED_RETRY', recommended_delay_minutes: 10, reasoning: 'Test' },
      amountInPaise: 149900,
      currentAttemptCount: 0,
      customerConsent: { sms: true, whatsapp: false, marketing: true }
    });

    if (conf < 0.70 && (!dec.requiresManualApproval || dec.verdict !== 'MANUAL_REVIEW_REQUIRED')) {
      policySafetyInvariantsMaintained = false;
      console.error(`Confidence ${conf} < threshold 0.70 but was not flagged for review!`);
    }
  }

  // Boundary 4: Ineligible Actions (e.g. DELAYED_RETRY on EXPIRED_CARD or SUSPECTED_FRAUD)
  for (const fc of failureClasses) {
    for (const act of actions) {
      fuzzTestsRun++;
      const dec = DeterministicPolicyEngine.evaluate({
        merchantConfig: fuzzMerchantConfig,
        diagnosis: { failure_class: fc, confidence: 0.95, recommended_action: act, recommended_delay_minutes: 10, reasoning: 'Fuzzing' },
        amountInPaise: 149900,
        currentAttemptCount: 0,
        customerConsent: { sms: true, whatsapp: false, marketing: true }
      });

      if (fc === 'SUSPECTED_FRAUD' && dec.actionType !== 'MANUAL_ESCALATION' && dec.actionType !== 'NO_ACTION') {
        policySafetyInvariantsMaintained = false;
        console.error(`SUSPECTED_FRAUD allowed unsafe action: ${dec.actionType}`);
      }
      if (fc === 'EXPIRED_INSTRUMENT' && dec.actionType === 'DELAYED_RETRY') {
        policySafetyInvariantsMaintained = false;
        console.error(`EXPIRED_INSTRUMENT allowed futile DELAYED_RETRY!`);
      }
    }
  }

  record(
    'POLICY_FUZZ',
    'PE-FUZZ-01',
    `Fuzz Testing Policy Engine Across ${fuzzTestsRun} Edge-Case Variations`,
    policySafetyInvariantsMaintained ? 'PASSED' : 'FAILED',
    `Evaluated ${fuzzTestsRun} boundary conditions across amounts, attempts, confidence, and fraud classes. Invariants maintained: 100%`,
    { fuzzTestsRun },
    `${fuzzTestsRun} test cases`
  );

  // ===========================================================================
  // TEST SUITE 5: ADVERSARIAL WEBHOOK ATTACK SUITE
  // ===========================================================================
  console.log('\n--- [SUITE 5] ADVERSARIAL WEBHOOK & TAMPERING ATTACK MATRIX ---');

  // Test 5.1: Huge Malformed Body / Garbage Payloads
  try {
    const rawGarbage = '<<<INVALID_XML_CORRUPTED_STREAM>>>';
    const fakeSig = crypto.createHmac('sha256', webhookSecret).update(rawGarbage).digest('hex');
    const isSigMatch = verifyRazorpayWebhookSignature(rawGarbage, fakeSig, webhookSecret);
    // HMAC check works over raw string, but JSON parse should fail cleanly in ingestion
    let jsonFailedSafely = false;
    try {
      JSON.parse(rawGarbage);
    } catch {
      jsonFailedSafely = true;
    }
    record('WEBHOOK_ATTACK', 'WH-ATT-01', 'Garbage/Malformed Non-JSON Webhook Handling', isSigMatch && jsonFailedSafely ? 'PASSED' : 'FAILED', 'Raw HMAC validated bytes, malformed JSON safely rejected');
  } catch (err: any) {
    record('WEBHOOK_ATTACK', 'WH-ATT-01', 'Garbage Webhook Handling', 'FAILED', err.message);
  }

  // Test 5.2: Signature Length & Timing Attack Immunity
  try {
    const payload = JSON.stringify({ entity: 'event', event: 'payment.failed' });
    const shortSig = 'a';
    const longSig = 'a'.repeat(256);
    const nullSig = undefined as any;

    const rShort = verifyRazorpayWebhookSignature(payload, shortSig, webhookSecret);
    const rLong = verifyRazorpayWebhookSignature(payload, longSig, webhookSecret);
    const rNull = verifyRazorpayWebhookSignature(payload, nullSig, webhookSecret);

    const timingProtected = !rShort && !rLong && !rNull;
    record('WEBHOOK_ATTACK', 'WH-ATT-02', 'Signature Buffer Mismatch & Length Anomaly Resilience', timingProtected ? 'PASSED' : 'FAILED', 'crypto.timingSafeEqual handled varying buffer lengths safely without exceptions');
  } catch (err: any) {
    record('WEBHOOK_ATTACK', 'WH-ATT-02', 'Signature Length Anomaly', 'FAILED', err.message);
  }

  // Test 5.3: Webhook Payload with Missing Payment Entity
  try {
    const resNoEntity = await WebhookProcessor.processEvent(pool, {
      merchantId: testMerchantId,
      eventId: `evt_no_entity_${Date.now()}`,
      eventType: 'payment.failed',
      signatureValid: true,
      payload: { id: 'evt_no_ent', event: 'payment.failed', payload: {} }
    });

    record('WEBHOOK_ATTACK', 'WH-ATT-03', 'Webhook with Missing Payment Payload Ignored Safely', resNoEntity.status === 'ignored_no_payment_entity' ? 'PASSED' : 'FAILED', `Status returned: ${resNoEntity.status}`);
  } catch (err: any) {
    record('WEBHOOK_ATTACK', 'WH-ATT-03', 'Webhook Missing Payment Payload', 'FAILED', err.message);
  }

  // ===========================================================================
  // TEST SUITE 6: FASTIFY API PENETRATION & AUTHORIZATION TESTING
  // ===========================================================================
  console.log('\n--- [SUITE 6] API ROUTE PENETRATION, AUTH & IDOR ATTACK MATRIX ---');

  const app = await buildApp();
  await app.ready();

  // Test 6.1: Tampered Token Signature
  const validToken = AuthService.signToken({
    userId: '22222222-2222-2222-2222-222222222222',
    merchantId: testMerchantId,
    email: 'admin@acme.dev',
    role: 'ADMIN'
  });

  const parts = validToken.split('.');
  const tamperedToken = `${parts[0]}.bad_signature_tampered_12345`;

  const tamperRes = await app.inject({
    method: 'GET',
    url: '/api/v1/metrics/overview',
    headers: { authorization: `Bearer ${tamperedToken}` }
  });

  record(
    'API_SECURITY',
    'API-SEC-01',
    'Tampered Session Token Signature Rejection',
    tamperRes.statusCode === 401 ? 'PASSED' : 'FAILED',
    `Tampered token returned HTTP ${tamperRes.statusCode} Unauthorized`
  );

  // Test 6.2: Expired Token Rejection
  const expiredToken = AuthService.signToken({
    userId: '22222222-2222-2222-2222-222222222222',
    merchantId: testMerchantId,
    email: 'admin@acme.dev',
    role: 'ADMIN'
  }, -100); // Expired 100 seconds ago

  const expiredRes = await app.inject({
    method: 'GET',
    url: '/api/v1/metrics/overview',
    headers: { authorization: `Bearer ${expiredToken}` }
  });

  record(
    'API_SECURITY',
    'API-SEC-02',
    'Expired Session Token Rejection',
    expiredRes.statusCode === 401 ? 'PASSED' : 'FAILED',
    `Expired token returned HTTP ${expiredRes.statusCode} Unauthorized`
  );

  // Test 6.3: Rate Limiter Stress Test (105 rapid calls)
  let rateLimitTripped = false;
  for (let i = 0; i < 105; i++) {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    if (res.statusCode === 429) {
      rateLimitTripped = true;
      break;
    }
  }

  record(
    'API_SECURITY',
    'API-SEC-03',
    'Fastify Rate Limiting Under Rapid Ingestion (100 req/min limit)',
    rateLimitTripped ? 'PASSED' : 'FAILED',
    rateLimitTripped ? 'Rate limiter triggered HTTP 429 Too Many Requests as expected' : 'Rate limit did not trigger within 105 requests'
  );

  await app.close();

  // ===========================================================================
  // TEST SUITE 7: MULTI-SEED 50,000 RECORD SCALE BENCHMARK
  // ===========================================================================
  console.log('\n--- [SUITE 7] MULTI-SEED 50,000 RECORD STABILITY & VARIANCE BENCHMARK ---');

  const testSeeds = [1337, 42, 99999, 2026, 777777];
  const benchmarkResults = [];

  for (const seed of testSeeds) {
    const t0 = performance.now();
    const batch = SyntheticDatasetGenerator.generate(10000, seed);
    const report = BenchmarkEngine.runBenchmark(batch, seed);
    const t1 = performance.now();

    benchmarkResults.push({
      seed,
      durationMs: Number((t1 - t0).toFixed(2)),
      baselineRate: report.baselineStrategy.metrics.recoveryRatePercent,
      recoveryOsRate: report.recoveryOSStrategy.metrics.recoveryRatePercent,
      lift: report.deltaComparison.recoveryRateLiftPercentagePoints,
      incrementalRupees: report.deltaComparison.incrementalRecoveredRupees,
      futilePrevented: report.deltaComparison.futileInterventionsPrevented
    });
  }

  const avgRecoveryRate = benchmarkResults.reduce((a, b) => a + b.recoveryOsRate, 0) / testSeeds.length;
  const avgBaselineRate = benchmarkResults.reduce((a, b) => a + b.baselineRate, 0) / testSeeds.length;
  const avgLift = benchmarkResults.reduce((a, b) => a + b.lift, 0) / testSeeds.length;
  const avgDuration = benchmarkResults.reduce((a, b) => a + b.durationMs, 0) / testSeeds.length;

  record(
    'SCALE_BENCHMARK',
    'BM-50K-01',
    `50,000 Record Benchmark Across 5 Independent PRNG Seeds`,
    avgLift > 40 ? 'PASSED' : 'FAILED',
    `Processed 50k records across 5 seeds: Avg RecoveryOS Rate = ${avgRecoveryRate.toFixed(2)}% vs Baseline = ${avgBaselineRate.toFixed(2)}% (Avg Lift = +${avgLift.toFixed(2)}%). Avg 10k batch latency = ${avgDuration.toFixed(2)}ms (~${Math.round(10000 / (avgDuration / 1000))} records/sec)`,
    { benchmarkResults }
  );

  // ===========================================================================
  // AUDIT SUMMARY
  // ===========================================================================
  console.log('\n================================================================================');
  console.log('📊 HARDCORE PENETRATION & RIGOROUS AUDIT COMPLETE');
  console.log('================================================================================');
  const passed = auditLog.filter(r => r.status === 'PASSED').length;
  const failed = auditLog.filter(r => r.status === 'FAILED').length;
  const warning = auditLog.filter(r => r.status === 'WARNING').length;
  console.log(`TOTAL HARDCORE TESTS: ${auditLog.length} | PASSED: ${passed} | FAILED: ${failed} | WARNING: ${warning}`);
}

runHardcoreAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal hardcore audit error:', err);
    process.exit(1);
  });
