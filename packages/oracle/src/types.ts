/**
 * IroFi Oracle & FX Types
 * Covers Pyth Network price feeds + SIX Financial data partner integration.
 */

// ── Pyth Price Feed ────────────────────────────────────────────────────────

export interface PythPriceFeed {
  feed_id: string;            // Pyth feed ID (hex)
  symbol: string;             // e.g. "USDC/USD"
  price: number;              // price in USD
  confidence: number;         // confidence interval ± USD
  exponent: number;           // price = raw_price * 10^exponent
  publish_time: number;       // unix timestamp
  ema_price: number;          // exponential moving average
  status: "trading" | "halted" | "unknown";
}

export interface PythFeedConfig {
  feed_id: string;
  symbol: string;
  max_age_seconds: number;    // reject stale prices older than this
}

// Pyth feed IDs for IroFi corridors (devnet + mainnet)
export const PYTH_FEED_IDS: Record<string, PythFeedConfig> = {
  "USDC/USD": {
    feed_id: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    symbol: "USDC/USD",
    max_age_seconds: 60,
  },
  "NGN/USD": {
    feed_id: "0x7d7f4bb0cba7ee4c4f8122ddffcae55d1a97f5af0c2eb5d16b1c6b0abe7a99b",
    symbol: "NGN/USD",
    max_age_seconds: 300,
  },
  "KES/USD": {
    feed_id: "0x40a09fb7e7796c2bcd0e72f0f90af6c2e9b8f6a4b7c2e1d3f8a5b9c6e4d2f1a",
    symbol: "KES/USD",
    max_age_seconds: 300,
  },
  "ZAR/USD": {
    feed_id: "0x389d153da4f8af49f36c5c66cf21b9c0b37ef8f9f5c3e2d1a6b8c4f7e9d0a2b",
    symbol: "ZAR/USD",
    max_age_seconds: 300,
  },
  "GHS/USD": {
    feed_id: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    symbol: "GHS/USD",
    max_age_seconds: 300,
  },
};

// ── SIX Financial Data ─────────────────────────────────────────────────────

export interface SIXFXRate {
  base_currency: string;      // e.g. "USD"
  quote_currency: string;     // e.g. "NGN"
  rate: number;               // 1 USD = rate NGN
  bid: number;
  ask: number;
  mid: number;
  spread_bps: number;         // bid-ask spread in basis points
  source: string;             // e.g. "SIX_FINANCIAL"
  timestamp: string;          // ISO 8601
  market_session: "open" | "closed" | "pre" | "post";
}

export interface SIXPreciousMetalPrice {
  metal: "XAU" | "XAG" | "XPT" | "XPD"; // Gold, Silver, Platinum, Palladium
  price_usd: number;          // troy ounce price in USD
  change_24h: number;         // % change
  timestamp: string;
}

export interface SIXConfig {
  api_key: string;
  base_url: string;           // e.g. https://api.six-group.com/api/findata/v1
  timeout_ms: number;
}

// ── Corridor FX Rates ──────────────────────────────────────────────────────

export type CorridorId = "NG_KE" | "NG_ZA" | "NG_GH" | "KE_ZA" | "KE_GH";

export interface CorridorFXRate {
  corridor: CorridorId;
  sender_currency: string;    // e.g. "NGN"
  receiver_currency: string;  // e.g. "KES"
  usdc_to_sender: number;     // 1 USDC = X sender currency
  usdc_to_receiver: number;   // 1 USDC = X receiver currency
  implied_rate: number;       // sender → receiver implied cross-rate
  spread_bps: number;
  source: "PYTH" | "SIX" | "COMBINED";
  confidence: number;         // 0–1
  fetched_at: Date;
  is_stale: boolean;
}

// Currency map per corridor
export const CORRIDOR_CURRENCIES: Record<CorridorId, { sender: string; receiver: string }> = {
  NG_KE: { sender: "NGN", receiver: "KES" },
  NG_ZA: { sender: "NGN", receiver: "ZAR" },
  NG_GH: { sender: "NGN", receiver: "GHS" },
  KE_ZA: { sender: "KES", receiver: "ZAR" },
  KE_GH: { sender: "KES", receiver: "GHS" },
};

// ── FX Rate Alert ──────────────────────────────────────────────────────────

export interface FXRateAlert {
  corridor: CorridorId;
  alert_type: "rate_threshold_hit" | "rate_stale" | "spread_spike" | "feed_offline";
  current_rate: number;
  threshold_rate?: number;
  message: string;
  triggered_at: Date;
}

// ── Oracle Health ──────────────────────────────────────────────────────────

export interface OracleHealthStatus {
  pyth: { online: boolean; last_update: Date | null; feeds_active: number };
  six: { online: boolean; last_update: Date | null };
  corridors: Record<CorridorId, { rate_available: boolean; is_stale: boolean; age_seconds: number }>;
}
