import { SyntheticPaymentRecord } from './types.js';
import { FailureClass } from '@recoveryos/ai-diagnosis';

/**
 * Seeded Mulberry32 Pseudo-Random Number Generator.
 * Guarantees exact reproducibility across all runtime environments.
 */
class SeededRandom {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed >>> 0;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  public choice<T>(items: T[]): T {
    const idx = Math.floor(this.next() * items.length);
    return items[idx];
  }
}

interface FailureProfile {
  failureClass: FailureClass;
  errorCode: string;
  weight: number;
  baseRetrySuccessProb: number;
  baseLinkSuccessProb: number;
}

const FAILURE_PROFILES: FailureProfile[] = [
  {
    failureClass: 'INSUFFICIENT_FUNDS',
    errorCode: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
    weight: 35, // 35% of failure volume
    baseRetrySuccessProb: 0.45,
    baseLinkSuccessProb: 0.65
  },
  {
    failureClass: 'AUTHENTICATION_FAILED',
    errorCode: 'BAD_REQUEST_PAYMENT_OTP_INCORRECT',
    weight: 25, // 25% of failure volume
    baseRetrySuccessProb: 0.05, // Blind retries almost always fail on OTP/3DS
    baseLinkSuccessProb: 0.70  // Payment links work well because customer enters OTP
  },
  {
    failureClass: 'NETWORK_TIMEOUT',
    errorCode: 'GATEWAY_TIMEOUT',
    weight: 15, // 15% of failure volume
    baseRetrySuccessProb: 0.80, // High recovery if retried
    baseLinkSuccessProb: 0.50
  },
  {
    failureClass: 'GATEWAY_ERROR',
    errorCode: 'GATEWAY_ERROR',
    weight: 10, // 10% of failure volume
    baseRetrySuccessProb: 0.75,
    baseLinkSuccessProb: 0.55
  },
  {
    failureClass: 'EXPIRED_INSTRUMENT',
    errorCode: 'BAD_REQUEST_PAYMENT_CARD_EXPIRED',
    weight: 8, // 8% of failure volume
    baseRetrySuccessProb: 0.00, // 0% chance on blind retry
    baseLinkSuccessProb: 0.60  // Link allows user to update card
  },
  {
    failureClass: 'LIMIT_EXCEEDED',
    errorCode: 'BAD_REQUEST_PAYMENT_LIMIT_EXCEEDED',
    weight: 5, // 5% of failure volume
    baseRetrySuccessProb: 0.20,
    baseLinkSuccessProb: 0.65
  },
  {
    failureClass: 'SUSPECTED_FRAUD',
    errorCode: 'BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD',
    weight: 2, // 2% of failure volume
    baseRetrySuccessProb: 0.00, // Dangerous to retry
    baseLinkSuccessProb: 0.00
  }
];

export class SyntheticDatasetGenerator {
  /**
   * Generates a seeded, statistically realistic dataset of payment failure records.
   * Default count is 10,000 records.
   */
  public static generate(count: number = 10000, seed: number = 1337): SyntheticPaymentRecord[] {
    const rng = new SeededRandom(seed);
    const records: SyntheticPaymentRecord[] = [];

    // Pre-calculate cumulative weights
    const totalWeight = FAILURE_PROFILES.reduce((sum, p) => sum + p.weight, 0);

    for (let i = 1; i <= count; i++) {
      // 1. Pick failure profile by weighted distribution
      let r = rng.range(0, totalWeight);
      let selectedProfile = FAILURE_PROFILES[0];
      for (const profile of FAILURE_PROFILES) {
        if (r < profile.weight) {
          selectedProfile = profile;
          break;
        }
        r -= profile.weight;
      }

      // 2. Realistic monetary distribution (INR in paise)
      // Majority ₹500 - ₹5,000; minority high-value ₹10,000 - ₹50,000
      let amountInPaise: number;
      const amountRoll = rng.next();
      if (amountRoll < 0.70) {
        // ₹500 to ₹3,500
        amountInPaise = rng.intRange(500, 3500) * 100;
      } else if (amountRoll < 0.95) {
        // ₹3,500 to ₹10,000
        amountInPaise = rng.intRange(3500, 10000) * 100;
      } else {
        // High-ticket ₹10,000 to ₹50,000 (Requires manual approval by policy)
        amountInPaise = rng.intRange(10000, 50000) * 100;
      }

      // 3. Customer transaction history
      const totalPayments = rng.intRange(1, 20);
      const successfulPayments = rng.intRange(0, totalPayments);

      // 4. Communication consents
      const consent = {
        sms: rng.next() > 0.15, // 85% consent
        whatsapp: rng.next() > 0.60, // 40% consent
        marketing: rng.next() > 0.20 // 80% consent
      };

      // 5. Calculate nuanced ground truth probabilities
      // Customer history bonus: reliable customers recover faster
      const historyBonus = (successfulPayments / totalPayments) * 0.10;
      const retrySuccess = Math.min(1.0, Math.max(0.0, selectedProfile.baseRetrySuccessProb + historyBonus));
      const linkSuccess = Math.min(1.0, Math.max(0.0, selectedProfile.baseLinkSuccessProb + historyBonus));

      records.push({
        id: `synth_pay_${i.toString().padStart(6, '0')}`,
        amountInPaise,
        failureClass: selectedProfile.failureClass,
        errorCode: selectedProfile.errorCode,
        customerHistory: {
          totalPayments,
          successfulPayments
        },
        consent,
        groundTruth: {
          retrySuccessProbability: Number(retrySuccess.toFixed(3)),
          paymentLinkSuccessProbability: Number(linkSuccess.toFixed(3))
        }
      });
    }

    return records;
  }
}
