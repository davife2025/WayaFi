/**
 * Bitnob Adapter — West Africa (NGN, GHS)
 * Nigeria and Ghana focused. Strong mobile money coverage.
 * Docs: https://developers.bitnob.com
 */

import { createHmac } from "crypto";
import type {
  RampAdapter, RampQuote, RampOrder, RampWebhookEvent,
  SupportedCurrency, RampDirection, RampOrderStatus,
} from "./types";

interface BitnobConfig {
  api_key: string;
  environment: "sandbox" | "production";
}

const BITNOB_BASE_URL = {
  sandbox: "https://sandboxapi.bitnob.com/api/v1",
  production: "https://api.bitnob.com/api/v1",
};

export class BitnobAdapter implements RampAdapter {
  provider = "BITNOB" as const;
  supportedCurrencies: SupportedCurrency[] = ["NGN", "GHS"];
  supportedDirections: RampDirection[] = ["ON", "OFF"];

  private baseUrl: string;

  constructor(private config: BitnobConfig) {
    this.baseUrl = BITNOB_BASE_URL[config.environment];
  }

  async getQuote(params: {
    direction: RampDirection;
    fiat_currency: SupportedCurrency;
    fiat_amount?: number;
    usdc_amount?: number;
  }): Promise<RampQuote | null> {
    if (!this.supportedCurrencies.includes(params.fiat_currency)) return null;

    try {
      const res = await fetch(`${this.baseUrl}/offramp/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.api_key}`,
        },
        body: JSON.stringify({
          currency: params.fiat_currency,
          amount: params.usdc_amount ?? (params.fiat_amount! / 1500), // rough NGN/USDC
          type: params.direction === "ON" ? "buy" : "sell",
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      return this.parseQuote(data.data ?? data, params.direction, params.fiat_currency);
    } catch { return null; }
  }

  async createOrder(params: {
    quote_id: string;
    wallet_address: string;
    payment_method_id: string;
    institution_id: string;
  }): Promise<RampOrder> {
    const res = await fetch(`${this.baseUrl}/offramp/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.api_key}`,
      },
      body: JSON.stringify({
        quoteId: params.quote_id,
        address: params.wallet_address,
        reference: params.institution_id,
      }),
    });

    if (!res.ok) throw new Error(`[Bitnob] Create order failed: ${res.status}`);
    const data = await res.json();
    return this.parseOrder(data.data ?? data);
  }

  async getOrderStatus(order_id: string): Promise<RampOrder> {
    const res = await fetch(`${this.baseUrl}/offramp/${order_id}`, {
      headers: { "Authorization": `Bearer ${this.config.api_key}` },
    });
    if (!res.ok) throw new Error(`[Bitnob] Get order failed: ${res.status}`);
    const data = await res.json();
    return this.parseOrder(data.data ?? data);
  }

  verifyWebhook(payload: string, signature: string): boolean {
    const expected = createHmac("sha256", this.config.api_key)
      .update(payload).digest("hex");
    return `sha256=${expected}` === signature;
  }

  parseWebhook(payload: string): RampWebhookEvent {
    const data = JSON.parse(payload);
    return {
      provider: "BITNOB",
      order_id: data.reference ?? data.id,
      provider_reference: data.id,
      status: this.mapStatus(data.status),
      timestamp: data.createdAt ?? new Date().toISOString(),
      raw_payload: data,
    };
  }

  private parseQuote(data: any, direction: RampDirection, currency: SupportedCurrency): RampQuote {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    return {
      provider: "BITNOB",
      direction,
      fiat_currency: currency,
      fiat_amount: data.localAmount ?? data.amount * data.rate,
      usdc_amount: data.usdcAmount ?? data.amount,
      exchange_rate: data.rate ?? data.exchangeRate,
      fee_fiat: data.fee ?? 0,
      fee_usdc: 0,
      net_usdc: data.usdcAmount ?? data.amount,
      net_fiat: (data.localAmount ?? 0) - (data.fee ?? 0),
      quote_id: data.id ?? data.quoteId,
      expires_at: expiresAt,
      payment_methods: [{
        id: "bank_transfer_ng",
        type: "bank_transfer",
        name: currency === "NGN" ? "Nigerian Bank Transfer" : "Ghana Bank Transfer",
        currency,
        min_amount: 100,
        max_amount: 5_000_000,
        processing_time_minutes: 20,
      }],
    };
  }

  private parseOrder(data: any): RampOrder {
    return {
      id: data.reference ?? data.id,
      provider: "BITNOB",
      direction: "OFF",
      status: this.mapStatus(data.status),
      quote_id: data.quoteId ?? "",
      fiat_currency: (data.currency ?? "NGN") as SupportedCurrency,
      fiat_amount: data.localAmount ?? 0,
      usdc_amount: data.usdcAmount ?? 0,
      wallet_address: data.address ?? "",
      payment_reference: data.paymentReference ?? data.id,
      provider_reference: data.id,
      created_at: new Date(data.createdAt ?? Date.now()),
      completed_at: data.completedAt ? new Date(data.completedAt) : undefined,
      failure_reason: data.failureReason,
    };
  }

  private mapStatus(status: string): RampOrderStatus {
    const map: Record<string, RampOrderStatus> = {
      pending: "pending",
      processing: "processing",
      completed: "completed",
      success: "completed",
      failed: "failed",
      cancelled: "failed",
    };
    return map[status] ?? "pending";
  }
}
