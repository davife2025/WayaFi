/**
 * IroFi Oracle & FX Types
 * Covers Pyth Network price feeds + SIX Financial data partner integration.
 */
export interface PythPriceFeed {
    feed_id: string;
    symbol: string;
    price: number;
    confidence: number;
    exponent: number;
    publish_time: number;
    ema_price: number;
    status: "trading" | "halted" | "unknown";
}
export interface PythFeedConfig {
    feed_id: string;
    symbol: string;
    max_age_seconds: number;
}
export declare const PYTH_FEED_IDS: Record<string, PythFeedConfig>;
export interface SIXFXRate {
    base_currency: string;
    quote_currency: string;
    rate: number;
    bid: number;
    ask: number;
    mid: number;
    spread_bps: number;
    source: string;
    timestamp: string;
    market_session: "open" | "closed" | "pre" | "post";
}
export interface SIXPreciousMetalPrice {
    metal: "XAU" | "XAG" | "XPT" | "XPD";
    price_usd: number;
    change_24h: number;
    timestamp: string;
}
export interface SIXConfig {
    api_key: string;
    base_url: string;
    timeout_ms: number;
}
export type CorridorId = "NG_KE" | "NG_ZA" | "NG_GH" | "KE_ZA" | "KE_GH";
export interface CorridorFXRate {
    corridor: CorridorId;
    sender_currency: string;
    receiver_currency: string;
    usdc_to_sender: number;
    usdc_to_receiver: number;
    implied_rate: number;
    spread_bps: number;
    source: "PYTH" | "SIX" | "COMBINED";
    confidence: number;
    fetched_at: Date;
    is_stale: boolean;
}
export declare const CORRIDOR_CURRENCIES: Record<CorridorId, {
    sender: string;
    receiver: string;
}>;
export interface FXRateAlert {
    corridor: CorridorId;
    alert_type: "rate_threshold_hit" | "rate_stale" | "spread_spike" | "feed_offline";
    current_rate: number;
    threshold_rate?: number;
    message: string;
    triggered_at: Date;
}
export interface OracleHealthStatus {
    pyth: {
        online: boolean;
        last_update: Date | null;
        feeds_active: number;
    };
    six: {
        online: boolean;
        last_update: Date | null;
    };
    corridors: Record<CorridorId, {
        rate_available: boolean;
        is_stale: boolean;
        age_seconds: number;
    }>;
}
