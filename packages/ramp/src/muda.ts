/**
 * Muda Adapter — East Africa (KES, UGX, TZS)
 * Kenya, Uganda, Tanzania. Strong M-Pesa integration.
 * Docs: https://docs.muda.africa
 */

import { createHmac } from "crypto";
import type {
  RampAdapter, RampQuote, RampOrder, RampWebhookEvent,
  SupportedCurrency, RampDirection, RampOrderStatus,
} from "./types";

interface MudaConfig {
  api_key: string;
  api_secret: string;
  environment: "sandbox" | "production";
}

const MUDA_BASE_URL = {
  sandbox: "https://sandbox-api.muda.africa/v1",
  production: "https://api.muda.africa/v1",
};

export class MudaAdapter implements RampAdapter {
  provider = "MUDA" as const;
  supportedCurrencies: SupportedCurrency[] = ["KES", "UGX", "TZS"];
  supportedDirections: RampDirection[] = ["ON", "OFF"];

  private baseUrl: string;

  constructor(private config: MudaConfig) {
    this.baseUrl = MUDA_BASE_URL[config.environment];
  }

  async getQuote(params: {
    direction: RampDirection;
    fiat_currency: SupportedCurrency;
    fiat_amount?: number;
    usdc_amount?: number;
  }): Promise<RampQuote | null> {
    if (!this.supportedCurrencies.includes(params.fiat_currency)) return null;

    try {
      const res = await fetch(`${this.baseUrl}/quotes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.api_key,
        },
        body: JSON.stringify({
          from_currency: params.direction === "ON" ? params.fiat_currency : "USDC",
          to_currency: params.direction === "ON" ? "USDC" : params.fiat_currency,
          amount: params.fiat_amount ?? params.usdc_amount,
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      return this.parseQuote(data, params.direction, params.fiat_currency);
    } catch { return null; }
  }

  async createOrder(params: {
    quote_id: string;
    wallet_address: string;
    payment_method_id: string;
    institution_id: string;
  }): Promise<RampOrder> {
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.config.api_key,
      },
      body: JSON.stringify({
        quote_id: params.quote_id,
        destination_address: params.wallet_address,
        payment_method: params.payment_method_id,
        client_reference: params.institution_id,
      }),
    });

    if (!res.ok) throw new Error(`[Muda] Create order failed: ${res.status}`);
    return this.parseOrder(await res.json());
  }

  async getOrderStatus(order_id: string): Promise<RampOrder> {
    const res = await fetch(`${this.baseUrl}/orders/${order_id}`, {
      headers: { "X-API-Key": this.config.api_key },
    });
    if (!res.ok) throw new Error(`[Muda] Get order failed: ${res.status}`);
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
      provider: "MUDA",
      order_id: data.client_reference ?? data.id,
      provider_reference: data.id,
      status: this.mapStatus(data.status),
      timestamp: data.updated_at ?? new Date().toISOString(),
      raw_payload: data,
    };
  }

  private parseQuote(data: any, direction: RampDirection, currency: SupportedCurrency): RampQuote {
    const expiresAt = new Date(data.expires_at ?? Date.now() + 10 * 60 * 1000);
    return {
      provider: "MUDA",
      direction,
      fiat_currency: currency,
      fiat_amount: data.from_amount,
      usdc_amount: data.to_amount,
      exchange_rate: data.rate,
      fee_fiat: data.fee ?? 0,
      fee_usdc: 0,
      net_usdc: data.to_amount,
      net_fiat: data.from_amount - (data.fee ?? 0),
      quote_id: data.id,
      expires_at: expiresAt,
      payment_methods: [{
        id: "mpesa",
        type: "mobile_money",
        name: "M-Pesa",
        currency,
        min_amount: 100,
        max_amount: 300_000,
        processing_time_minutes: 5,
      }, {
        id: "bank_transfer_ke",
        type: "bank_transfer",
        name: "Kenya Bank Transfer",
        currency,
        min_amount: 1_000,
        max_amount: 5_000_000,
        processing_time_minutes: 60,
      }],
    };
  }

  private parseOrder(data: any): RampOrder {
    return {
      id: data.client_reference ?? data.id,
      provider: "MUDA",
      direction: data.from_currency === "USDC" ? "OFF" : "ON",
      status: this.mapStatus(data.status),
      quote_id: data.quote_id ?? "",
      fiat_currency: (data.from_currency !== "USDC" ? data.from_currency : data.to_currency) as SupportedCurrency,
      fiat_amount: data.from_amount ?? 0,
      usdc_amount: data.to_amount ?? 0,
      wallet_address: data.destination_address ?? "",
      payment_reference: data.payment_reference ?? data.id,
      provider_reference: data.id,
      created_at: new Date(data.created_at ?? Date.now()),
      completed_at: data.completed_at ? new Date(data.completed_at) : undefined,
    };
  }

  private mapStatus(status: string): RampOrderStatus {
    const map: Record<string, RampOrderStatus> = {
      created: "pending",
      awaiting_payment: "payment_pending",
      payment_received: "payment_received",
      processing: "processing",
      completed: "completed",
      failed: "failed",
    };
    return map[status] ?? "pending";
  }
}
