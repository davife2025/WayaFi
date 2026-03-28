/**
 * IroFi FX Rate Engine
 * Combines Pyth + SIX into corridor rates with rate-triggered routing.
 */

import { PythClient } from "./pyth";
import { SIXClient } from "./six";
import {
  CORRIDOR_CURRENCIES,
  PYTH_FEED_IDS,
} from "./types";
import type {
  CorridorFXRate, CorridorId, FXRateAlert, OracleHealthStatus, SIXConfig,
} from "./types";

const SPREAD_SPIKE_THRESHOLD_BPS = 200;
const STALE_RATE_AGE_SECONDS = 300;

export class FXRateEngine {
  private pyth: PythClient;
  private six: SIXClient;
  private rateCache = new Map<CorridorId, CorridorFXRate>();
  private alertCallbacks: Array<(alert: FXRateAlert) => void> = [];
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(pythNetwork: "mainnet" | "devnet", sixConfig: SIXConfig) {
    this.pyth = new PythClient(pythNetwork);
    this.six = new SIXClient(sixConfig);
  }

  async getCorridorRate(corridor: CorridorId): Promise<CorridorFXRate | null> {
    const currencies = CORRIDOR_CURRENCIES[corridor];

    const [senderRate, receiverRate] = await Promise.all([
      this.six.getRate("USD", currencies.sender),
      this.six.getRate("USD", currencies.receiver),
    ]);

    if (senderRate && receiverRate) {
      const rate = this.buildCorridorRate(corridor, currencies, senderRate, receiverRate, "SIX");
      this.rateCache.set(corridor, rate);
      this.checkAlerts(rate);
      return rate;
    }

    // Pyth fallback
    const senderFeedConfig = PYTH_FEED_IDS[`${currencies.sender}/USD`];
    const receiverFeedConfig = PYTH_FEED_IDS[`${currencies.receiver}/USD`];

    if (!senderFeedConfig || !receiverFeedConfig) {
      console.warn(`[FXEngine] No price feed for ${corridor}`);
      return this.rateCache.get(corridor) ?? null;
    }

    const [senderPyth, receiverPyth] = await Promise.all([
      this.pyth.getPrice(senderFeedConfig.feed_id, 300),
      this.pyth.getPrice(receiverFeedConfig.feed_id, 300),
    ]);

    if (!senderPyth || !receiverPyth) {
      return this.rateCache.get(corridor) ?? null;
    }

    const syntheticSender = {
      base_currency: "USD",
      quote_currency: currencies.sender,
      rate: 1 / senderPyth.price,
      bid: 1 / (senderPyth.price + senderPyth.confidence),
      ask: 1 / (senderPyth.price - senderPyth.confidence),
      mid: 1 / senderPyth.price,
      spread_bps: 0,
      source: "SIX_FINANCIAL" as const,
      timestamp: new Date(senderPyth.publish_time * 1000).toISOString(),
      market_session: "open" as const,
    };
    const syntheticReceiver = {
      ...syntheticSender,
      quote_currency: currencies.receiver,
      rate: 1 / receiverPyth.price,
      bid: 1 / (receiverPyth.price + receiverPyth.confidence),
      ask: 1 / (receiverPyth.price - receiverPyth.confidence),
      mid: 1 / receiverPyth.price,
    };

    const rate = this.buildCorridorRate(corridor, currencies, syntheticSender, syntheticReceiver, "PYTH");
    this.rateCache.set(corridor, rate);
    this.checkAlerts(rate);
    return rate;
  }

  async getAllCorridorRates(): Promise<Map<CorridorId, CorridorFXRate>> {
    const corridors = Object.keys(CORRIDOR_CURRENCIES) as CorridorId[];
    const results = new Map<CorridorId, CorridorFXRate>();
    await Promise.all(
      corridors.map(async (corridor) => {
        const rate = await this.getCorridorRate(corridor);
        if (rate) results.set(corridor, rate);
      })
    );
    return results;
  }

