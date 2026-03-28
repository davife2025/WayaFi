"use strict";
/**
 * Bitnob Adapter — West Africa (NGN, GHS)
 * Nigeria and Ghana focused. Strong mobile money coverage.
 * Docs: https://developers.bitnob.com
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitnobAdapter = void 0;
const crypto_1 = require("crypto");
const BITNOB_BASE_URL = {
    sandbox: "https://sandboxapi.bitnob.com/api/v1",
    production: "https://api.bitnob.com/api/v1",
};
class BitnobAdapter {
    config;
    provider = "BITNOB";
    supportedCurrencies = ["NGN", "GHS"];
    supportedDirections = ["ON", "OFF"];
    baseUrl;
    constructor(config) {
        this.config = config;
        this.baseUrl = BITNOB_BASE_URL[config.environment];
    }
    async getQuote(params) {
        if (!this.supportedCurrencies.includes(params.fiat_currency))
            return null;
        try {
            const res = await fetch(`${this.baseUrl}/offramp/quote`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.api_key}`,
                },
                body: JSON.stringify({
                    currency: params.fiat_currency,
                    amount: params.usdc_amount ?? (params.fiat_amount / 1500), // rough NGN/USDC
                    type: params.direction === "ON" ? "buy" : "sell",
                }),
            });
            if (!res.ok)
                return null;
            const data = await res.json();
            return this.parseQuote(data.data ?? data, params.direction, params.fiat_currency);
        }
        catch {
            return null;
        }
    }
    async createOrder(params) {
        const res = await fetch(`${this.baseUrl}/offramp/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.config.api_key}`,
            },
            body: JSON.stringify({
                quoteId: params.quote_id,
                address: params.wallet_address,
                reference: params.institution_id,
            }),
        });
        if (!res.ok)
            throw new Error(`[Bitnob] Create order failed: ${res.status}`);
        const data = await res.json();
        return this.parseOrder(data.data ?? data);
    }
    async getOrderStatus(order_id) {
        const res = await fetch(`${this.baseUrl}/offramp/${order_id}`, {
            headers: { "Authorization": `Bearer ${this.config.api_key}` },
        });
        if (!res.ok)
            throw new Error(`[Bitnob] Get order failed: ${res.status}`);
        const data = await res.json();
        return this.parseOrder(data.data ?? data);
    }
    verifyWebhook(payload, signature) {
        const expected = (0, crypto_1.createHmac)("sha256", this.config.api_key)
            .update(payload).digest("hex");
        return `sha256=${expected}` === signature;
    }
    parseWebhook(payload) {
        const data = JSON.parse(payload);
        return {
            provider: "BITNOB",
            order_id: data.reference ?? data.id,
            provider_reference: data.id,
            status: this.mapStatus(data.status),
            timestamp: data.createdAt ?? new Date().toISOString(),
            raw_payload: data,
        };
    }
    parseQuote(data, direction, currency) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        return {
            provider: "BITNOB",
            direction,
            fiat_currency: currency,
            fiat_amount: data.localAmount ?? data.amount * data.rate,
            usdc_amount: data.usdcAmount ?? data.amount,
            exchange_rate: data.rate ?? data.exchangeRate,
            fee_fiat: data.fee ?? 0,
            fee_usdc: 0,
            net_usdc: data.usdcAmount ?? data.amount,
            net_fiat: (data.localAmount ?? 0) - (data.fee ?? 0),
            quote_id: data.id ?? data.quoteId,
            expires_at: expiresAt,
            payment_methods: [{
                    id: "bank_transfer_ng",
                    type: "bank_transfer",
                    name: currency === "NGN" ? "Nigerian Bank Transfer" : "Ghana Bank Transfer",
                    currency,
                    min_amount: 100,
                    max_amount: 5_000_000,
                    processing_time_minutes: 20,
                }],
        };
    }
    parseOrder(data) {
        return {
            id: data.reference ?? data.id,
            provider: "BITNOB",
            direction: "OFF",
            status: this.mapStatus(data.status),
            quote_id: data.quoteId ?? "",
            fiat_currency: (data.currency ?? "NGN"),
            fiat_amount: data.localAmount ?? 0,
            usdc_amount: data.usdcAmount ?? 0,
            wallet_address: data.address ?? "",
            payment_reference: data.paymentReference ?? data.id,
            provider_reference: data.id,
            created_at: new Date(data.createdAt ?? Date.now()),
            completed_at: data.completedAt ? new Date(data.completedAt) : undefined,
            failure_reason: data.failureReason,
        };
    }
    mapStatus(status) {
        const map = {
            pending: "pending",
            processing: "processing",
            completed: "completed",
            success: "completed",
            failed: "failed",
            cancelled: "failed",
        };
        return map[status] ?? "pending";
    }
}
exports.BitnobAdapter = BitnobAdapter;
//# sourceMappingURL=bitnob.js.map