import { describe, it, expect } from 'vitest';
import { SyntheticDatasetGenerator } from '../generator.js';

describe('Synthetic Dataset Generator (10k Records)', () => {
  it('should generate exact count of records requested', () => {
    const dataset = SyntheticDatasetGenerator.generate(1000, 42);
    expect(dataset.length).toBe(1000);
    expect(dataset[0].id).toBe('synth_pay_000001');
    expect(dataset[999].id).toBe('synth_pay_001000');
  });

  it('should be 100% deterministic with identical seed', () => {
    const batch1 = SyntheticDatasetGenerator.generate(500, 1337);
    const batch2 = SyntheticDatasetGenerator.generate(500, 1337);

    expect(batch1).toEqual(batch2);
    expect(batch1[0].amountInPaise).toBe(batch2[0].amountInPaise);
    expect(batch1[100].failureClass).toBe(batch2[100].failureClass);
  });

  it('should cover all failure classes realistically across 10,000 records', () => {
    const dataset = SyntheticDatasetGenerator.generate(10000, 1337);
    expect(dataset.length).toBe(10000);

    const classCounts: Record<string, number> = {};
    for (const r of dataset) {
      classCounts[r.failureClass] = (classCounts[r.failureClass] || 0) + 1;
      expect(r.amountInPaise).toBeGreaterThanOrEqual(50000); // >= ₹500
      expect(r.amountInPaise).toBeLessThanOrEqual(5000000); // <= ₹50,000
      expect(r.groundTruth.retrySuccessProbability).toBeGreaterThanOrEqual(0.0);
      expect(r.groundTruth.retrySuccessProbability).toBeLessThanOrEqual(1.0);
    }

    // Verify key failure classes are well represented
    expect(classCounts['INSUFFICIENT_FUNDS']).toBeGreaterThan(2500); // ~35%
    expect(classCounts['AUTHENTICATION_FAILED']).toBeGreaterThan(1800); // ~25%
    expect(classCounts['NETWORK_TIMEOUT']).toBeGreaterThan(1000); // ~15%
    expect(classCounts['GATEWAY_ERROR']).toBeGreaterThan(700); // ~10%
    expect(classCounts['EXPIRED_INSTRUMENT']).toBeGreaterThan(500); // ~8%
    expect(classCounts['SUSPECTED_FRAUD']).toBeGreaterThan(100); // ~2%
  });
});
