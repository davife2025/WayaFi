/**
 * Muda Adapter — East Africa (KES, UGX, TZS)
 * Kenya, Uganda, Tanzania. Strong M-Pesa integration.
 * Docs: https://docs.muda.africa
 */
import type { RampAdapter, RampQuote, RampOrder, RampWebhookEvent, SupportedCurrency, RampDirection } from "./types";
interface MudaConfig {
    api_key: string;
    api_secret: string;
    environment: "sandbox" | "production";
}
export declare class MudaAdapter implements RampAdapter {
    private config;
    provider: "MUDA";
    supportedCurrencies: SupportedCurrency[];
    supportedDirections: RampDirection[];
    private baseUrl;
    constructor(config: MudaConfig);
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
