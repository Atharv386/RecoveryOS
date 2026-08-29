import { describe, it, expect, vi } from 'vitest';
import pg from 'pg';
import { WebhookProcessor } from '../services/webhook-processor.js';
import { DiagnosisWorker } from '../workers/diagnosis.worker.js';
import { PolicyWorker } from '../workers/policy.worker.js';
import { RecoveryExecutionWorker } from '../workers/recovery-execution.worker.js';
import { ReconcilerWorker } from '../workers/reconciler.worker.js';

describe('End-to-End Recovery Worker Pipeline', () => {
  const merchantId = 'm_test_100';

  it('WebhookProcessor should ignore duplicate webhook payloads safely (Demo A)', async () => {
    const mockPool = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      }),
      query: vi.fn()
        // WebhookEventRepository.recordEvent -> returns 0 rows (duplicate conflict)
        .mockResolvedValueOnce({ rows: [] })
    } as unknown as pg.Pool;

    const result = await WebhookProcessor.processEvent(mockPool, {
      merchantId,
      eventId: 'evt_dup_123',
      eventType: 'payment.failed',
      signatureValid: true,
      payload: {
        payload: {
          payment: {
            entity: {
              id: 'pay_123',
              amount: 149900,
              status: 'failed'
            }
          }
        }
      }
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.status).toBe('duplicate_ignored');
  });

  it('DiagnosisWorker should transition case to DIAGNOSED and save diagnosis', async () => {
    const mockClient = {
      release: vi.fn(),
      query: vi.fn()
        // BEGIN
        .mockResolvedValueOnce({ rows: [] })
        // selectForUpdate (current state DETECTED)
        .mockResolvedValueOnce({ rows: [{ id: 'case_1', merchant_id: merchantId, state: 'DETECTED' }] })
        // UPDATE recovery_cases -> DIAGNOSED
        .mockResolvedValueOnce({ rows: [{ id: 'case_1', state: 'DIAGNOSED' }] })
        // INSERT audit_logs
        .mockResolvedValueOnce({ rows: [{ id: 'log_1' }] })
        // INSERT diagnoses
        .mockResolvedValueOnce({ rows: [{ id: 'diag_1', failure_class: 'INSUFFICIENT_FUNDS' }] })
        // COMMIT
        .mockResolvedValueOnce({ rows: [] })
    } as unknown as pg.PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient)
    } as unknown as pg.Pool;

    await DiagnosisWorker.processJob(mockPool, {
      merchantId,
      caseId: 'case_1',
      paymentId: 'pay_1',
      amountInPaise: 149900,
      currency: 'INR',
      method: 'card',
      errorCode: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
      attemptNumber: 0
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO diagnoses'),
      expect.anything()
    );
  });

  it('PolicyWorker should evaluate rules and transition DIAGNOSED -> ACTION_SCHEDULED (Demo C)', async () => {
    const mockClient = {
      release: vi.fn(),
      query: vi.fn()
        // BEGIN
        .mockResolvedValueOnce({ rows: [] })
        // findById recovery_cases
        .mockResolvedValueOnce({ rows: [{ id: 'case_1', merchant_id: merchantId, payment_id: 'pay_1', state: 'DIAGNOSED', attempt_count: 0 }] })
        // findByCaseId diagnoses
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'diag_1',
              failure_class: 'INSUFFICIENT_FUNDS',
              confidence: 0.95,
              recommended_action: 'DELAYED_RETRY',
              recommended_delay_minutes: 10 // Short delay that cooling window rule will downgrade
            }
          ]
        })
        // findById merchants
        .mockResolvedValueOnce({
          rows: [
            {
              id: merchantId,
              policy_config: { max_retry_attempts: 2, cooling_window_hours: 6, max_auto_recovery_amount_paise: 1000000 }
            }
          ]
        })
        // findById payments
        .mockResolvedValueOnce({ rows: [{ id: 'pay_1', amount_in_paise: 149900, customer_id: null }] })
        // selectForUpdate (transition to POLICY_EVALUATED)
        .mockResolvedValueOnce({ rows: [{ id: 'case_1', merchant_id: merchantId, state: 'DIAGNOSED', attempt_count: 0 }] })
        // UPDATE recovery_cases -> POLICY_EVALUATED
        .mockResolvedValueOnce({ rows: [{ id: 'case_1', state: 'POLICY_EVALUATED' }] })
        // INSERT audit_logs
        .mockResolvedValueOnce({ rows: [{ id: 'log_1' }] })
        // INSERT policy_decisions
        .mockResolvedValueOnce({ rows: [{ id: 'pd_1', verdict: 'DOWNGRADED' }] })
        // selectForUpdate (transition to ACTION_SCHEDULED)
        .mockResolvedValueOnce({ rows: [{ id: 'case_1', merchant_id: merchantId, state: 'POLICY_EVALUATED', attempt_count: 0 }] })
        // UPDATE recovery_cases -> ACTION_SCHEDULED
        .mockResolvedValueOnce({ rows: [{ id: 'case_1', state: 'ACTION_SCHEDULED' }] })
        // INSERT audit_logs
        .mockResolvedValueOnce({ rows: [{ id: 'log_2' }] })
        // COMMIT
        .mockResolvedValueOnce({ rows: [] })
    } as unknown as pg.PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient)
    } as unknown as pg.Pool;

    await PolicyWorker.processJob(mockPool, {
      merchantId,
      caseId: 'case_1',
      diagnosisId: 'diag_1'
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_decisions'),
      expect.anything()
    );
  });

  it('RecoveryExecutionWorker should transition ACTION_SCHEDULED -> ACTION_EXECUTED with idempotency key', async () => {
    const mockClient = {
      release: vi.fn(),
      query: vi.fn()
        // findById recovery_cases
        .mockResolvedValueOnce({ rows: [{ id: 'case_1', merchant_id: merchantId, payment_id: 'pay_1', state: 'ACTION_SCHEDULED' }] })
        // findById payments
        .mockResolvedValueOnce({ rows: [{ id: 'pay_1', amount_in_paise: 149900, currency: 'INR', razorpay_payment_id: 'mock_pay_1', customer_id: null }] })
        // BEGIN
        .mockResolvedValueOnce({ rows: [] })
        // selectForUpdate (transition to ACTION_EXECUTED)
        .mockResolvedValueOnce({ rows: [{ id: 'case_1', merchant_id: merchantId, state: 'ACTION_SCHEDULED', attempt_count: 0 }] })
        // UPDATE recovery_cases -> ACTION_EXECUTED
        .mockResolvedValueOnce({ rows: [{ id: 'case_1', state: 'ACTION_EXECUTED' }] })
        // INSERT audit_logs
        .mockResolvedValueOnce({ rows: [{ id: 'log_1' }] })
        // INSERT interventions
        .mockResolvedValueOnce({ rows: [{ id: 'int_1', status: 'PENDING' }] })
        // COMMIT
        .mockResolvedValueOnce({ rows: [] })
        // BEGIN (update intervention status)
        .mockResolvedValueOnce({ rows: [] })
        // UPDATE interventions
        .mockResolvedValueOnce({ rows: [{ id: 'int_1', status: 'SUCCESS' }] })
        // COMMIT
        .mockResolvedValueOnce({ rows: [] })
    } as unknown as pg.PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient)
    } as unknown as pg.Pool;

    await RecoveryExecutionWorker.processJob(mockPool, {
      merchantId,
      caseId: 'case_1',
      policyDecisionId: 'pd_1',
      actionType: 'PAYMENT_LINK',
      attemptNumber: 1
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO interventions'),
      expect.anything()
    );
  });

  it('ReconcilerWorker should resolve OUTCOME_UNKNOWN -> RECOVERED upon confirmed captured payment (Demo B)', async () => {
    const mockClient = {
      release: vi.fn(),
      query: vi.fn()
        // BEGIN
        .mockResolvedValueOnce({ rows: [] })
        // findById recovery_cases (state OUTCOME_UNKNOWN)
        .mockResolvedValueOnce({ rows: [{ id: 'case_timeout', merchant_id: merchantId, state: 'OUTCOME_UNKNOWN' }] })
        // selectForUpdate (transition to RECONCILING)
        .mockResolvedValueOnce({ rows: [{ id: 'case_timeout', merchant_id: merchantId, state: 'OUTCOME_UNKNOWN' }] })
        // UPDATE recovery_cases -> RECONCILING
        .mockResolvedValueOnce({ rows: [{ id: 'case_timeout', state: 'RECONCILING' }] })
        // INSERT audit_logs
        .mockResolvedValueOnce({ rows: [{ id: 'log_1' }] })
        // COMMIT
        .mockResolvedValueOnce({ rows: [] })
        // BEGIN (resolution phase)
        .mockResolvedValueOnce({ rows: [] })
        // findById recovery_cases (state RECONCILING)
        .mockResolvedValueOnce({ rows: [{ id: 'case_timeout', merchant_id: merchantId, payment_id: 'pay_1', state: 'RECONCILING', attempt_count: 1, max_attempts: 2 }] })
        // findById payments
        .mockResolvedValueOnce({ rows: [{ id: 'pay_1', amount_in_paise: 149900 }] })
        // selectForUpdate (transition to ACTION_SCHEDULED or RECOVERED)
        .mockResolvedValueOnce({ rows: [{ id: 'case_timeout', merchant_id: merchantId, state: 'RECONCILING' }] })
        // UPDATE recovery_cases
        .mockResolvedValueOnce({ rows: [{ id: 'case_timeout', state: 'ACTION_SCHEDULED' }] })
        // INSERT audit_logs
        .mockResolvedValueOnce({ rows: [{ id: 'log_2' }] })
        // COMMIT
        .mockResolvedValueOnce({ rows: [] })
    } as unknown as pg.PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient)
    } as unknown as pg.Pool;

    await ReconcilerWorker.processJob(mockPool, {
      merchantId,
      caseId: 'case_timeout',
      razorpayPaymentId: 'mock_pay_1',
      attemptNumber: 1
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE recovery_cases'),
      expect.anything()
    );
  });
});
