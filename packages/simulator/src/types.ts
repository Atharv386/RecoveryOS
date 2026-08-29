import type { FailureClass } from '@recoveryos/ai-diagnosis';
export type { FailureClass };

export interface SyntheticPaymentRecord {
  id: string;
  amountInPaise: number;
  failureClass: FailureClass;
  errorCode: string;
  customerHistory: {
    totalPayments: number;
    successfulPayments: number;
  };
  consent: {
    sms: boolean;
    whatsapp: boolean;
    marketing: boolean;
  };
  /** Ground truth: whether a retry after X hours or a payment link succeeds */
  groundTruth: {
    retrySuccessProbability: number; // 0.0 to 1.0
    paymentLinkSuccessProbability: number; // 0.0 to 1.0
  };
}

export interface SimulationResultMetrics {
  totalCases: number;
  eligibleCases: number;
  recoveredCases: number;
  recoveredRevenuePaise: number;
  recoveryRatePercent: number;
  interventionsScheduled: number;
  manualReviewsRequired: number;
  byFailureClass: Record<string, { total: number; recovered: number; rate: number }>;
}

export interface PolicyComparisonResult {
  baseline: SimulationResultMetrics;
  proposed: SimulationResultMetrics;
  delta: {
    incrementalRecoveredPaise: number;
    recoveryRateDeltaPercent: number;
    extraInterventions: number;
  };
}
