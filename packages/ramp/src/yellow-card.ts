/**
 * Yellow Card Adapter
 * Pan-African ramp provider — Nigeria, Kenya, Ghana, South Africa, Uganda.
 * Processes over $225M in stablecoin settlements (June 2025).
 * Docs: https://docs.yellowcard.io
 */

import { createHmac } from "crypto";
import type {
  RampAdapter, RampQuote, RampOrder, RampWebhookEvent,
  SupportedCurrency, RampDirection, RampOrderStatus,
} from "./types";

interface YellowCardConfig {
  api_key: string;
  api_secret: string;
  environment: "sandbox" | "production";
}

const YC_BASE_URL = {
  sandbox: "https://sandbox.yellowcard.io/api",
  production: "https://api.yellowcard.io",
};

export class YellowCardAdapter implements RampAdapter {
  provider = "YELLOW_CARD" as const;
  supportedCurrencies: SupportedCurrency[] = ["NGN", "KES", "ZAR", "GHS", "UGX"];
  supportedDirections: RampDirection[] = ["ON", "OFF"];

  private baseUrl: string;

  constructor(private config: YellowCardConfig) {
    this.baseUrl = YC_BASE_URL[config.environment];
  }

  private authHeaders(method: string, path: string, body: string = ""): HeadersInit {
    const timestamp = Date.now().toString();
    const message = `${timestamp}${method.toUpperCase()}${path}${body}`;
    const signature = createHmac("sha256", this.config.api_secret)
      .update(message).digest("hex");

    return {
      "Content-Type": "application/json",
      "YC-API-Key": this.config.api_key,
      "YC-Timestamp": timestamp,
      "YC-Signature": signature,
    };
  }

  async getQuote(params: {
    direction: RampDirection;
    fiat_currency: SupportedCurrency;
    fiat_amount?: number;
    usdc_amount?: number;
  }): Promise<RampQuote | null> {
    const path = "/v1/quotes";
    const body = JSON.stringify({
      currency: params.fiat_currency,
      country: this.currencyToCountry(params.fiat_currency),
      type: params.direction === "ON" ? "buy" : "sell",
      ...(params.fiat_amount ? { localAmount: params.fiat_amount } : {}),
      ...(params.usdc_amount ? { usdcAmount: params.usdc_amount } : {}),
    });

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: this.authHeaders("POST", path, body),
        body,
      });

      if (!res.ok) {
        console.error(`[YellowCard] Quote failed: ${res.status}`);
        return null;
      }

      const data = await res.json();
      return this.parseQuote(data, params.direction, params.fiat_currency);

    } catch (err) {
      console.error("[YellowCard] Quote error:", err);
      return null;
    }
  }

  async createOrder(params: {
    quote_id: string;
    wallet_address: string;
    payment_method_id: string;
    institution_id: string;
  }): Promise<RampOrder> {
    const path = "/v1/payments";
    const body = JSON.stringify({
      quoteId: params.quote_id,
      walletAddress: params.wallet_address,
      channelId: params.payment_method_id,
      externalId: params.institution_id,
    });

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.authHeaders("POST", path, body),
      body,
    });

    if (!res.ok) {
      throw new Error(`[YellowCard] Create order failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return this.parseOrder(data);
  }

  async getOrderStatus(order_id: string): Promise<RampOrder> {
    const path = `/v1/payments/${order_id}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.authHeaders("GET", path),
    });

    if (!res.ok) throw new Error(`[YellowCard] Get order failed: ${res.status}`);
    return this.parseOrder(await res.json());
  }

  verifyWebhook(payload: string, signature: string): boolean {
    const expected = createHmac("sha256", this.config.api_secret)
      .update(payload).digest("hex");
    return expected === signature;
  }

  parseWebhook(payload: string): RampWebhookEvent {
    const data = JSON.parse(payload);
    return {
      provider: "YELLOW_CARD",
      order_id: data.externalId ?? data.id,
      provider_reference: data.id,
      status: this.mapStatus(data.status),
      timestamp: data.timestamp ?? new Date().toISOString(),
      raw_payload: data,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private parseQuote(data: any, direction: RampDirection, currency: SupportedCurrency): RampQuote {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // YC quotes valid 5 min

    return {
      provider: "YELLOW_CARD",
      direction,
      fiat_currency: currency,
      fiat_amount: data.localAmount,
      usdc_amount: data.usdcAmount,
      exchange_rate: data.exchangeRate,
      fee_fiat: data.fees?.local ?? 0,
      fee_usdc: data.fees?.usdc ?? 0,
      net_usdc: direction === "ON" ? data.usdcAmount - (data.fees?.usdc ?? 0) : data.usdcAmount,
      net_fiat: direction === "OFF" ? data.localAmount - (data.fees?.local ?? 0) : data.localAmount,
      quote_id: data.quoteId ?? data.id,
      expires_at: expiresAt,
      payment_methods: (data.channels ?? []).map((ch: any) => ({
        id: ch.id,
        type: ch.type === "momo" ? "mobile_money" : "bank_transfer",
        name: ch.name,
        currency,
        min_amount: ch.minAmount ?? 100,
        max_amount: ch.maxAmount ?? 10_000_000,
        processing_time_minutes: ch.processingTime ?? 30,
      })),
    };
  }

  private parseOrder(data: any): RampOrder {
    return {
      id: data.externalId ?? data.id,
      provider: "YELLOW_CARD",
      direction: data.type === "buy" ? "ON" : "OFF",
      status: this.mapStatus(data.status),
      quote_id: data.quoteId,
      fiat_currency: data.currency as SupportedCurrency,
      fiat_amount: data.localAmount,
      usdc_amount: data.usdcAmount,
      wallet_address: data.walletAddress ?? "",
      payment_reference: data.paymentReference ?? data.id,
      provider_reference: data.id,
      created_at: new Date(data.createdAt ?? Date.now()),
      completed_at: data.completedAt ? new Date(data.completedAt) : undefined,
      failure_reason: data.failureReason,
    };
  }

  private mapStatus(ycStatus: string): RampOrderStatus {
    const map: Record<string, RampOrderStatus> = {
      pending: "pending",
      processing: "processing",
      success: "completed",
      failed: "failed",
      refunded: "refunded",
      awaiting_payment: "payment_pending",
      payment_received: "payment_received",
    };
    return map[ycStatus] ?? "pending";
  }

  private currencyToCountry(currency: SupportedCurrency): string {
    const map: Record<SupportedCurrency, string> = {
      NGN: "NG", KES: "KE", ZAR: "ZA", GHS: "GH", UGX: "UG", TZS: "TZ",
    };
    return map[currency] ?? "NG";
  }
}
