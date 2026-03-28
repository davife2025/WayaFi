"use strict";
/**
 * IroFi On/Off Ramp — Core Types
 * Pluggable adapter interface for local fiat providers.
 * Each corridor has its own adapter — Yellow Card, Bitnob, Muda.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDER_COVERAGE = void 0;
exports.selectProvider = selectProvider;
// ── Provider Coverage ──────────────────────────────────────────────────────
exports.PROVIDER_COVERAGE = {
    YELLOW_CARD: ["NGN", "KES", "ZAR", "GHS", "UGX"], // pan-Africa
    BITNOB: ["NGN", "GHS"], // West Africa
    MUDA: ["KES", "UGX", "TZS"], // East Africa
    FLUTTERWAVE: ["NGN", "KES", "ZAR", "GHS"], // pan-Africa backup
};
/** Get the best provider for a given currency */
function selectProvider(currency, direction, preferredProviders = []) {
    // Check preferred providers first
    for (const p of preferredProviders) {
        if (exports.PROVIDER_COVERAGE[p]?.includes(currency))
            return p;
    }
    // Fall back to coverage map
    for (const [provider, currencies] of Object.entries(exports.PROVIDER_COVERAGE)) {
        if (currencies.includes(currency))
            return provider;
    }
    return null;
}
//# sourceMappingURL=types.js.map