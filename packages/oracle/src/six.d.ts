/**
 * IroFi SIX Financial Data Client
 * Integrates with SIX Group — the hackathon's official data partner.
 * Provides FX rates and precious metal prices for African corridors.
 *
 * SIX covers African currencies with institutional-grade data:
 * NGN, KES, ZAR, GHS — used for corridor rate calculation.
 */
import type { SIXFXRate, SIXPreciousMetalPrice, SIXConfig } from "./types";
export declare class SIXClient {
    private readonly config;
    private cache;
    private readonly CACHE_TTL;
    constructor(config: SIXConfig);
    /**
     * Get FX rate for a currency pair.
     * e.g. getRate("USD", "NGN") → 1 USD = 1,580 NGN
     */
    getRate(baseCurrency: string, quoteCurrency: string): Promise<SIXFXRate | null>;
    /**
     * Get all corridor FX rates in a single batch call.
     * More efficient than individual getRate() calls.
     */
    getBatchRates(pairs: Array<{
        base: string;
        quote: string;
    }>): Promise<Map<string, SIXFXRate>>;
    /**
     * Get precious metal prices — relevant for RWA-Backed Stablecoin track
     * and as a store-of-value reference for African corridor pricing.
     */
    getPreciousMetalPrices(): Promise<SIXPreciousMetalPrice[]>;
    ping(): Promise<boolean>;
    clearCache(): void;
}
