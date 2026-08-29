import pg from 'pg';
import crypto from 'crypto';
import {
  RecoveryCaseRepository,
  PaymentRepository,
  CustomerRepository,
  InterventionRepository,
  withTransaction
} from '@recoveryos/db';
import { RazorpayAdapterClient } from '@recoveryos/razorpay-adapter';
import { QueueJobPayloads, QueueManager } from '../queues/queue-manager.js';

export class RecoveryExecutionWorker {
  private static getRazorpayClient(): RazorpayAdapterClient {
    return new RazorpayAdapterClient({
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      keySecret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder'
    });
  }

  public static async processJob(
    pool: pg.Pool,
    data: QueueJobPayloads['recovery-execution-queue']
  ): Promise<void> {
    const { merchantId, caseId, policyDecisionId, actionType, attemptNumber } = data;

    // 1. Generate unique deterministic idempotency key
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${merchantId}:${caseId}:${attemptNumber}:${actionType}`)
      .digest('hex');

    // 2. Fetch case, payment, customer
    const client = await pool.connect();
    let paymentId: string;
    let amountInPaise: number;
    let currency: string;
    let customerEmail: string | undefined;
    let customerContact: string | undefined;
    let razorpayPaymentId: string;

    try {
      const currentCase = await RecoveryCaseRepository.findById(client, merchantId, caseId);
      if (!currentCase || currentCase.state !== 'ACTION_SCHEDULED') {
        // Case is no longer scheduled (might have been cancelled, reconciled, or already executed)
        client.release();
        return;
      }

      const payment = await PaymentRepository.findById(client, merchantId, currentCase.payment_id);
      if (!payment) {
        throw new Error(`Payment not found for case [${caseId}]`);
      }

      paymentId = payment.id;
      amountInPaise = payment.amount_in_paise;
      currency = payment.currency;
      razorpayPaymentId = payment.razorpay_payment_id;

      if (payment.customer_id) {
        const customer = await CustomerRepository.findById(client, merchantId, payment.customer_id);
        if (customer) {
          customerEmail = customer.email || undefined;
          customerContact = customer.contact || undefined;
        }
      }
    } finally {
      client.release();
    }

    // 3. Pre-flight Gateway Status Verification
    const razorpayClient = this.getRazorpayClient();
    try {
      if (process.env.NODE_ENV !== 'test' && !razorpayPaymentId.startsWith('mock_')) {
        const liveStatus = await razorpayClient.fetchPayment(razorpayPaymentId);
        if (liveStatus.status === 'captured') {
          // Pre-flight check discovered payment was already recovered!
          await withTransaction(pool, async (tClient) => {
            await RecoveryCaseRepository.transitionState(tClient, {
              merchantId,
              caseId,
              targetState: 'RECOVERED',
              actor: 'WORKER:RecoveryExecutionWorker:PreFlightCheck',
              recoveredAmountInPaise: amountInPaise,
              auditMetadata: { preFlightCaptured: true, paymentId: razorpayPaymentId }
            });
          });
          return;
        }
      }
    } catch {
      // Pre-flight check failed (network/test), proceed with guarded execution
    }

    // 4. Record intervention and advance state to ACTION_EXECUTED
    const intervention = await withTransaction(pool, async (tClient) => {
      await RecoveryCaseRepository.transitionState(tClient, {
        merchantId,
        caseId,
        targetState: 'ACTION_EXECUTED',
        actor: 'WORKER:RecoveryExecutionWorker',
        auditMetadata: { idempotencyKey, actionType, attemptNumber }
      });

      return await InterventionRepository.create(tClient, {
        case_id: caseId,
        policy_decision_id: policyDecisionId,
        action_type: actionType,
        idempotency_key: idempotencyKey,
        status: 'PENDING'
      });
    });

    // 5. Execute bounded action with network failure / timeout handling
    try {
      if (actionType === 'PAYMENT_LINK') {
        let paymentLinkRef = `plink_${caseId.substring(0, 8)}_${attemptNumber}`;

        if (process.env.NODE_ENV !== 'test' && !razorpayPaymentId.startsWith('mock_')) {
          const linkResult = await razorpayClient.createPaymentLink({
            amountInPaise,
            currency,
            description: `Recovery payment for Order #${paymentId.substring(0, 8)}`,
            customer: {
              email: customerEmail,
              contact: customerContact
            },
            referenceId: idempotencyKey.substring(0, 40)
          });
          paymentLinkRef = linkResult.id;
        }

        await withTransaction(pool, async (tClient) => {
          await InterventionRepository.updateStatus(tClient, intervention.id, {
            status: 'SUCCESS',
            razorpay_reference_id: paymentLinkRef,
            executed_at: new Date()
          });
        });
      } else if (actionType === 'DELAYED_RETRY') {
        // Direct retry action executed
        await withTransaction(pool, async (tClient) => {
          await InterventionRepository.updateStatus(tClient, intervention.id, {
            status: 'SENT',
            executed_at: new Date()
          });
        });
      }
    } catch (err) {
      // 6. Ambiguity / Network Timeout Handling -> Transition to OUTCOME_UNKNOWN & HALT BLIND RETRIES
      const errorMessage = (err as Error).message;

      await withTransaction(pool, async (tClient) => {
        await InterventionRepository.updateStatus(tClient, intervention.id, {
          status: 'TIMEOUT',
          error_message: errorMessage,
          executed_at: new Date()
        });

        await RecoveryCaseRepository.transitionState(tClient, {
          merchantId,
          caseId,
          targetState: 'OUTCOME_UNKNOWN',
          actor: 'WORKER:RecoveryExecutionWorker:NetworkTimeout',
          auditMetadata: {
            error: errorMessage,
            protection: 'Double-charge protection active. Blind retries frozen.'
          }
        });
      });

      // Enqueue to Reconciler worker for verification
      await QueueManager.enqueueJob(
        'reconciliation-queue',
        `reconcile-${caseId}`,
        {
          merchantId,
          caseId,
          razorpayPaymentId,
          attemptNumber
        },
        {
          delayMs: 5000, // Wait 5s before polling gateway truth
          jobId: `rec_${caseId}_${Date.now()}`
        }
      );
    }
  }
}
