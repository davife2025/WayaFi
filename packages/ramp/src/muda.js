"use strict";
/**
 * Muda Adapter — East Africa (KES, UGX, TZS)
 * Kenya, Uganda, Tanzania. Strong M-Pesa integration.
 * Docs: https://docs.muda.africa
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MudaAdapter = void 0;
const crypto_1 = require("crypto");
const MUDA_BASE_URL = {
    sandbox: "https://sandbox-api.muda.africa/v1",
    production: "https://api.muda.africa/v1",
};
class MudaAdapter {
    config;
    provider = "MUDA";
    supportedCurrencies = ["KES", "UGX", "TZS"];
    supportedDirections = ["ON", "OFF"];
    baseUrl;
    constructor(config) {
        this.config = config;
        this.baseUrl = MUDA_BASE_URL[config.environment];
    }
    async getQuote(params) {
        if (!this.supportedCurrencies.includes(params.fiat_currency))
            return null;
        try {
            const res = await fetch(`${this.baseUrl}/quotes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": this.config.api_key,
                },
                body: JSON.stringify({
                    from_currency: params.direction === "ON" ? params.fiat_currency : "USDC",
                    to_currency: params.direction === "ON" ? "USDC" : params.fiat_currency,
                    amount: params.fiat_amount ?? params.usdc_amount,
                }),
            });
            if (!res.ok)
                return null;
            const data = await res.json();
            return this.parseQuote(data, params.direction, params.fiat_currency);
        }
        catch {
            return null;
        }
    }
    async createOrder(params) {
        const res = await fetch(`${this.baseUrl}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": this.config.api_key,
            },
            body: JSON.stringify({
                quote_id: params.quote_id,
                destination_address: params.wallet_address,
                payment_method: params.payment_method_id,
                client_reference: params.institution_id,
            }),
        });
        if (!res.ok)
            throw new Error(`[Muda] Create order failed: ${res.status}`);
        return this.parseOrder(await res.json());
    }
    async getOrderStatus(order_id) {
        const res = await fetch(`${this.baseUrl}/orders/${order_id}`, {
            headers: { "X-API-Key": this.config.api_key },
        });
        if (!res.ok)
            throw new Error(`[Muda] Get order failed: ${res.status}`);
        return this.parseOrder(await res.json());
    }
    verifyWebhook(payload, signature) {
        const expected = (0, crypto_1.createHmac)("sha256", this.config.api_secret)
            .update(payload).digest("hex");
        return expected === signature;
    }
    parseWebhook(payload) {
        const data = JSON.parse(payload);
        return {
            provider: "MUDA",
            order_id: data.client_reference ?? data.id,
            provider_reference: data.id,
            status: this.mapStatus(data.status),
            timestamp: data.updated_at ?? new Date().toISOString(),
            raw_payload: data,
        };
    }
    parseQuote(data, direction, currency) {
        const expiresAt = new Date(data.expires_at ?? Date.now() + 10 * 60 * 1000);
        return {
            provider: "MUDA",
            direction,
            fiat_currency: currency,
            fiat_amount: data.from_amount,
            usdc_amount: data.to_amount,
            exchange_rate: data.rate,
            fee_fiat: data.fee ?? 0,
            fee_usdc: 0,
            net_usdc: data.to_amount,
            net_fiat: data.from_amount - (data.fee ?? 0),
            quote_id: data.id,
            expires_at: expiresAt,
            payment_methods: [{
                    id: "mpesa",
                    type: "mobile_money",
                    name: "M-Pesa",
                    currency,
                    min_amount: 100,
                    max_amount: 300_000,
                    processing_time_minutes: 5,
                }, {
                    id: "bank_transfer_ke",
                    type: "bank_transfer",
                    name: "Kenya Bank Transfer",
                    currency,
                    min_amount: 1_000,
                    max_amount: 5_000_000,
                    processing_time_minutes: 60,
                }],
        };
    }
    parseOrder(data) {
        return {
            id: data.client_reference ?? data.id,
            provider: "MUDA",
            direction: data.from_currency === "USDC" ? "OFF" : "ON",
            status: this.mapStatus(data.status),
            quote_id: data.quote_id ?? "",
            fiat_currency: (data.from_currency !== "USDC" ? data.from_currency : data.to_currency),
            fiat_amount: data.from_amount ?? 0,
            usdc_amount: data.to_amount ?? 0,
            wallet_address: data.destination_address ?? "",
            payment_reference: data.payment_reference ?? data.id,
            provider_reference: data.id,
            created_at: new Date(data.created_at ?? Date.now()),
            completed_at: data.completed_at ? new Date(data.completed_at) : undefined,
        };
    }
    mapStatus(status) {
        const map = {
            created: "pending",
            awaiting_payment: "payment_pending",
            payment_received: "payment_received",
            processing: "processing",
            completed: "completed",
            failed: "failed",
        };
        return map[status] ?? "pending";
    }
}
exports.MudaAdapter = MudaAdapter;
//# sourceMappingURL=muda.js.map