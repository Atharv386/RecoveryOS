import { SyntheticPaymentRecord, SimulationResultMetrics, PolicyComparisonResult } from './types.js';
import { DeterministicPolicyEngine, MerchantPolicyConfig } from '@recoveryos/policy-engine';
import { classifyWithFallback } from '@recoveryos/ai-diagnosis';

export class RecoveryTwinSimulator {
  /**
   * Replays a dataset of payment failure records against a given merchant policy.
   * STRICT SAFETY INVARIANT: Strictly non-executing. Has zero network or payment credentials.
   */
  public static simulate(
    records: SyntheticPaymentRecord[],
    policy: MerchantPolicyConfig
  ): SimulationResultMetrics {
    let recoveredCases = 0;
    let recoveredRevenuePaise = 0;
    let interventionsScheduled = 0;
    let manualReviewsRequired = 0;

    const byClass: Record<string, { total: number; recovered: number; rate: number }> = {};

    for (const record of records) {
      if (!byClass[record.failureClass]) {
        byClass[record.failureClass] = { total: 0, recovered: 0, rate: 0 };
      }
      byClass[record.failureClass].total++;

      // 1. Diagnostic phase (using deterministic rules or cached diagnosis)
      const diagnosis = classifyWithFallback({
        merchantId: 'sim_merchant',
        paymentId: record.id,
        amountInPaise: record.amountInPaise,
        currency: 'INR',
        method: 'card',
        errorCode: record.errorCode,
        attemptNumber: 0,
        customerHistory: record.customerHistory
      });

      // 2. Policy evaluation phase
      const decision = DeterministicPolicyEngine.evaluate({
        merchantConfig: policy,
        diagnosis,
        amountInPaise: record.amountInPaise,
        currentAttemptCount: 0,
        customerConsent: record.consent
      });

      if (decision.requiresManualApproval) {
        manualReviewsRequired++;
      }

      if (decision.verdict === 'APPROVED' || decision.verdict === 'DOWNGRADED') {
        interventionsScheduled++;

        // Model outcome deterministically based on ground truth probabilities
        let isRecovered = false;
        if (decision.actionType === 'DELAYED_RETRY') {
          // Delay matching cooling window improves success
          const coolingBonus = decision.delayMinutes >= 360 ? 0.15 : 0.0;
          isRecovered = record.groundTruth.retrySuccessProbability + coolingBonus >= 0.50;
        } else if (decision.actionType === 'PAYMENT_LINK') {
          isRecovered = record.groundTruth.paymentLinkSuccessProbability >= 0.50;
        }

        if (isRecovered) {
          recoveredCases++;
          recoveredRevenuePaise += record.amountInPaise;
          byClass[record.failureClass].recovered++;
        }
      }
    }

    for (const key of Object.keys(byClass)) {
      const c = byClass[key];
      c.rate = c.total > 0 ? Number(((c.recovered / c.total) * 100).toFixed(2)) : 0;
    }

    const totalCases = records.length;
    const recoveryRatePercent = totalCases > 0 ? Number(((recoveredCases / totalCases) * 100).toFixed(2)) : 0;

    return {
      totalCases,
      eligibleCases: totalCases,
      recoveredCases,
      recoveredRevenuePaise,
      recoveryRatePercent,
      interventionsScheduled,
      manualReviewsRequired,
      byFailureClass: byClass
    };
  }

  /**
   * Compares a baseline policy with a proposed policy to simulate impact before rollout.
   */
  public static compare(
    records: SyntheticPaymentRecord[],
    baselinePolicy: MerchantPolicyConfig,
    proposedPolicy: MerchantPolicyConfig
  ): PolicyComparisonResult {
    const baseline = this.simulate(records, baselinePolicy);
    const proposed = this.simulate(records, proposedPolicy);

    return {
      baseline,
      proposed,
      delta: {
        incrementalRecoveredPaise: proposed.recoveredRevenuePaise - baseline.recoveredRevenuePaise,
        recoveryRateDeltaPercent: Number((proposed.recoveryRatePercent - baseline.recoveryRatePercent).toFixed(2)),
        extraInterventions: proposed.interventionsScheduled - baseline.interventionsScheduled
      }
    };
  }
}
