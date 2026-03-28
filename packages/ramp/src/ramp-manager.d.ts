/**
 * IroFi Ramp Manager
 * Central router for all on/off ramp operations.
 * Selects the best provider per corridor, handles failover,
 * and provides a unified interface for the API layer.
 */
import type { RampQuote, RampOrder, RampDirection, SupportedCurrency, RampProvider, RampWebhookEvent } from "./types";
export interface RampManagerConfig {
    yellow_card: {
        api_key: string;
        api_secret: string;
        environment: "sandbox" | "production";
    };
    bitnob: {
        api_key: string;
        environment: "sandbox" | "production";
    };
    muda: {
        api_key: string;
        api_secret: string;
        environment: "sandbox" | "production";
    };
}
export declare class RampManager {
    private adapters;
    constructor(config: RampManagerConfig);
    /**
     * Get the best quote for a fiat/USDC ramp.
     * Queries all eligible providers and returns the best rate.
     */
    getBestQuote(params: {
        direction: RampDirection;
        fiat_currency: SupportedCurrency;
        fiat_amount?: number;
        usdc_amount?: number;
    }): Promise<{
        quote: RampQuote;
        provider: RampProvider;
    } | null>;
    /**
     * Get all quotes across providers for comparison.
     */
    getAllQuotes(params: {
        direction: RampDirection;
        fiat_currency: SupportedCurrency;
        fiat_amount?: number;
        usdc_amount?: number;
    }): Promise<Array<{
        quote: RampQuote;
        provider: RampProvider;
    }>>;
    createOrder(params: {
        provider: RampProvider;
        quote_id: string;
        wallet_address: string;
        payment_method_id: string;
        institution_id: string;
    }): Promise<RampOrder>;
    getOrderStatus(provider: RampProvider, order_id: string): Promise<RampOrder>;
    /**
     * Route an incoming webhook to the correct adapter for verification + parsing.
     * Called by the API's /v1/ramp/webhook/:provider endpoint.
     */
    handleWebhook(provider: RampProvider, payload: string, signature: string): RampWebhookEvent;
}
