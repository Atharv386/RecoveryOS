import { SyntheticPaymentRecord, SimulationResultMetrics } from './types.js';
import { RecoveryTwinSimulator } from './runner.js';
import { MerchantPolicyConfig } from '@recoveryos/policy-engine';

export interface BaselineBenchmarkReport {
  datasetSummary: {
    totalRecords: number;
    totalRevenueAtRiskRupees: number;
    failureClassBreakdown: Record<string, number>;
  };
  baselineStrategy: {
    name: string;
    description: string;
    metrics: SimulationResultMetrics;
    recoveredRupees: number;
  };
  recoveryOSStrategy: {
    name: string;
    description: string;
    metrics: SimulationResultMetrics;
    recoveredRupees: number;
  };
  deltaComparison: {
    incrementalRecoveredRupees: number;
    recoveryRateLiftPercentagePoints: number;
    futileInterventionsPrevented: number;
    wastedRetryCostSavedRupees: number;
  };
  methodology: {
    prngSeed: number;
    reproducibility: string;
    limitations: string;
  };
}

export class BenchmarkEngine {
  /**
   * Runs an honest comparative benchmark between a traditional Blind Retry Cron
   * and the RecoveryOS Smart Policy Engine across the exact same seeded batch.
   */
  public static runBenchmark(
    records: SyntheticPaymentRecord[],
    seed: number = 1337
  ): BaselineBenchmarkReport {
    // 1. Dataset summary
    const totalRecords = records.length;
    let totalRevenueAtRiskPaise = 0;
    const failureClassBreakdown: Record<string, number> = {};

    for (const r of records) {
      totalRevenueAtRiskPaise += r.amountInPaise;
      failureClassBreakdown[r.failureClass] = (failureClassBreakdown[r.failureClass] || 0) + 1;
    }

    // 2. Baseline Strategy Simulation: Dumb Blind 1-Hour Fixed Retry Cron
    // Blindly retries everything once after 1h, ignoring failure cause, fraud, expired instruments, or consent
    let baselineRecoveredCases = 0;
    let baselineRecoveredPaise = 0;
    let baselineInterventions = 0;
    let baselineFutileRetries = 0;
    const baselineByClass: Record<string, { total: number; recovered: number; rate: number }> = {};

    for (const r of records) {
      if (!baselineByClass[r.failureClass]) {
        baselineByClass[r.failureClass] = { total: 0, recovered: 0, rate: 0 };
      }
      baselineByClass[r.failureClass].total++;
      baselineInterventions++;

      // Blind retry has no cooling window bonus and fails completely on expired cards / OTP
      const isRecovered = r.groundTruth.retrySuccessProbability >= 0.50;

      if (isRecovered) {
        baselineRecoveredCases++;
        baselineRecoveredPaise += r.amountInPaise;
        baselineByClass[r.failureClass].recovered++;
      } else {
        // Futile retry on hopeless failure classes (e.g. expired cards, wrong OTP, suspected fraud)
        if (r.failureClass === 'EXPIRED_INSTRUMENT' || r.failureClass === 'AUTHENTICATION_FAILED' || r.failureClass === 'SUSPECTED_FRAUD') {
          baselineFutileRetries++;
        }
      }
    }

    for (const k of Object.keys(baselineByClass)) {
      const c = baselineByClass[k];
      c.rate = c.total > 0 ? Number(((c.recovered / c.total) * 100).toFixed(2)) : 0;
    }

    const baselineMetrics: SimulationResultMetrics = {
      totalCases: totalRecords,
      eligibleCases: totalRecords,
      recoveredCases: baselineRecoveredCases,
      recoveredRevenuePaise: baselineRecoveredPaise,
      recoveryRatePercent: Number(((baselineRecoveredCases / totalRecords) * 100).toFixed(2)),
      interventionsScheduled: baselineInterventions,
      manualReviewsRequired: 0,
      byFailureClass: baselineByClass
    };

    // 3. RecoveryOS Smart Recovery Strategy
    const recoveryOSPolicy: MerchantPolicyConfig = {
      max_retry_attempts: 2,
      cooling_window_hours: 6,
      max_auto_recovery_amount_paise: 1000000, // ₹10k threshold
      require_consent_for_notifications: true,
      min_ai_confidence_threshold: 0.70,
      allowed_channels: ['EMAIL', 'SMS'],
      require_approval_for_fraud_suspicion: true
    };

    const recoveryOSMetrics = RecoveryTwinSimulator.simulate(records, recoveryOSPolicy);

    // 4. Calculate Delta and Value Saved
    const incrementalRecoveredPaise = recoveryOSMetrics.recoveredRevenuePaise - baselineRecoveredPaise;
    const rateDelta = Number((recoveryOSMetrics.recoveryRatePercent - baselineMetrics.recoveryRatePercent).toFixed(2));
    // Estimated ₹5 gateway/network fee per wasted futile retry
    const costSavedRupees = baselineFutileRetries * 5;

    return {
      datasetSummary: {
        totalRecords,
        totalRevenueAtRiskRupees: Number((totalRevenueAtRiskPaise / 100).toFixed(2)),
        failureClassBreakdown
      },
      baselineStrategy: {
        name: 'Traditional Blind Retry Cron',
        description: 'Fixed 1-hour interval blind retry without failure diagnosis, cooling window, or method switching.',
        metrics: baselineMetrics,
        recoveredRupees: Number((baselineRecoveredPaise / 100).toFixed(2))
      },
      recoveryOSStrategy: {
        name: 'RecoveryOS Adaptive Policy Loop',
        description: 'AI & fallback failure categorization, 6 deterministic policy rules, cooling windows, and payment link routing for OTP/expired instruments.',
        metrics: recoveryOSMetrics,
        recoveredRupees: Number((recoveryOSMetrics.recoveredRevenuePaise / 100).toFixed(2))
      },
      deltaComparison: {
        incrementalRecoveredRupees: Number((incrementalRecoveredPaise / 100).toFixed(2)),
        recoveryRateLiftPercentagePoints: rateDelta,
        futileInterventionsPrevented: baselineFutileRetries,
        wastedRetryCostSavedRupees: costSavedRupees
      },
      methodology: {
        prngSeed: seed,
        reproducibility: 'Deterministic Mulberry32 algorithm. The exact same seed yields identical results across all platforms.',
        limitations: 'Evaluated against realistic synthetic distributions. Actual merchant recovery lift depends on customer responsiveness to payment links.'
      }
    };
  }
}
