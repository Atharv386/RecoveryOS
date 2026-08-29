import { Queryable } from '../transaction.js';

export interface DbIntervention {
  id: string;
  case_id: string;
  policy_decision_id: string;
  action_type: string;
  idempotency_key: string;
  status: 'PENDING' | 'SENT' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  razorpay_reference_id: string | null;
  error_message: string | null;
  executed_at: Date | null;
  created_at: Date;
}

export class InterventionRepository {
  public static async findByIdempotencyKey(
    db: Queryable,
    idempotencyKey: string
  ): Promise<DbIntervention | null> {
    const result = await db.query(
      `SELECT * FROM interventions WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    return (result.rows[0] as DbIntervention) || null;
  }

  public static async create(
    db: Queryable,
    params: {
      case_id: string;
      policy_decision_id: string;
      action_type: string;
      idempotency_key: string;
      status?: 'PENDING' | 'SENT' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
      razorpay_reference_id?: string | null;
    }
  ): Promise<DbIntervention> {
    const result = await db.query(
      `INSERT INTO interventions (
         case_id, policy_decision_id, action_type, idempotency_key, status, razorpay_reference_id
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.case_id,
        params.policy_decision_id,
        params.action_type,
        params.idempotency_key,
        params.status || 'PENDING',
        params.razorpay_reference_id || null
      ]
    );
    return result.rows[0] as DbIntervention;
  }

  public static async updateStatus(
    db: Queryable,
    id: string,
    params: {
      status: 'PENDING' | 'SENT' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
      razorpay_reference_id?: string | null;
      error_message?: string | null;
      executed_at?: Date;
    }
  ): Promise<DbIntervention | null> {
    const result = await db.query(
      `UPDATE interventions 
       SET 
         status = $1,
         razorpay_reference_id = COALESCE($2, razorpay_reference_id),
         error_message = COALESCE($3, error_message),
         executed_at = COALESCE($4, executed_at)
       WHERE id = $5 
       RETURNING *`,
      [
        params.status,
        params.razorpay_reference_id || null,
        params.error_message || null,
        params.executed_at || new Date(),
        id
      ]
    );
    return (result.rows[0] as DbIntervention) || null;
  }
}
