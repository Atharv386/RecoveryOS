import pg from 'pg';
import {
  DeterministicPolicyEngine,
  MerchantPolicyConfig,
  MerchantPolicyConfigSchema
} from '@recoveryos/policy-engine';
import {
  RecoveryCaseRepository,
  DiagnosisRepository,
  MerchantRepository,
  PolicyDecisionRepository,
  PaymentRepository,
  CustomerRepository,
  withTransaction
} from '@recoveryos/db';
import { QueueJobPayloads, QueueManager } from '../queues/queue-manager.js';
import { FailureClass, RecommendedAction } from '@recoveryos/ai-diagnosis';

export class PolicyWorker {
  public static async processJob(
    pool: pg.Pool,
    data: QueueJobPayloads['policy-queue']
  ): Promise<void> {
    const { merchantId, caseId, diagnosisId } = data;

    await withTransaction(pool, async (client) => {
      // 1. Fetch current case, diagnosis, merchant config, payment, and customer
      const currentCase = await RecoveryCaseRepository.findById(client, merchantId, caseId);
      if (!currentCase) {
        throw new Error(`Case [${caseId}] not found for merchant [${merchantId}]`);
      }

      const diagnosis = await DiagnosisRepository.findByCaseId(client, caseId);
      if (!diagnosis) {
        throw new Error(`Diagnosis [${diagnosisId}] not found for case [${caseId}]`);
      }

      const merchant = await MerchantRepository.findById(client, merchantId);
      const rawPolicyConfig = merchant?.policy_config || {};
      const parsedPolicyConfig: MerchantPolicyConfig = MerchantPolicyConfigSchema.parse(rawPolicyConfig);

      const payment = await PaymentRepository.findById(client, merchantId, currentCase.payment_id);
      const amountInPaise = payment ? payment.amount_in_paise : 0;

      let customerConsent = { sms: true, whatsapp: false, marketing: true };
      if (payment?.customer_id) {
        const customer = await CustomerRepository.findById(client, merchantId, payment.customer_id);
        if (customer) {
          customerConsent = {
            sms: customer.has_sms_consent,
            whatsapp: customer.has_whatsapp_consent,
            marketing: customer.has_marketing_consent
          };
        }
      }

      // 2. Evaluate all 6 deterministic policy rules
      const decision = DeterministicPolicyEngine.evaluate({
        merchantConfig: parsedPolicyConfig,
        diagnosis: {
          failure_class: diagnosis.failure_class as FailureClass,
          confidence: Number(diagnosis.confidence),
          recommended_action: diagnosis.recommended_action as RecommendedAction,
          recommended_delay_minutes: diagnosis.recommended_delay_minutes,
          reasoning: diagnosis.reasoning
        },
        amountInPaise,
        currentAttemptCount: currentCase.attempt_count,
        customerConsent
      });

      // 3. Transition state DIAGNOSED -> POLICY_EVALUATED
      await RecoveryCaseRepository.transitionState(client, {
        merchantId,
        caseId,
        targetState: 'POLICY_EVALUATED',
        actor: 'WORKER:PolicyWorker',
        auditMetadata: {
          verdict: decision.verdict,
          actionType: decision.actionType,
          delayMinutes: decision.delayMinutes,
          requiresManualApproval: decision.requiresManualApproval
        }
      });

      // 4. Save policy decision with rules_fired trace
      const savedDecision = await PolicyDecisionRepository.create(client, {
        case_id: caseId,
        diagnosis_id: diagnosis.id,
        verdict: decision.verdict,
        action_type: decision.actionType,
        delay_minutes: decision.delayMinutes,
        rules_fired: decision.rulesFired.map(r => ({
          ruleName: r.ruleName,
          passed: r.passed,
          reason: r.reason
        }))
      });

      // 5. Branch based on policy decision verdict
      if (decision.verdict === 'APPROVED' || decision.verdict === 'DOWNGRADED') {
        const nextActionDate = new Date(Date.now() + decision.delayMinutes * 60 * 1000);

        await RecoveryCaseRepository.transitionState(client, {
          merchantId,
          caseId,
          targetState: 'ACTION_SCHEDULED',
          actor: 'WORKER:PolicyWorker',
          nextActionAt: nextActionDate,
          auditMetadata: { scheduledAction: decision.actionType, delayMinutes: decision.delayMinutes }
        });

        // Enqueue to execution queue with calculated delay
        await QueueManager.enqueueJob(
          'recovery-execution-queue',
          `execute-${caseId}`,
          {
            merchantId,
            caseId,
            policyDecisionId: savedDecision.id,
            actionType: decision.actionType,
            attemptNumber: currentCase.attempt_count + 1
          },
          {
            delayMs: decision.delayMinutes * 60 * 1000,
            jobId: `exec_${caseId}_${currentCase.attempt_count + 1}`
          }
        );
      } else if (decision.verdict === 'MANUAL_REVIEW_REQUIRED') {
        await RecoveryCaseRepository.transitionState(client, {
          merchantId,
          caseId,
          targetState: 'AWAITING_APPROVAL',
          actor: 'WORKER:PolicyWorker',
          auditMetadata: { reason: 'Policy requires manual operator approval' }
        });
      } else if (decision.verdict === 'REJECTED') {
        await RecoveryCaseRepository.transitionState(client, {
          merchantId,
          caseId,
          targetState: 'EXHAUSTED',
          actor: 'WORKER:PolicyWorker',
          auditMetadata: { reason: 'Policy rejected all recovery actions' }
        });
      }
    });
  }
}
