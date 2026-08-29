import pg from 'pg';
import {
  WebhookEventRepository,
  PaymentRepository,
  RecoveryCaseRepository,
  withTransaction
} from '@recoveryos/db';
import { QueueManager } from '../queues/queue-manager.js';

export interface ProcessWebhookResult {
  isDuplicate: boolean;
  caseId?: string;
  paymentId?: string;
  eventType: string;
  status: string;
}

export class WebhookProcessor {
  /**
   * Processes an incoming verified Razorpay webhook payload.
   */
  public static async processEvent(
    pool: pg.Pool,
    params: {
      merchantId: string;
      eventId: string;
      eventType: string;
      signatureValid: boolean;
      payload: Record<string, any>;
    }
  ): Promise<ProcessWebhookResult> {
    const { merchantId, eventId, eventType, signatureValid, payload } = params;

    // 1. Record event deduplicated
    const { event, isDuplicate } = await WebhookEventRepository.recordEvent(pool, {
      merchant_id: merchantId,
      razorpay_event_id: eventId,
      event_type: eventType,
      signature_valid: signatureValid,
      payload
    });

    if (isDuplicate || !event) {
      return {
        isDuplicate: true,
        eventType,
        status: 'duplicate_ignored'
      };
    }

    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity) {
      return {
        isDuplicate: false,
        eventType,
        status: 'ignored_no_payment_entity'
      };
    }

    // 2. Transactionally upsert payment and manage RecoveryCase
    const result = await withTransaction(pool, async (client) => {
      // Upsert payment telemetry
      const payment = await PaymentRepository.upsert(client, {
        merchant_id: merchantId,
        razorpay_payment_id: paymentEntity.id,
        razorpay_order_id: paymentEntity.order_id,
        amount_in_paise: Number(paymentEntity.amount),
        currency: paymentEntity.currency || 'INR',
        method: paymentEntity.method || 'unknown',
        status: paymentEntity.status || 'failed',
        error_code: paymentEntity.error_code,
        error_description: paymentEntity.error_description,
        error_source: paymentEntity.error_source,
        error_step: paymentEntity.error_step,
        error_reason: paymentEntity.error_reason,
        raw_payload: paymentEntity
      });

      let recoveryCase = await RecoveryCaseRepository.findByPaymentId(
        client,
        merchantId,
        payment.id
      );

      // Handle payment failure event -> create new RecoveryCase in DETECTED state
      if (eventType === 'payment.failed') {
        if (!recoveryCase) {
          recoveryCase = await RecoveryCaseRepository.create(client, {
            merchant_id: merchantId,
            payment_id: payment.id,
            max_attempts: 2
          });
        }
      } else if (eventType === 'payment.captured' && recoveryCase) {
        // Late or recovered payment webhook -> transition to RECOVERED if not already terminal
        if (recoveryCase.state !== 'RECOVERED') {
          try {
            recoveryCase = await RecoveryCaseRepository.transitionState(client, {
              merchantId,
              caseId: recoveryCase.id,
              targetState: 'RECOVERED',
              actor: 'WEBHOOK_EVENT:payment.captured',
              recoveredAmountInPaise: payment.amount_in_paise,
              auditMetadata: { razorpay_event_id: eventId }
            });
          } catch {
            // If illegal transition (e.g. from terminal EXHAUSTED), log and continue safely
          }
        }
      }

      return { payment, recoveryCase };
    });

    // 3. If a new case was created in DETECTED state, dispatch to diagnosis queue
    if (eventType === 'payment.failed' && result.recoveryCase && result.recoveryCase.state === 'DETECTED') {
      await QueueManager.enqueueJob(
        'diagnosis-queue',
        `diagnose-${result.recoveryCase.id}`,
        {
          merchantId,
          caseId: result.recoveryCase.id,
          paymentId: result.payment.id,
          amountInPaise: result.payment.amount_in_paise,
          currency: result.payment.currency,
          method: result.payment.method,
          errorCode: result.payment.error_code || undefined,
          errorDescription: result.payment.error_description || undefined,
          errorSource: result.payment.error_source || undefined,
          errorStep: result.payment.error_step || undefined,
          errorReason: result.payment.error_reason || undefined,
          attemptNumber: result.recoveryCase.attempt_count
        },
        { jobId: `diag_${result.recoveryCase.id}_${Date.now()}` }
      );
    }

    return {
      isDuplicate: false,
      caseId: result.recoveryCase?.id,
      paymentId: result.payment.id,
      eventType,
      status: 'processed'
    };
  }
}
