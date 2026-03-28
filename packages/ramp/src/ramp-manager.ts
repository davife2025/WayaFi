/**
 * IroFi Ramp Manager
 * Central router for all on/off ramp operations.
 * Selects the best provider per corridor, handles failover,
 * and provides a unified interface for the API layer.
 */

import { YellowCardAdapter } from "./yellow-card";
import { BitnobAdapter } from "./bitnob";
import { MudaAdapter } from "./muda";
import { selectProvider } from "./types";
import type {
  RampAdapter, RampQuote, RampOrder, RampDirection,
  SupportedCurrency, RampProvider, RampWebhookEvent,
} from "./types";

export interface RampManagerConfig {
  yellow_card: { api_key: string; api_secret: string; environment: "sandbox" | "production" };
  bitnob:      { api_key: string; environment: "sandbox" | "production" };
  muda:        { api_key: string; api_secret: string; environment: "sandbox" | "production" };
}

export class RampManager {
  private adapters: Map<RampProvider, RampAdapter>;

  constructor(config: RampManagerConfig) {
    this.adapters = new Map([
      ["YELLOW_CARD", new YellowCardAdapter(config.yellow_card)],
      ["BITNOB",      new BitnobAdapter(config.bitnob)],
      ["MUDA",        new MudaAdapter(config.muda)],
    ]);
  }

  // ── Quote — best rate across providers ────────────────────────────────────

  /**
   * Get the best quote for a fiat/USDC ramp.
   * Queries all eligible providers and returns the best rate.
   */
  async getBestQuote(params: {
    direction: RampDirection;
    fiat_currency: SupportedCurrency;
    fiat_amount?: number;
    usdc_amount?: number;
  }): Promise<{ quote: RampQuote; provider: RampProvider } | null> {
    const eligibleProviders = [...this.adapters.entries()]
      .filter(([, adapter]) =>
        adapter.supportedCurrencies.includes(params.fiat_currency) &&
        adapter.supportedDirections.includes(params.direction)
      )
      .map(([provider]) => provider);

    const quotes = await Promise.allSettled(
      eligibleProviders.map(async (provider) => {
        const adapter = this.adapters.get(provider)!;
        const quote = await adapter.getQuote(params);
        return quote ? { quote, provider } : null;
      })
    );

    const validQuotes = quotes
      .filter((r): r is PromiseFulfilledResult<{ quote: RampQuote; provider: RampProvider } | null> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value!);

    if (!validQuotes.length) return null;

    // Select best quote: for ON ramps, max net_usdc. For OFF ramps, max net_fiat.
    return validQuotes.reduce((best, current) => {
      const bestVal = params.direction === "ON" ? best.quote.net_usdc : best.quote.net_fiat;
      const currVal = params.direction === "ON" ? current.quote.net_usdc : current.quote.net_fiat;
      return currVal > bestVal ? current : best;
    });
  }

  /**
   * Get all quotes across providers for comparison.
   */
  async getAllQuotes(params: {
    direction: RampDirection;
    fiat_currency: SupportedCurrency;
    fiat_amount?: number;
    usdc_amount?: number;
  }): Promise<Array<{ quote: RampQuote; provider: RampProvider }>> {
    const eligibleProviders = [...this.adapters.entries()]
      .filter(([, adapter]) =>
        adapter.supportedCurrencies.includes(params.fiat_currency) &&
        adapter.supportedDirections.includes(params.direction)
      );

    const results = await Promise.allSettled(
      eligibleProviders.map(async ([provider, adapter]) => {
        const quote = await adapter.getQuote(params);
        return quote ? { quote, provider } : null;
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<{ quote: RampQuote; provider: RampProvider } | null> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value!);
  }

  // ── Order Management ──────────────────────────────────────────────────────

  async createOrder(params: {
    provider: RampProvider;
    quote_id: string;
    wallet_address: string;
    payment_method_id: string;
    institution_id: string;
  }): Promise<RampOrder> {
    const adapter = this.adapters.get(params.provider);
    if (!adapter) throw new Error(`Unknown provider: ${params.provider}`);
    return adapter.createOrder(params);
  }

  async getOrderStatus(provider: RampProvider, order_id: string): Promise<RampOrder> {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`Unknown provider: ${provider}`);
    return adapter.getOrderStatus(order_id);
  }

  // ── Webhook Routing ───────────────────────────────────────────────────────

  /**
   * Route an incoming webhook to the correct adapter for verification + parsing.
   * Called by the API's /v1/ramp/webhook/:provider endpoint.
   */
  handleWebhook(
    provider: RampProvider,
    payload: string,
    signature: string
  ): RampWebhookEvent {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`Unknown provider: ${provider}`);

    const valid = adapter.verifyWebhook(payload, signature);
    if (!valid) throw new Error(`Invalid webhook signature for ${provider}`);

    return adapter.parseWebhook(payload);
  }
}
