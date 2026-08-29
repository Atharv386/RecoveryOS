import { Queryable } from '../transaction.js';
import { DbPayment } from '../types.js';

export class PaymentRepository {
  public static async findById(
    db: Queryable,
    merchantId: string,
    id: string
  ): Promise<DbPayment | null> {
    const result = await db.query(
      `SELECT * FROM payments WHERE id = $1 AND merchant_id = $2`,
      [id, merchantId]
    );
    return (result.rows[0] as DbPayment) || null;
  }

  public static async findByRazorpayPaymentId(
    db: Queryable,
    merchantId: string,
    razorpayPaymentId: string
  ): Promise<DbPayment | null> {
    const result = await db.query(
      `SELECT * FROM payments WHERE razorpay_payment_id = $1 AND merchant_id = $2`,
      [razorpayPaymentId, merchantId]
    );
    return (result.rows[0] as DbPayment) || null;
  }

  public static async upsert(
    db: Queryable,
    params: {
      merchant_id: string;
      customer_id?: string | null;
      razorpay_payment_id: string;
      razorpay_order_id?: string | null;
      amount_in_paise: number;
      currency?: string;
      method: string;
      status: string;
      error_code?: string | null;
      error_description?: string | null;
      error_source?: string | null;
      error_step?: string | null;
      error_reason?: string | null;
      raw_payload?: Record<string, unknown> | null;
    }
  ): Promise<DbPayment> {
    const result = await db.query(
      `INSERT INTO payments (
         merchant_id, customer_id, razorpay_payment_id, razorpay_order_id,
         amount_in_paise, currency, method, status, error_code,
         error_description, error_source, error_step, error_reason, raw_payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (merchant_id, razorpay_payment_id) 
       DO UPDATE SET
         status = EXCLUDED.status,
         error_code = EXCLUDED.error_code,
         error_description = EXCLUDED.error_description,
         raw_payload = EXCLUDED.raw_payload,
         updated_at = NOW()
       RETURNING *`,
      [
        params.merchant_id,
        params.customer_id || null,
        params.razorpay_payment_id,
        params.razorpay_order_id || null,
        params.amount_in_paise,
        params.currency || 'INR',
        params.method,
        params.status,
        params.error_code || null,
        params.error_description || null,
        params.error_source || null,
        params.error_step || null,
        params.error_reason || null,
        params.raw_payload ? JSON.stringify(params.raw_payload) : null
      ]
    );
    return result.rows[0] as DbPayment;
  }

  public static async updateStatus(
    db: Queryable,
    merchantId: string,
    razorpayPaymentId: string,
    status: string
  ): Promise<DbPayment | null> {
    const result = await db.query(
      `UPDATE payments 
       SET status = $1, updated_at = NOW()
       WHERE razorpay_payment_id = $2 AND merchant_id = $3
       RETURNING *`,
      [status, razorpayPaymentId, merchantId]
    );
    return (result.rows[0] as DbPayment) || null;
  }
}
