import { Queryable } from '../transaction.js';

export interface DbPolicyDecision {
  id: string;
  case_id: string;
  diagnosis_id: string;
  verdict: string;
  action_type: string;
  delay_minutes: number;
  rules_fired: Array<Record<string, unknown>>;
  created_at: Date;
}

export class PolicyDecisionRepository {
  public static async findByCaseId(db: Queryable, caseId: string): Promise<DbPolicyDecision | null> {
    const result = await db.query(
      `SELECT * FROM policy_decisions WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [caseId]
    );
    return (result.rows[0] as DbPolicyDecision) || null;
  }

  public static async create(
    db: Queryable,
    params: {
      case_id: string;
      diagnosis_id: string;
      verdict: string;
      action_type: string;
      delay_minutes: number;
      rules_fired: Array<Record<string, unknown>>;
    }
  ): Promise<DbPolicyDecision> {
    const result = await db.query(
      `INSERT INTO policy_decisions (
         case_id, diagnosis_id, verdict, action_type, delay_minutes, rules_fired
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.case_id,
        params.diagnosis_id,
        params.verdict,
        params.action_type,
        params.delay_minutes,
        JSON.stringify(params.rules_fired)
      ]
    );
    return result.rows[0] as DbPolicyDecision;
  }
}
