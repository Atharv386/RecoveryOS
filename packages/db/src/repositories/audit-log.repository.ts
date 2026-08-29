import { Queryable } from '../transaction.js';
import { DbAuditLog } from '../types.js';

export class AuditLogRepository {
  public static async log(
    db: Queryable,
    params: {
      merchant_id: string;
      case_id?: string | null;
      actor: string;
      action: string;
      from_state?: string | null;
      to_state?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ): Promise<DbAuditLog> {
    const result = await db.query(
      `INSERT INTO audit_logs (
         merchant_id, case_id, actor, action, from_state, to_state, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        params.merchant_id,
        params.case_id || null,
        params.actor,
        params.action,
        params.from_state || null,
        params.to_state || null,
        params.metadata ? JSON.stringify(params.metadata) : null
      ]
    );
    return result.rows[0] as DbAuditLog;
  }

  public static async listByCaseId(
    db: Queryable,
    merchantId: string,
    caseId: string
  ): Promise<DbAuditLog[]> {
    const result = await db.query(
      `SELECT * FROM audit_logs 
       WHERE case_id = $1 AND merchant_id = $2 
       ORDER BY created_at ASC`,
      [caseId, merchantId]
    );
    return result.rows as DbAuditLog[];
  }
}
