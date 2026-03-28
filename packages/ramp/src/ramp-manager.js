"use strict";
/**
 * IroFi Ramp Manager
 * Central router for all on/off ramp operations.
 * Selects the best provider per corridor, handles failover,
 * and provides a unified interface for the API layer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RampManager = void 0;
const yellow_card_1 = require("./yellow-card");
const bitnob_1 = require("./bitnob");
const muda_1 = require("./muda");
class RampManager {
    adapters;
    constructor(config) {
        this.adapters = new Map([
            ["YELLOW_CARD", new yellow_card_1.YellowCardAdapter(config.yellow_card)],
            ["BITNOB", new bitnob_1.BitnobAdapter(config.bitnob)],
            ["MUDA", new muda_1.MudaAdapter(config.muda)],
        ]);
    }
    // ── Quote — best rate across providers ────────────────────────────────────
    /**
     * Get the best quote for a fiat/USDC ramp.
     * Queries all eligible providers and returns the best rate.
     */
    async getBestQuote(params) {
        const eligibleProviders = [...this.adapters.entries()]
            .filter(([, adapter]) => adapter.supportedCurrencies.includes(params.fiat_currency) &&
            adapter.supportedDirections.includes(params.direction))
            .map(([provider]) => provider);
        const quotes = await Promise.allSettled(eligibleProviders.map(async (provider) => {
            const adapter = this.adapters.get(provider);
            const quote = await adapter.getQuote(params);
            return quote ? { quote, provider } : null;
        }));
        const validQuotes = quotes
            .filter((r) => r.status === "fulfilled" && r.value !== null)
            .map((r) => r.value);
        if (!validQuotes.length)
            return null;
        // Select best quote: for ON ramps, max net_usdc. For OFF ramps, max net_fiat.
        return validQuotes.reduce((best, current) => {
            const bestVal = params.direction === "ON" ? best.quote.net_usdc : best.quote.net_fiat;
            const currVal = params.direction === "ON" ? current.quote.net_usdc : current.quote.net_fiat;
            return currVal > bestVal ? current : best;
        });
    }
    /**
     * Get all quotes across providers for comparison.
     */
    async getAllQuotes(params) {
        const eligibleProviders = [...this.adapters.entries()]
            .filter(([, adapter]) => adapter.supportedCurrencies.includes(params.fiat_currency) &&
            adapter.supportedDirections.includes(params.direction));
        const results = await Promise.allSettled(eligibleProviders.map(async ([provider, adapter]) => {
            const quote = await adapter.getQuote(params);
            return quote ? { quote, provider } : null;
        }));
        return results
            .filter((r) => r.status === "fulfilled" && r.value !== null)
            .map((r) => r.value);
    }
    // ── Order Management ──────────────────────────────────────────────────────
    async createOrder(params) {
        const adapter = this.adapters.get(params.provider);
        if (!adapter)
            throw new Error(`Unknown provider: ${params.provider}`);
        return adapter.createOrder(params);
    }
    async getOrderStatus(provider, order_id) {
        const adapter = this.adapters.get(provider);
        if (!adapter)
            throw new Error(`Unknown provider: ${provider}`);
        return adapter.getOrderStatus(order_id);
    }
    // ── Webhook Routing ───────────────────────────────────────────────────────
    /**
     * Route an incoming webhook to the correct adapter for verification + parsing.
     * Called by the API's /v1/ramp/webhook/:provider endpoint.
     */
    handleWebhook(provider, payload, signature) {
        const adapter = this.adapters.get(provider);
        if (!adapter)
            throw new Error(`Unknown provider: ${provider}`);
        const valid = adapter.verifyWebhook(payload, signature);
        if (!valid)
            throw new Error(`Invalid webhook signature for ${provider}`);
        return adapter.parseWebhook(payload);
    }
}
exports.RampManager = RampManager;
//# sourceMappingURL=ramp-manager.js.map