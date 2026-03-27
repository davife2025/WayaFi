/**
 * IroFi FX Rate Engine
 * Combines Pyth + SIX data into corridor rates.
 * Implements rate-triggered routing — transfers auto-execute when
 * FX rate hits institution-defined thresholds.
 * Detects stale feeds, spread spikes, and triggers alerts.
 */

import { PythClient } from "./pyth";
import { SIXClient } from "./six";
import type {
  CorridorFXRate, CorridorId, FXRateAlert, OracleHealthStatus,
  SIXConfig, CORRIDOR_CURRENCIES, PYTH_FEED_IDS,
} from "./types";

const { CORRIDOR_CURRENCIES, PYTH_FEED_IDS } = require("./types");

// ── Rate Alert Thresholds ──────────────────────────────────────────────────

const SPREAD_SPIKE_THRESHOLD_BPS = 200; // alert if spread > 200 bps
const STALE_RATE_AGE_SECONDS = 300;     // alert if rate > 5 min old

// ── FX Engine ─────────────────────────────────────────────────────────────

export class FXRateEngine {
  private pyth: PythClient;
  private six: SIXClient;
  private rateCache = new Map<CorridorId, CorridorFXRate>();
  private alertCallbacks: Array<(alert: FXRateAlert) => void> = [];
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    pythNetwork: "mainnet" | "devnet",
    sixConfig: SIXConfig
  ) {
    this.pyth = new PythClient(pythNetwork);
    this.six = new SIXClient(sixConfig);
  }

  // ── Corridor Rate Calculation ───────────────────────────────────────────

  /**
   * Get the current FX rate for a corridor.
   * Tries SIX first (institutional grade), falls back to Pyth.
   */
  async getCorridorRate(corridor: CorridorId): Promise<CorridorFXRate | null> {
    const currencies = (CORRIDOR_CURRENCIES as any)[corridor] as { sender: string; receiver: string };

    // Try SIX first — more accurate for African fiat
    const [senderRate, receiverRate] = await Promise.all([
      this.six.getRate("USD", currencies.sender),
      this.six.getRate("USD", currencies.receiver),
    ]);

    if (senderRate && receiverRate) {
      const rate = this.buildCorridorRate(
        corridor, currencies, senderRate, receiverRate, "SIX"
      );
      this.rateCache.set(corridor, rate);
      this.checkAlerts(rate);
      return rate;
    }

    // Fall back to Pyth
    const pythFeeds = (PYTH_FEED_IDS as any);
    const senderFeedId = pythFeeds[`${currencies.sender}/USD`]?.feed_id;
    const receiverFeedId = pythFeeds[`${currencies.receiver}/USD`]?.feed_id;

    if (!senderFeedId || !receiverFeedId) {
      console.warn(`[FXEngine] No price feed for ${corridor}`);
      return null;
    }

    const [senderPyth, receiverPyth] = await Promise.all([
      this.pyth.getPrice(senderFeedId, 300),
      this.pyth.getPrice(receiverFeedId, 300),
    ]);

    if (!senderPyth || !receiverPyth) {
      console.warn(`[FXEngine] Pyth fallback failed for ${corridor}`);
      return this.rateCache.get(corridor) ?? null; // return stale if available
    }

    // Convert: Pyth gives X/USD so 1 USD = 1 / price X
    const syntheticSenderRate = {
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

    const syntheticReceiverRate = {
      ...syntheticSenderRate,
      quote_currency: currencies.receiver,
      rate: 1 / receiverPyth.price,
      bid: 1 / (receiverPyth.price + receiverPyth.confidence),
      ask: 1 / (receiverPyth.price - receiverPyth.confidence),
      mid: 1 / receiverPyth.price,
    };

    const rate = this.buildCorridorRate(
      corridor, currencies, syntheticSenderRate, syntheticReceiverRate, "PYTH"
    );
    this.rateCache.set(corridor, rate);
    this.checkAlerts(rate);
    return rate;
  }

  /**
   * Get rates for all corridors in parallel.
   */
  async getAllCorridorRates(): Promise<Map<CorridorId, CorridorFXRate>> {
    const corridors: CorridorId[] = ["NG_KE", "NG_ZA", "NG_GH", "KE_ZA", "KE_GH"];

    // Batch SIX request for all unique currency pairs
    const uniquePairs = new Set<string>();
    for (const c of corridors) {
      const cur = (CORRIDOR_CURRENCIES as any)[c] as { sender: string; receiver: string };
      uniquePairs.add(`USD/${cur.sender}`);
      uniquePairs.add(`USD/${cur.receiver}`);
    }

    await this.six.getBatchRates(
      [...uniquePairs].map((p) => {
        const [base, quote] = p.split("/");
        return { base: base!, quote: quote! };
      })
    );

    const results = new Map<CorridorId, CorridorFXRate>();
    await Promise.all(
      corridors.map(async (corridor) => {
        const rate = await this.getCorridorRate(corridor);
        if (rate) results.set(corridor, rate);
      })
    );

    return results;
  }

  // ── Rate-Triggered Routing ──────────────────────────────────────────────

  /**
   * Check if a transfer should execute based on FX rate threshold.
   * Institutions set a minimum acceptable rate — transfer holds until met.
   */
  async evaluateRateThreshold(params: {
    corridor: CorridorId;
    amount_usdc: number;
    target_rate: number;     // minimum acceptable implied rate
    tolerance_bps: number;   // e.g. 50 = allow 0.5% below target
  }): Promise<{ should_execute: boolean; current_rate: number; reason: string }> {
    const rate = await this.getCorridorRate(params.corridor);

    if (!rate) {
      return {
        should_execute: false,
        current_rate: 0,
        reason: "FX rate unavailable — cannot evaluate threshold",
      };
    }

    if (rate.is_stale) {
      return {
        should_execute: false,
        current_rate: rate.implied_rate,
        reason: "FX rate is stale — holding transfer for fresh data",
      };
    }

    const toleranceFactor = 1 - params.tolerance_bps / 10_000;
    const effectiveThreshold = params.target_rate * toleranceFactor;

    if (rate.implied_rate >= effectiveThreshold) {
      return {
        should_execute: true,
        current_rate: rate.implied_rate,
        reason: `Rate ${rate.implied_rate.toFixed(4)} meets threshold ${params.target_rate.toFixed(4)} (±${params.tolerance_bps}bps)`,
      };
    }

    return {
      should_execute: false,
      current_rate: rate.implied_rate,
      reason: `Rate ${rate.implied_rate.toFixed(4)} below threshold ${effectiveThreshold.toFixed(4)}`,
    };
  }

  // ── Polling ─────────────────────────────────────────────────────────────

  startPolling(intervalMs = 30_000) {
    if (this.pollingInterval) return;
    this.pollingInterval = setInterval(async () => {
      await this.getAllCorridorRates();
    }, intervalMs);
    console.log(`[FXEngine] Polling started every ${intervalMs / 1000}s`);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // ── Alerts ──────────────────────────────────────────────────────────────

  onAlert(callback: (alert: FXRateAlert) => void) {
    this.alertCallbacks.push(callback);
  }

  private checkAlerts(rate: CorridorFXRate) {
    if (rate.is_stale) {
      this.emit({
        corridor: rate.corridor,
        alert_type: "rate_stale",
        current_rate: rate.implied_rate,
        message: `FX rate for ${rate.corridor} is stale (>${STALE_RATE_AGE_SECONDS}s old)`,
        triggered_at: new Date(),
      });
    }

    if (rate.spread_bps > SPREAD_SPIKE_THRESHOLD_BPS) {
      this.emit({
        corridor: rate.corridor,
        alert_type: "spread_spike",
        current_rate: rate.implied_rate,
        message: `Spread spike on ${rate.corridor}: ${rate.spread_bps}bps (threshold: ${SPREAD_SPIKE_THRESHOLD_BPS}bps)`,
        triggered_at: new Date(),
      });
    }
  }

  private emit(alert: FXRateAlert) {
    for (const cb of this.alertCallbacks) cb(alert);
  }

  // ── Health ───────────────────────────────────────────────────────────────

  async getHealthStatus(): Promise<OracleHealthStatus> {
    const [sixOnline] = await Promise.all([this.six.ping()]);
    const corridors: CorridorId[] = ["NG_KE", "NG_ZA", "NG_GH", "KE_ZA", "KE_GH"];

    const corridorStatus: OracleHealthStatus["corridors"] = {} as any;
    for (const c of corridors) {
      const cached = this.rateCache.get(c);
      const ageSeconds = cached
        ? Math.round((Date.now() - cached.fetched_at.getTime()) / 1000)
        : 9999;
      corridorStatus[c] = {
        rate_available: !!cached,
        is_stale: ageSeconds > STALE_RATE_AGE_SECONDS,
        age_seconds: ageSeconds,
      };
    }

    return {
      pyth: { online: true, last_update: new Date(), feeds_active: 5 },
      six: { online: sixOnline, last_update: sixOnline ? new Date() : null },
      corridors: corridorStatus,
    };
  }

  // ── Helper ───────────────────────────────────────────────────────────────

  private buildCorridorRate(
    corridor: CorridorId,
    currencies: { sender: string; receiver: string },
    senderRate: any,
    receiverRate: any,
    source: "SIX" | "PYTH"
  ): CorridorFXRate {
    // implied: 1 sender_currency = ? receiver_currency
    // USD→sender: 1 USD = senderRate.mid sender
    // USD→receiver: 1 USD = receiverRate.mid receiver
    // so 1 sender = (receiverRate.mid / senderRate.mid) receiver
    const implied = receiverRate.mid / senderRate.mid;
    const spreadBps = Math.round(
      ((senderRate.spread_bps + receiverRate.spread_bps) / 2)
    );
    const ageSeconds = senderRate.timestamp
      ? (Date.now() - new Date(senderRate.timestamp).getTime()) / 1000
      : 0;

    return {
      corridor,
      sender_currency: currencies.sender,
      receiver_currency: currencies.receiver,
      usdc_to_sender: senderRate.mid,
      usdc_to_receiver: receiverRate.mid,
      implied_rate: implied,
      spread_bps: spreadBps,
      source: source === "SIX" ? "SIX" : "PYTH",
      confidence: source === "SIX" ? 0.98 : 0.90,
      fetched_at: new Date(),
      is_stale: ageSeconds > STALE_RATE_AGE_SECONDS,
    };
  }
}
