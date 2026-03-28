"use strict";
/**
 * IroFi Pyth Network Client
 * Fixed: price/expo arithmetic uses Number() cast for bigint compatibility
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythClient = exports.PYTH_FEED_IDS = void 0;
const price_service_client_1 = require("@pythnetwork/price-service-client");
var types_1 = require("./types");
Object.defineProperty(exports, "PYTH_FEED_IDS", { enumerable: true, get: function () { return types_1.PYTH_FEED_IDS; } });
const PYTH_ENDPOINTS = {
    mainnet: "https://hermes.pyth.network",
    devnet: "https://hermes-beta.pyth.network",
};
class PythClient {
    network;
    connection;
    cache = new Map();
    constructor(network = "devnet") {
        this.network = network;
        this.connection = new price_service_client_1.PriceServiceConnection(PYTH_ENDPOINTS[network], {
            priceFeedRequestConfig: { binary: true },
        });
    }
    async getPrice(feedId, maxAgeSeconds = 60) {
        const cached = this.cache.get(feedId);
        if (cached && Date.now() - cached.cachedAt < maxAgeSeconds * 1000)
            return cached.feed;
        try {
            const feeds = await this.connection.getLatestPriceFeeds([feedId]);
            if (!feeds || feeds.length === 0)
                return null;
            const feed = feeds[0];
            const priceObj = feed.getPriceNoOlderThan(maxAgeSeconds);
            if (!priceObj)
                return null;
            // Cast to number — Pyth SDK may return bigint on newer versions
            const price = Number(priceObj.price);
            const conf = Number(priceObj.conf);
            const expo = Number(priceObj.expo);
            const scalar = Math.pow(10, expo);
            const result = {
                feed_id: feedId,
                symbol: this.symbolFromFeedId(feedId),
                price: price * scalar,
                confidence: conf * scalar,
                exponent: expo,
                publish_time: Number(priceObj.publishTime),
                ema_price: price * scalar,
                status: "trading",
            };
            this.cache.set(feedId, { feed: result, cachedAt: Date.now() });
            return result;
        }
        catch (err) {
            console.error(`[Pyth] Failed to fetch ${feedId}:`, err);
            return null;
        }
    }
    async getPrices(feedIds) {
        const result = new Map();
        try {
            const feeds = await this.connection.getLatestPriceFeeds(feedIds);
            if (!feeds)
                return result;
            for (const feed of feeds) {
                const priceObj = feed.getPriceUnchecked();
                if (!priceObj)
                    continue;
                const price = Number(priceObj.price);
                const expo = Number(priceObj.expo);
                const scalar = Math.pow(10, expo);
                const pf = {
                    feed_id: feed.id,
                    symbol: this.symbolFromFeedId(feed.id),
                    price: price * scalar,
                    confidence: Number(priceObj.conf) * scalar,
                    exponent: expo,
                    publish_time: Number(priceObj.publishTime),
                    ema_price: price * scalar,
                    status: "trading",
                };
                result.set(feed.id, pf);
                this.cache.set(feed.id, { feed: pf, cachedAt: Date.now() });
            }
        }
        catch (err) {
            console.error("[Pyth] Batch fetch failed:", err);
        }
        return result;
    }
    async getPriceUpdateData(feedIds) {
        try {
            const vaas = await this.connection.getLatestVaas(feedIds);
            return vaas.map((vaa) => Buffer.from(vaa, "base64"));
        }
        catch (err) {
            console.error("[Pyth] Failed to get VAAs:", err);
            return [];
        }
    }
    subscribeToFeed(feedId, onUpdate) {
        this.connection.subscribePriceFeedUpdates([feedId], (priceFeed) => {
            const priceObj = priceFeed.getPriceUnchecked();
            if (!priceObj)
                return;
            const price = Number(priceObj.price);
            const expo = Number(priceObj.expo);
            const scalar = Math.pow(10, expo);
            const pf = {
                feed_id: feedId,
                symbol: this.symbolFromFeedId(feedId),
                price: price * scalar,
                confidence: Number(priceObj.conf) * scalar,
                exponent: expo,
                publish_time: Number(priceObj.publishTime),
                ema_price: price * scalar,
                status: "trading",
            };
            this.cache.set(feedId, { feed: pf, cachedAt: Date.now() });
            onUpdate(pf);
        });
        return () => {
            this.connection.unsubscribePriceFeedUpdates([feedId]);
        };
    }
    symbolFromFeedId(feedId) {
        const { PYTH_FEED_IDS } = require("./types");
        const entry = Object.values(PYTH_FEED_IDS)
            .find((f) => f.feed_id === feedId);
        return entry?.symbol ?? feedId.slice(0, 10);
    }
    async close() {
        this.cache.clear();
    }
}
exports.PythClient = PythClient;
//# sourceMappingURL=pyth.js.map