/**
 * Yellow Card Adapter
 * Pan-African ramp provider — Nigeria, Kenya, Ghana, South Africa, Uganda.
 * Processes over $225M in stablecoin settlements (June 2025).
 * Docs: https://docs.yellowcard.io
 */
import type { RampAdapter, RampQuote, RampOrder, RampWebhookEvent, SupportedCurrency, RampDirection } from "./types";
interface YellowCardConfig {
    api_key: string;
    api_secret: string;
    environment: "sandbox" | "production";
}
export declare class YellowCardAdapter implements RampAdapter {
    private config;
    provider: "YELLOW_CARD";
    supportedCurrencies: SupportedCurrency[];
    supportedDirections: RampDirection[];
    private baseUrl;
    constructor(config: YellowCardConfig);
    private authHeaders;
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
    private currencyToCountry;
}
export {};
