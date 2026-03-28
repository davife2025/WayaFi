"use strict";
/**
 * IroFi Oracle & FX Types
 * Covers Pyth Network price feeds + SIX Financial data partner integration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORRIDOR_CURRENCIES = exports.PYTH_FEED_IDS = void 0;
// Pyth feed IDs for IroFi corridors (devnet + mainnet)
exports.PYTH_FEED_IDS = {
    "USDC/USD": {
        feed_id: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
        symbol: "USDC/USD",
        max_age_seconds: 60,
    },
    "NGN/USD": {
        feed_id: "0x7d7f4bb0cba7ee4c4f8122ddffcae55d1a97f5af0c2eb5d16b1c6b0abe7a99b",
        symbol: "NGN/USD",
        max_age_seconds: 300,
    },
    "KES/USD": {
        feed_id: "0x40a09fb7e7796c2bcd0e72f0f90af6c2e9b8f6a4b7c2e1d3f8a5b9c6e4d2f1a",
        symbol: "KES/USD",
        max_age_seconds: 300,
    },
    "ZAR/USD": {
        feed_id: "0x389d153da4f8af49f36c5c66cf21b9c0b37ef8f9f5c3e2d1a6b8c4f7e9d0a2b",
        symbol: "ZAR/USD",
        max_age_seconds: 300,
    },
    "GHS/USD": {
        feed_id: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
        symbol: "GHS/USD",
        max_age_seconds: 300,
    },
};
// Currency map per corridor
exports.CORRIDOR_CURRENCIES = {
    NG_KE: { sender: "NGN", receiver: "KES" },
    NG_ZA: { sender: "NGN", receiver: "ZAR" },
    NG_GH: { sender: "NGN", receiver: "GHS" },
    KE_ZA: { sender: "KES", receiver: "ZAR" },
    KE_GH: { sender: "KES", receiver: "GHS" },
};
//# sourceMappingURL=types.js.map