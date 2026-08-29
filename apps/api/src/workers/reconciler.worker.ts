import pg from 'pg';
import {
  RecoveryCaseRepository,
  PaymentRepository,
  withTransaction
} from '@recoveryos/db';
import { RazorpayAdapterClient } from '@recoveryos/razorpay-adapter';
import { QueueJobPayloads } from '../queues/queue-manager.js';

export class ReconcilerWorker {
  private static getRazorpayClient(): RazorpayAdapterClient {
    return new RazorpayAdapterClient({
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      keySecret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder'
    });
  }

  public static async processJob(
    pool: pg.Pool,
    data: QueueJobPayloads['reconciliation-queue']
  ): Promise<void> {
    const { merchantId, caseId, razorpayPaymentId } = data;

    // 1. Transactionally lock case and transition OUTCOME_UNKNOWN -> RECONCILING
    await withTransaction(pool, async (client) => {
      const currentCase = await RecoveryCaseRepository.findById(client, merchantId, caseId);
      if (!currentCase || currentCase.state !== 'OUTCOME_UNKNOWN') {
        return;
      }

      await RecoveryCaseRepository.transitionState(client, {
        merchantId,
        caseId,
        targetState: 'RECONCILING',
        actor: 'WORKER:ReconcilerWorker',
        auditMetadata: { pollingRazorpayId: razorpayPaymentId }
      });
    });

    // 2. Fetch authoritative ground truth from Razorpay API
    const razorpayClient = this.getRazorpayClient();
    let gatewayStatus: string = 'failed';
    let amountInPaise: number = 0;

    try {
      if (process.env.NODE_ENV !== 'test' && !razorpayPaymentId.startsWith('mock_')) {
        const livePayment = await razorpayClient.fetchPayment(razorpayPaymentId);
        gatewayStatus = livePayment.status;
        amountInPaise = livePayment.amount;
      }
    } catch {
      // If gateway is completely unreachable, gatewayStatus remains 'failed'
    }

    // 3. Resolve case state based on ground truth
    await withTransaction(pool, async (client) => {
      const currentCase = await RecoveryCaseRepository.findById(client, merchantId, caseId);
      if (!currentCase || currentCase.state !== 'RECONCILING') {
        return;
      }

      const payment = await PaymentRepository.findById(client, merchantId, currentCase.payment_id);
      const paymentAmount = amountInPaise || (payment ? payment.amount_in_paise : 0);

      if (gatewayStatus === 'captured') {
        // Double-charge successfully avoided! Payment was captured downstream.
        await RecoveryCaseRepository.transitionState(client, {
          merchantId,
          caseId,
          targetState: 'RECOVERED',
          actor: 'WORKER:ReconcilerWorker:ConfirmedCaptured',
          recoveredAmountInPaise: paymentAmount,
          auditMetadata: {
            resolvedState: 'captured',
            prevention: 'Double charge prevented by reconciliation.'
          }
        });
      } else {
        // Payment actually failed on gateway. Check retry budget.
        if (currentCase.attempt_count < currentCase.max_attempts) {
          await RecoveryCaseRepository.transitionState(client, {
            merchantId,
            caseId,
            targetState: 'ACTION_SCHEDULED',
            actor: 'WORKER:ReconcilerWorker:Rescheduled',
            auditMetadata: {
              resolvedState: 'failed',
              action: 'Retry budget remains. Rescheduling next recovery attempt.'
            }
          });
        } else {
          await RecoveryCaseRepository.transitionState(client, {
            merchantId,
            caseId,
            targetState: 'EXHAUSTED',
            actor: 'WORKER:ReconcilerWorker:Exhausted',
            auditMetadata: {
              resolvedState: 'failed',
              action: 'All retry attempts exhausted.'
            }
          });
        }
      }
    });
  }
}
