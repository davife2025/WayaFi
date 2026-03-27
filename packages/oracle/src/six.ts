/**
 * IroFi SIX Financial Data Client
 * Integrates with SIX Group — the hackathon's official data partner.
 * Provides FX rates and precious metal prices for African corridors.
 *
 * SIX covers African currencies with institutional-grade data:
 * NGN, KES, ZAR, GHS — used for corridor rate calculation.
 */

import type { SIXFXRate, SIXPreciousMetalPrice, SIXConfig, CorridorId, CORRIDOR_CURRENCIES } from "./types";

// ── SIX API Client ─────────────────────────────────────────────────────────

export class SIXClient {
  private cache = new Map<string, { data: any; cachedAt: number }>();
  private readonly CACHE_TTL = 30_000; // 30s — SIX updates every 30s

  constructor(private readonly config: SIXConfig) {}

  // ── FX Rates ────────────────────────────────────────────────────────────

  /**
   * Get FX rate for a currency pair.
   * e.g. getRate("USD", "NGN") → 1 USD = 1,580 NGN
   */
  async getRate(baseCurrency: string, quoteCurrency: string): Promise<SIXFXRate | null> {
    const cacheKey = `fx:${baseCurrency}:${quoteCurrency}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      return cached.data as SIXFXRate;
    }

    try {
      const url = `${this.config.base_url}/fx/rates?base=${baseCurrency}&quote=${quoteCurrency}`;
      const res = await fetch(url, {
        headers: {
          "Authorization": `ApiKey ${this.config.api_key}`,
          "Accept": "application/json",
          "X-Client-ID": "IroFi-Protocol",
        },
        signal: AbortSignal.timeout(this.config.timeout_ms),
      });

      if (!res.ok) {
        console.error(`[SIX] FX rate fetch failed: ${res.status} ${baseCurrency}/${quoteCurrency}`);
        return null;
      }

      const data = await res.json();
      const rate: SIXFXRate = {
        base_currency: baseCurrency,
        quote_currency: quoteCurrency,
        rate: data.rate ?? data.mid,
        bid: data.bid,
        ask: data.ask,
        mid: data.mid,
        spread_bps: data.bid && data.ask
          ? Math.round(((data.ask - data.bid) / data.mid) * 10_000)
          : 0,
        source: "SIX_FINANCIAL",
        timestamp: data.timestamp ?? new Date().toISOString(),
        market_session: data.market_session ?? "open",
      };

      this.cache.set(cacheKey, { data: rate, cachedAt: Date.now() });
      return rate;

    } catch (err) {
      console.error(`[SIX] Error fetching ${baseCurrency}/${quoteCurrency}:`, err);
      return null;
    }
  }

  /**
   * Get all corridor FX rates in a single batch call.
   * More efficient than individual getRate() calls.
   */
  async getBatchRates(pairs: Array<{ base: string; quote: string }>): Promise<Map<string, SIXFXRate>> {
    const result = new Map<string, SIXFXRate>();

    try {
      const pairsParam = pairs.map((p) => `${p.base}/${p.quote}`).join(",");
      const url = `${this.config.base_url}/fx/rates/batch?pairs=${pairsParam}`;

      const res = await fetch(url, {
        headers: {
          "Authorization": `ApiKey ${this.config.api_key}`,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(this.config.timeout_ms),
      });

      if (!res.ok) {
        console.error(`[SIX] Batch rate fetch failed: ${res.status}`);
        return result;
      }

      const data = await res.json();

      for (const item of data.rates ?? []) {
        const key = `${item.base_currency}/${item.quote_currency}`;
        const rate: SIXFXRate = {
          base_currency: item.base_currency,
          quote_currency: item.quote_currency,
          rate: item.mid,
          bid: item.bid,
          ask: item.ask,
          mid: item.mid,
          spread_bps: Math.round(((item.ask - item.bid) / item.mid) * 10_000),
          source: "SIX_FINANCIAL",
          timestamp: item.timestamp ?? new Date().toISOString(),
          market_session: item.market_session ?? "open",
        };
        result.set(key, rate);
        this.cache.set(`fx:${item.base_currency}:${item.quote_currency}`, {
          data: rate,
          cachedAt: Date.now(),
        });
      }

    } catch (err) {
      console.error("[SIX] Batch rates error:", err);
    }

    return result;
  }

  // ── Precious Metals ─────────────────────────────────────────────────────

  /**
   * Get precious metal prices — relevant for RWA-Backed Stablecoin track
   * and as a store-of-value reference for African corridor pricing.
   */
  async getPreciousMetalPrices(): Promise<SIXPreciousMetalPrice[]> {
    const cacheKey = "metals:all";
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      return cached.data as SIXPreciousMetalPrice[];
    }

    try {
      const url = `${this.config.base_url}/commodities/metals?symbols=XAU,XAG,XPT,XPD`;
      const res = await fetch(url, {
        headers: {
          "Authorization": `ApiKey ${this.config.api_key}`,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(this.config.timeout_ms),
      });

      if (!res.ok) return [];

      const data = await res.json();
      const metals: SIXPreciousMetalPrice[] = (data.metals ?? []).map((m: any) => ({
        metal: m.symbol,
        price_usd: m.price,
        change_24h: m.change_24h_pct,
        timestamp: m.timestamp ?? new Date().toISOString(),
      }));

      this.cache.set(cacheKey, { data: metals, cachedAt: Date.now() });
      return metals;

    } catch (err) {
      console.error("[SIX] Precious metals fetch failed:", err);
      return [];
    }
  }

  // ── Health Check ────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.base_url}/health`, {
        headers: { "Authorization": `ApiKey ${this.config.api_key}` },
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch { return false; }
  }

  clearCache() { this.cache.clear(); }
}
