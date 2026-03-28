/**
 * Bitnob Adapter — West Africa (NGN, GHS)
 * Nigeria and Ghana focused. Strong mobile money coverage.
 * Docs: https://developers.bitnob.com
 */
import type { RampAdapter, RampQuote, RampOrder, RampWebhookEvent, SupportedCurrency, RampDirection } from "./types";
interface BitnobConfig {
    api_key: string;
    environment: "sandbox" | "production";
}
export declare class BitnobAdapter implements RampAdapter {
    private config;
    provider: "BITNOB";
    supportedCurrencies: SupportedCurrency[];
    supportedDirections: RampDirection[];
    private baseUrl;
    constructor(config: BitnobConfig);
    getQuote(params: {
        direction: RampDirection;
        fiat_currency: SupportedCurrency;
        fiat_amount?: number;
        usdc_amount?: number;
    }): Promise<RampQuote | null>;
    createOrder(params: {
        quote_id: string;
        wallet_address: string;
        payment_method_id: string;
        institution_id: string;
    }): Promise<RampOrder>;
    getOrderStatus(order_id: string): Promise<RampOrder>;
    verifyWebhook(payload: string, signature: string): boolean;
    parseWebhook(payload: string): RampWebhookEvent;
    private parseQuote;
    private parseOrder;
    private mapStatus;
}
export {};
