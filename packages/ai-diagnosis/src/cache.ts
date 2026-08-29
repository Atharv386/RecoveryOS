import { DiagnosisOutput } from './schema.js';
import { FailureContext } from './types.js';

export interface CacheEntry {
  diagnosis: DiagnosisOutput;
  cachedAt: number;
  hitCount: number;
}

export class DiagnosisCache {
  private static cache = new Map<string, CacheEntry>();
  private static hits = 0;
  private static misses = 0;

  /**
   * Generates a deterministic cache key: (error_code):(method):(amount_bucket)
   */
  public static getCacheKey(context: FailureContext): string {
    const errorCode = context.errorCode || 'UNKNOWN_ERROR';
    const method = context.method || 'card';

    // Amount buckets in INR
    const amountRupees = context.amountInPaise / 100;
    let amountBucket = 'LOW_<1K';
    if (amountRupees >= 1000 && amountRupees < 5000) {
      amountBucket = 'MID_1K-5K';
    } else if (amountRupees >= 5000 && amountRupees < 10000) {
      amountBucket = 'HIGH_5K-10K';
    } else if (amountRupees >= 10000) {
      amountBucket = 'VIP_>10K';
    }

    return `${errorCode}:${method}:${amountBucket}`;
  }

  public static get(context: FailureContext): DiagnosisOutput | null {
    const key = this.getCacheKey(context);
    const entry = this.cache.get(key);

    if (entry) {
      this.hits++;
      entry.hitCount++;
      return entry.diagnosis;
    }

    this.misses++;
    return null;
  }

  public static set(context: FailureContext, diagnosis: DiagnosisOutput): void {
    const key = this.getCacheKey(context);
    this.cache.set(key, {
      diagnosis,
      cachedAt: Date.now(),
      hitCount: 0
    });
  }

  public static getStats(): { hits: number; misses: number; hitRatePercent: number; size: number } {
    const total = this.hits + this.misses;
    const hitRatePercent = total > 0 ? Number(((this.hits / total) * 100).toFixed(2)) : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatePercent,
      size: this.cache.size
    };
  }

  public static clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
