/**
 * IroFi On/Off Ramp — Core Types
 * Pluggable adapter interface for local fiat providers.
 * Each corridor has its own adapter — Yellow Card, Bitnob, Muda.
 */
export type SupportedCurrency = "NGN" | "KES" | "ZAR" | "GHS" | "UGX" | "TZS";
export type RampProvider = "YELLOW_CARD" | "BITNOB" | "MUDA" | "FLUTTERWAVE";
export type RampDirection = "ON" | "OFF";
export interface RampQuote {
    provider: RampProvider;
    direction: RampDirection;
    fiat_currency: SupportedCurrency;
    fiat_amount: number;
    usdc_amount: number;
    exchange_rate: number;
    fee_fiat: number;
    fee_usdc: number;
    net_usdc: number;
    net_fiat: number;
    quote_id: string;
    expires_at: Date;
    payment_methods: PaymentMethod[];
}
export interface PaymentMethod {
    id: string;
    type: "bank_transfer" | "mobile_money" | "card" | "cash";
    name: string;
    currency: SupportedCurrency;
    min_amount: number;
    max_amount: number;
    processing_time_minutes: number;
}
export interface RampOrder {
    id: string;
    provider: RampProvider;
    direction: RampDirection;
    status: RampOrderStatus;
    quote_id: string;
    fiat_currency: SupportedCurrency;
    fiat_amount: number;
    usdc_amount: number;
    wallet_address: string;
    payment_reference: string;
    provider_reference: string;
    created_at: Date;
    completed_at?: Date;
    failure_reason?: string;
    metadata?: Record<string, unknown>;
}
export type RampOrderStatus = "pending" | "payment_pending" | "payment_received" | "processing" | "completed" | "failed" | "refunded";
export interface RampWebhookEvent {
    provider: RampProvider;
    order_id: string;
    provider_reference: string;
    status: RampOrderStatus;
    timestamp: string;
    raw_payload: Record<string, unknown>;
}
/**
 * Every ramp provider implements this interface.
 * Adding a new corridor = implementing this interface + registering adapter.
 */
export interface RampAdapter {
    provider: RampProvider;
    supportedCurrencies: SupportedCurrency[];
    supportedDirections: RampDirection[];
    /** Get a quote for a ramp transaction */
    getQuote(params: {
        direction: RampDirection;
        fiat_currency: SupportedCurrency;
        fiat_amount?: number;
        usdc_amount?: number;
    }): Promise<RampQuote | null>;
    /** Create a ramp order from an accepted quote */
    createOrder(params: {
        quote_id: string;
        wallet_address: string;
        payment_method_id: string;
        institution_id: string;
    }): Promise<RampOrder>;
    /** Get current order status */
    getOrderStatus(order_id: string): Promise<RampOrder>;
    /** Verify incoming webhook signature */
    verifyWebhook(payload: string, signature: string): boolean;
    /** Parse incoming webhook into a standard RampWebhookEvent */
    parseWebhook(payload: string): RampWebhookEvent;
}
export declare const PROVIDER_COVERAGE: Record<RampProvider, SupportedCurrency[]>;
/** Get the best provider for a given currency */
export declare function selectProvider(currency: SupportedCurrency, direction: RampDirection, preferredProviders?: RampProvider[]): RampProvider | null;
