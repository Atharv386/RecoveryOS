import pg from 'pg';
import { Queryable, selectForUpdate } from '../transaction.js';
import { DbRecoveryCase } from '../types.js';
import { assertValidTransition, CaseState } from '@recoveryos/state-machine';

export class RecoveryCaseRepository {
  public static async findById(
    db: Queryable,
    merchantId: string,
    id: string
  ): Promise<DbRecoveryCase | null> {
    const result = await db.query(
      `SELECT * FROM recovery_cases WHERE id = $1 AND merchant_id = $2`,
      [id, merchantId]
    );
    return (result.rows[0] as DbRecoveryCase) || null;
  }

  public static async findByPaymentId(
    db: Queryable,
    merchantId: string,
    paymentId: string
  ): Promise<DbRecoveryCase | null> {
    const result = await db.query(
      `SELECT * FROM recovery_cases WHERE payment_id = $1 AND merchant_id = $2`,
      [paymentId, merchantId]
    );
    return (result.rows[0] as DbRecoveryCase) || null;
  }

  public static async create(
    db: Queryable,
    params: {
      merchant_id: string;
      payment_id: string;
      max_attempts?: number;
    }
  ): Promise<DbRecoveryCase> {
    const result = await db.query(
      `INSERT INTO recovery_cases (
         merchant_id, payment_id, state, max_attempts
       )
       VALUES ($1, $2, 'DETECTED', $3)
       RETURNING *`,
      [
        params.merchant_id,
        params.payment_id,
        params.max_attempts ?? 2
      ]
    );
    return result.rows[0] as DbRecoveryCase;
  }

  /**
   * Transactionally transitions a recovery case to a new state with SELECT FOR UPDATE row-locking.
   * Throws IllegalStateTransitionError if the state transition violates the authoritative state machine.
   */
  public static async transitionState(
    client: pg.PoolClient,
    params: {
      merchantId: string;
      caseId: string;
      targetState: CaseState;
      actor: string;
      failureClass?: string;
      nextActionAt?: Date | null;
      recoveredAmountInPaise?: number | null;
      auditMetadata?: Record<string, unknown>;
    }
  ): Promise<DbRecoveryCase> {
    // 1. Acquire row lock
    const currentCase = await selectForUpdate<DbRecoveryCase>(
      client,
      'recovery_cases',
      params.caseId,
      params.merchantId
    );

    if (!currentCase) {
      throw new Error(`RecoveryCase [${params.caseId}] not found for merchant [${params.merchantId}]`);
    }

    // 2. Authoritative state transition assertion
    const fromState = currentCase.state as CaseState;
    assertValidTransition(fromState, params.targetState, params.caseId);

    // 3. Compute attempt count increment if scheduling/executing action
    let attemptIncrement = 0;
    if (params.targetState === 'ACTION_EXECUTED') {
      attemptIncrement = 1;
    }

    const isRecovered = params.targetState === 'RECOVERED';

    // 4. Update the case record
    const updateResult = await client.query(
      `UPDATE recovery_cases 
       SET 
         state = $1,
         failure_class = COALESCE($2, failure_class),
         attempt_count = attempt_count + $3,
         next_action_at = $4,
         recovered_at = CASE WHEN $5 = true THEN NOW() ELSE recovered_at END,
         recovered_amount_in_paise = CASE WHEN $5 = true THEN COALESCE($6, recovered_amount_in_paise) ELSE recovered_amount_in_paise END,
         updated_at = NOW()
       WHERE id = $7 AND merchant_id = $8
       RETURNING *`,
      [
        params.targetState,
        params.failureClass || null,
        attemptIncrement,
        params.nextActionAt || null,
        isRecovered,
        params.recoveredAmountInPaise || null,
        params.caseId,
        params.merchantId
      ]
    );

    const updatedCase = updateResult.rows[0] as DbRecoveryCase;

    // 5. Append-only audit log entry within the same transaction
    await client.query(
      `INSERT INTO audit_logs (
         merchant_id, case_id, actor, action, from_state, to_state, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.merchantId,
        params.caseId,
        params.actor,
        `TRANSITION_${params.targetState}`,
        fromState,
        params.targetState,
        JSON.stringify(params.auditMetadata || {})
      ]
    );

    return updatedCase;
  }

  public static async listByMerchant(
    db: Queryable,
    merchantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<DbRecoveryCase[]> {
    const result = await db.query(
      `SELECT * FROM recovery_cases 
       WHERE merchant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [merchantId, limit, offset]
    );
    return result.rows as DbRecoveryCase[];
  }
}
