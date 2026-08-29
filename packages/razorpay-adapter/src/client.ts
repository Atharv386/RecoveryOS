import { RazorpayPaymentDetails, PaymentLinkResult } from './types.js';

export interface RazorpayClientConfig {
  keyId: string;
  keySecret: string;
  baseUrl?: string;
}

export class RazorpayAdapterClient {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly baseUrl: string;

  constructor(config: RazorpayClientConfig) {
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
    this.baseUrl = config.baseUrl ?? 'https://api.razorpay.com/v1';
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  /**
   * Fetches the authoritative payment status directly from Razorpay.
   */
  public async fetchPayment(paymentId: string): Promise<RazorpayPaymentDetails> {
    const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay API Error (${response.status}): ${errorBody}`);
    }

    return (await response.json()) as RazorpayPaymentDetails;
  }

  /**
   * Creates a bounded Razorpay Payment Link for alternative payment method collection.
   */
  public async createPaymentLink(params: {
    amountInPaise: number;
    currency: string;
    description: string;
    customer: {
      name?: string;
      email?: string;
      contact?: string;
    };
    referenceId: string;
    expireBySeconds?: number;
  }): Promise<PaymentLinkResult> {
    const response = await fetch(`${this.baseUrl}/payment_links`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: params.amountInPaise,
        currency: params.currency,
        description: params.description,
        customer: params.customer,
        reference_id: params.referenceId,
        expire_by: params.expireBySeconds ?? Math.floor(Date.now() / 1000) + 86400 // Default 24h
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay Payment Link Creation Failed (${response.status}): ${errorBody}`);
    }

    return (await response.json()) as PaymentLinkResult;
  }
}
