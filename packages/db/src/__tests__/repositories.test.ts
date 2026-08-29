import { describe, it, expect, vi } from 'vitest';
import {
  MerchantRepository,
  CustomerRepository,
  PaymentRepository,
  WebhookEventRepository,
  RecoveryCaseRepository,
  DiagnosisRepository,
  PolicyDecisionRepository,
  InterventionRepository,
  AuditLogRepository,
  Queryable
} from '../index.js';
import pg from 'pg';

describe('Data Layer Repositories & Invariants', () => {
  it('MerchantRepository.create should construct SQL with JSONB policy config', async () => {
    const mockDb: Queryable = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'm_1',
            name: 'Acme SaaS',
            razorpay_account_id: 'acc_123',
            webhook_secret: 'sec_123',
            policy_config: { max_retry_attempts: 2 }
          }
        ]
      })
    } as unknown as Queryable;

    const merchant = await MerchantRepository.create(mockDb, {
      name: 'Acme SaaS',
      razorpay_account_id: 'acc_123',
      webhook_secret: 'sec_123',
      policy_config: { max_retry_attempts: 2 }
    });

    expect(merchant.id).toBe('m_1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO merchants'),
      expect.arrayContaining(['Acme SaaS', 'acc_123', 'sec_123', JSON.stringify({ max_retry_attempts: 2 })])
    );
  });

  it('PaymentRepository.findById should enforce merchant_id tenant scoping', async () => {
    const mockDb: Queryable = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'p_1',
            merchant_id: 'm_1',
            razorpay_payment_id: 'pay_123',
            amount_in_paise: 150000,
            status: 'failed'
          }
        ]
      })
    } as unknown as Queryable;

    const payment = await PaymentRepository.findById(mockDb, 'm_1', 'p_1');
    expect(payment).toBeDefined();
    expect(payment?.merchant_id).toBe('m_1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND merchant_id = $2'),
      ['p_1', 'm_1']
    );
  });

  it('WebhookEventRepository.recordEvent should handle duplicate events safely', async () => {
    // 1. Initial event insertion -> returns row
    const mockDbSuccess: Queryable = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'we_1', razorpay_event_id: 'evt_100', processed: false }]
      })
    } as unknown as Queryable;

    const res1 = await WebhookEventRepository.recordEvent(mockDbSuccess, {
      merchant_id: 'm_1',
      razorpay_event_id: 'evt_100',
      event_type: 'payment.failed',
      signature_valid: true,
      payload: { test: true }
    });

    expect(res1.isDuplicate).toBe(false);
    expect(res1.event?.id).toBe('we_1');

    // 2. Duplicate event insertion -> ON CONFLICT returns 0 rows
    const mockDbDuplicate: Queryable = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    } as unknown as Queryable;

    const res2 = await WebhookEventRepository.recordEvent(mockDbDuplicate, {
      merchant_id: 'm_1',
      razorpay_event_id: 'evt_100',
      event_type: 'payment.failed',
      signature_valid: true,
      payload: { test: true }
    });

    expect(res2.isDuplicate).toBe(true);
    expect(res2.event).toBeNull();
  });

  it('RecoveryCaseRepository.transitionState should acquire row lock and assert state validity', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. SELECT ... FOR UPDATE returns current case in DETECTED state
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'case_1',
              merchant_id: 'm_1',
              payment_id: 'p_1',
              state: 'DETECTED',
              attempt_count: 0
            }
          ]
        })
        // 2. UPDATE recovery_cases returns updated case in DIAGNOSED state
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'case_1',
              merchant_id: 'm_1',
              state: 'DIAGNOSED',
              attempt_count: 0
            }
          ]
        })
        // 3. INSERT INTO audit_logs
        .mockResolvedValueOnce({
          rows: [{ id: 'log_1' }]
        })
    } as unknown as pg.PoolClient;

    const updated = await RecoveryCaseRepository.transitionState(mockClient, {
      merchantId: 'm_1',
      caseId: 'case_1',
      targetState: 'DIAGNOSED',
      actor: 'AI_WORKER',
      failureClass: 'INSUFFICIENT_FUNDS'
    });

    expect(updated.state).toBe('DIAGNOSED');
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      ['case_1', 'm_1']
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.anything()
    );
  });

  it('RecoveryCaseRepository.transitionState should reject forbidden transitions', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'case_1',
            merchant_id: 'm_1',
            state: 'RECOVERED' // Terminal state!
          }
        ]
      })
    } as unknown as pg.PoolClient;

    await expect(
      RecoveryCaseRepository.transitionState(mockClient, {
        merchantId: 'm_1',
        caseId: 'case_1',
        targetState: 'DETECTED', // Illegal regression!
        actor: 'WEBHOOK_WORKER'
      })
    ).rejects.toThrow(/State 'RECOVERED' is terminal and immutable/);
  });

  it('InterventionRepository.create should store unique idempotency key', async () => {
    const mockDb: Queryable = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'int_1',
            case_id: 'c_1',
            idempotency_key: 'idem_hash_123',
            status: 'PENDING'
          }
        ]
      })
    } as unknown as Queryable;

    const intervention = await InterventionRepository.create(mockDb, {
      case_id: 'c_1',
      policy_decision_id: 'pd_1',
      action_type: 'DELAYED_RETRY',
      idempotency_key: 'idem_hash_123'
    });

    expect(intervention.idempotency_key).toBe('idem_hash_123');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO interventions'),
      expect.arrayContaining(['c_1', 'pd_1', 'DELAYED_RETRY', 'idem_hash_123', 'PENDING'])
    );
  });
});
