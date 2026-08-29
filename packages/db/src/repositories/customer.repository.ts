import { Queryable } from '../transaction.js';

export interface DbCustomer {
  id: string;
  merchant_id: string;
  razorpay_customer_id: string | null;
  email: string | null;
  contact: string | null;
  has_marketing_consent: boolean;
  has_sms_consent: boolean;
  has_whatsapp_consent: boolean;
  created_at: Date;
}

export class CustomerRepository {
  public static async findById(db: Queryable, merchantId: string, id: string): Promise<DbCustomer | null> {
    const result = await db.query(
      `SELECT * FROM customers WHERE id = $1 AND merchant_id = $2`,
      [id, merchantId]
    );
    return (result.rows[0] as DbCustomer) || null;
  }

  public static async findByRazorpayCustomerId(
    db: Queryable,
    merchantId: string,
    razorpayCustomerId: string
  ): Promise<DbCustomer | null> {
    const result = await db.query(
      `SELECT * FROM customers WHERE razorpay_customer_id = $1 AND merchant_id = $2`,
      [razorpayCustomerId, merchantId]
    );
    return (result.rows[0] as DbCustomer) || null;
  }

  public static async upsert(
    db: Queryable,
    params: {
      merchant_id: string;
      razorpay_customer_id?: string | null;
      email?: string | null;
      contact?: string | null;
      has_sms_consent?: boolean;
      has_whatsapp_consent?: boolean;
      has_marketing_consent?: boolean;
    }
  ): Promise<DbCustomer> {
    const result = await db.query(
      `INSERT INTO customers (
         merchant_id, razorpay_customer_id, email, contact, 
         has_sms_consent, has_whatsapp_consent, has_marketing_consent
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (merchant_id, razorpay_customer_id) 
       DO UPDATE SET 
         email = COALESCE(EXCLUDED.email, customers.email),
         contact = COALESCE(EXCLUDED.contact, customers.contact)
       RETURNING *`,
      [
        params.merchant_id,
        params.razorpay_customer_id || null,
        params.email || null,
        params.contact || null,
        params.has_sms_consent ?? true,
        params.has_whatsapp_consent ?? false,
        params.has_marketing_consent ?? true
      ]
    );
    return result.rows[0] as DbCustomer;
  }
}