  async evaluateRateThreshold(params: {
    corridor: CorridorId;
    amount_usdc: number;
    target_rate: number;
    tolerance_bps: number;
  }): Promise<{ should_execute: boolean; current_rate: number; reason: string }> {
    const rate = await this.getCorridorRate(params.corridor);
    if (!rate) return { should_execute: false, current_rate: 0, reason: "FX rate unavailable" };
    if (rate.is_stale) return { should_execute: false, current_rate: rate.implied_rate, reason: "FX rate is stale" };

    const effectiveThreshold = params.target_rate * (1 - params.tolerance_bps / 10_000);
    if (rate.implied_rate >= effectiveThreshold) {
      return {
        should_execute: true,
        current_rate: rate.implied_rate,
        reason: `Rate ${rate.implied_rate.toFixed(4)} meets threshold`,
      };
    }
    return {
      should_execute: false,
      current_rate: rate.implied_rate,
      reason: `Rate ${rate.implied_rate.toFixed(4)} below threshold ${effectiveThreshold.toFixed(4)}`,
    };
  }

  startPolling(intervalMs = 30_000) {
    if (this.pollingInterval) return;
    this.pollingInterval = setInterval(() => { this.getAllCorridorRates(); }, intervalMs);
  }

  stopPolling() {
    if (this.pollingInterval) { clearInterval(this.pollingInterval); this.pollingInterval = null; }
  }

  onAlert(callback: (alert: FXRateAlert) => void) { this.alertCallbacks.push(callback); }

  private checkAlerts(rate: CorridorFXRate) {
    if (rate.is_stale) this.emit({ corridor: rate.corridor, alert_type: "rate_stale", current_rate: rate.implied_rate, message: `Rate for ${rate.corridor} is stale`, triggered_at: new Date() });
    if (rate.spread_bps > SPREAD_SPIKE_THRESHOLD_BPS) this.emit({ corridor: rate.corridor, alert_type: "spread_spike", current_rate: rate.implied_rate, message: `Spread spike: ${rate.spread_bps}bps`, triggered_at: new Date() });
  }

  private emit(alert: FXRateAlert) { for (const cb of this.alertCallbacks) cb(alert); }

  async getHealthStatus(): Promise<OracleHealthStatus> {
    const sixOnline = await this.six.ping();
    const corridors = Object.keys(CORRIDOR_CURRENCIES) as CorridorId[];
    const corridorStatus: OracleHealthStatus["corridors"] = {} as OracleHealthStatus["corridors"];
    for (const c of corridors) {
      const cached = this.rateCache.get(c);
      const ageSeconds = cached ? Math.round((Date.now() - cached.fetched_at.getTime()) / 1000) : 9999;
      corridorStatus[c] = { rate_available: !!cached, is_stale: ageSeconds > STALE_RATE_AGE_SECONDS, age_seconds: ageSeconds };
    }
    return {
      pyth: { online: true, last_update: new Date(), feeds_active: 5 },
      six: { online: sixOnline, last_update: sixOnline ? new Date() : null },
      corridors: corridorStatus,
    };
  }

  private buildCorridorRate(
    corridor: CorridorId,
    currencies: { sender: string; receiver: string },
    senderRate: any,
    receiverRate: any,
    source: "SIX" | "PYTH"
  ): CorridorFXRate {
    const implied = receiverRate.mid / senderRate.mid;
    const spreadBps = Math.round((senderRate.spread_bps + receiverRate.spread_bps) / 2);
    const ageSeconds = senderRate.timestamp
      ? (Date.now() - new Date(senderRate.timestamp).getTime()) / 1000 : 0;
    return {
      corridor, sender_currency: currencies.sender, receiver_currency: currencies.receiver,
      usdc_to_sender: senderRate.mid, usdc_to_receiver: receiverRate.mid,
      implied_rate: implied, spread_bps: spreadBps,
      source: source as CorridorFXRate["source"],
      confidence: source === "SIX" ? 0.98 : 0.90,
      fetched_at: new Date(),
      is_stale: ageSeconds > STALE_RATE_AGE_SECONDS,
    };
  }
}
