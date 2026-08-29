import { Queryable } from '../transaction.js';
import { DbMerchant } from '../types.js';

export class MerchantRepository {
  public static async findById(db: Queryable, id: string): Promise<DbMerchant | null> {
    const result = await db.query(
      `SELECT * FROM merchants WHERE id = $1`,
      [id]
    );
    return (result.rows[0] as DbMerchant) || null;
  }

  public static async findByRazorpayAccountId(db: Queryable, accountId: string): Promise<DbMerchant | null> {
    const result = await db.query(
      `SELECT * FROM merchants WHERE razorpay_account_id = $1`,
      [accountId]
    );
    return (result.rows[0] as DbMerchant) || null;
  }

  public static async create(
    db: Queryable,
    params: {
      name: string;
      razorpay_account_id: string;
      webhook_secret: string;
      policy_config?: Record<string, unknown>;
    }
  ): Promise<DbMerchant> {
    const result = await db.query(
      `INSERT INTO merchants (name, razorpay_account_id, webhook_secret, policy_config)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        params.name,
        params.razorpay_account_id,
        params.webhook_secret,
        JSON.stringify(params.policy_config || {})
      ]
    );
    return result.rows[0] as DbMerchant;
  }

  public static async updatePolicyConfig(
    db: Queryable,
    id: string,
    policyConfig: Record<string, unknown>
  ): Promise<DbMerchant | null> {
    const result = await db.query(
      `UPDATE merchants 
       SET policy_config = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [JSON.stringify(policyConfig), id]
    );
    return (result.rows[0] as DbMerchant) || null;
  }
}
