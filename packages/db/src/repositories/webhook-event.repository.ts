import { Queryable } from '../transaction.js';

export interface DbWebhookEvent {
  id: string;
  merchant_id: string;
  razorpay_event_id: string;
  event_type: string;
  signature_valid: boolean;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: Date;
}

export class WebhookEventRepository {
  /**
   * Records a webhook event idempotently.
   * Returns the created event, or null if the event was already recorded (duplicate).
   */
  public static async recordEvent(
    db: Queryable,
    params: {
      merchant_id: string;
      razorpay_event_id: string;
      event_type: string;
      signature_valid: boolean;
      payload: Record<string, unknown>;
    }
  ): Promise<{ event: DbWebhookEvent | null; isDuplicate: boolean }> {
    const result = await db.query(
      `INSERT INTO webhook_events (
         merchant_id, razorpay_event_id, event_type, signature_valid, payload
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (merchant_id, razorpay_event_id) DO NOTHING
       RETURNING *`,
      [
        params.merchant_id,
        params.razorpay_event_id,
        params.event_type,
        params.signature_valid,
        JSON.stringify(params.payload)
      ]
    );

    if (result.rows.length === 0) {
      // Duplicate event detected
      return { event: null, isDuplicate: true };
    }

    return { event: result.rows[0] as DbWebhookEvent, isDuplicate: false };
  }

  public static async markProcessed(
    db: Queryable,
    merchantId: string,
    eventId: string
  ): Promise<void> {
    await db.query(
      `UPDATE webhook_events 
       SET processed = true 
       WHERE id = $1 AND merchant_id = $2`,
      [eventId, merchantId]
    );
  }
}
