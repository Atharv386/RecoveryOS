import { Queryable } from '../transaction.js';

export interface DbDiagnosis {
  id: string;
  case_id: string;
  is_fallback: boolean;
  model_name: string;
  input_hash: string;
  failure_class: string;
  confidence: number;
  reasoning: string;
  recommended_action: string;
  recommended_delay_minutes: number;
  created_at: Date;
}

export class DiagnosisRepository {
  public static async findByCaseId(db: Queryable, caseId: string): Promise<DbDiagnosis | null> {
    const result = await db.query(
      `SELECT * FROM diagnoses WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [caseId]
    );
    return (result.rows[0] as DbDiagnosis) || null;
  }

  public static async create(
    db: Queryable,
    params: {
      case_id: string;
      is_fallback: boolean;
      model_name: string;
      input_hash: string;
      failure_class: string;
      confidence: number;
      reasoning: string;
      recommended_action: string;
      recommended_delay_minutes: number;
    }
  ): Promise<DbDiagnosis> {
    const result = await db.query(
      `INSERT INTO diagnoses (
         case_id, is_fallback, model_name, input_hash, failure_class,
         confidence, reasoning, recommended_action, recommended_delay_minutes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        params.case_id,
        params.is_fallback,
        params.model_name,
        params.input_hash,
        params.failure_class,
        params.confidence,
        params.reasoning,
        params.recommended_action,
        params.recommended_delay_minutes
      ]
    );
    return result.rows[0] as DbDiagnosis;
  }
}
