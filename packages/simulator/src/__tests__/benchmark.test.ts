import { describe, it, expect } from 'vitest';
import { SyntheticDatasetGenerator } from '../generator.js';
import { BenchmarkEngine } from '../benchmark.js';

describe('Baseline vs. RecoveryOS Benchmark Engine', () => {
  it('should run benchmark across 10,000 records and demonstrate recovery lift', () => {
    const dataset = SyntheticDatasetGenerator.generate(10000, 1337);
    const report = BenchmarkEngine.runBenchmark(dataset, 1337);

    expect(report.datasetSummary.totalRecords).toBe(10000);
    expect(report.datasetSummary.totalRevenueAtRiskRupees).toBeGreaterThan(10000000); // > ₹1 Crore at risk

    // RecoveryOS should recover significantly more revenue than blind fixed retry
    expect(report.recoveryOSStrategy.recoveredRupees).toBeGreaterThan(report.baselineStrategy.recoveredRupees);
    expect(report.deltaComparison.incrementalRecoveredRupees).toBeGreaterThan(0);
    expect(report.deltaComparison.recoveryRateLiftPercentagePoints).toBeGreaterThan(0);

    // Futile retries on expired cards/fraud should be prevented
    expect(report.deltaComparison.futileInterventionsPrevented).toBeGreaterThan(1000);

    // Breakdown checks:
    // On EXPIRED_INSTRUMENT, baseline recovery should be 0%, whereas RecoveryOS recovers via payment links
    const baselineExpired = report.baselineStrategy.metrics.byFailureClass['EXPIRED_INSTRUMENT'];
    const recoveryOSExpired = report.recoveryOSStrategy.metrics.byFailureClass['EXPIRED_INSTRUMENT'];
    expect(baselineExpired.rate).toBe(0);
    expect(recoveryOSExpired.rate).toBeGreaterThan(50);
  });
});
