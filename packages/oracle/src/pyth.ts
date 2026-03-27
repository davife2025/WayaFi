/**
 * IroFi Pyth Network Client
 * Real-time price feeds for USDC and African fiat currencies.
 * Uses @pythnetwork/price-service-client for off-chain price pulls.
 * On-chain price consumption happens in the routing-logic program via CPI.
 */

import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import type { PythPriceFeed, PythFeedConfig, PYTH_FEED_IDS } from "./types";

// Re-export for convenience
export { PYTH_FEED_IDS } from "./types";

// ── Pyth Client ────────────────────────────────────────────────────────────

const PYTH_ENDPOINTS = {
  mainnet: "https://hermes.pyth.network",
  devnet:  "https://hermes-beta.pyth.network",
};

export class PythClient {
  private connection: PriceServiceConnection;
  private cache = new Map<string, { feed: PythPriceFeed; cachedAt: number }>();
  private subscriptions = new Map<string, () => void>();

  constructor(private readonly network: "mainnet" | "devnet" = "devnet") {
    this.connection = new PriceServiceConnection(PYTH_ENDPOINTS[network], {
      priceFeedRequestConfig: { binary: true },
    });
  }

  // ── Single price fetch ──────────────────────────────────────────────────

  async getPrice(feedId: string, maxAgeSeconds = 60): Promise<PythPriceFeed | null> {
    // Check cache first
    const cached = this.cache.get(feedId);
    if (cached && Date.now() - cached.cachedAt < maxAgeSeconds * 1000) {
      return cached.feed;
    }

    try {
      const feeds = await this.connection.getLatestPriceFeeds([feedId]);
      if (!feeds || feeds.length === 0) return null;

      const feed = feeds[0]!;
      const priceObj = feed.getPriceNoOlderThan(maxAgeSeconds);
      if (!priceObj) {
        console.warn(`[Pyth] Price for ${feedId} is older than ${maxAgeSeconds}s`);
        return null;
      }

      const result: PythPriceFeed = {
        feed_id: feedId,
        symbol: this.symbolFromFeedId(feedId),
        price: priceObj.price * Math.pow(10, priceObj.expo),
        confidence: priceObj.conf * Math.pow(10, priceObj.expo),
        exponent: priceObj.expo,
        publish_time: priceObj.publishTime,
        ema_price: (feed.getEmaPriceNoOlderThan(maxAgeSeconds)?.price ?? priceObj.price)
          * Math.pow(10, priceObj.expo),
        status: "trading",
      };

      this.cache.set(feedId, { feed: result, cachedAt: Date.now() });
      return result;

    } catch (err) {
      console.error(`[Pyth] Failed to fetch price for ${feedId}:`, err);
      return null;
    }
  }

  // ── Batch price fetch ───────────────────────────────────────────────────

  async getPrices(feedIds: string[]): Promise<Map<string, PythPriceFeed>> {
    const result = new Map<string, PythPriceFeed>();

    try {
      const feeds = await this.connection.getLatestPriceFeeds(feedIds);
      if (!feeds) return result;

      for (const feed of feeds) {
        const priceObj = feed.getPriceUnchecked();
        if (!priceObj) continue;

        const feedId = feed.id;
        const price: PythPriceFeed = {
          feed_id: feedId,
          symbol: this.symbolFromFeedId(feedId),
          price: priceObj.price * Math.pow(10, priceObj.expo),
          confidence: priceObj.conf * Math.pow(10, priceObj.expo),
          exponent: priceObj.expo,
          publish_time: priceObj.publishTime,
          ema_price: priceObj.price * Math.pow(10, priceObj.expo),
          status: "trading",
        };

        result.set(feedId, price);
        this.cache.set(feedId, { feed: price, cachedAt: Date.now() });
      }

    } catch (err) {
      console.error("[Pyth] Batch fetch failed:", err);
    }

    return result;
  }

  // ── Streaming subscription ──────────────────────────────────────────────

  subscribeToFeed(
    feedId: string,
    onUpdate: (feed: PythPriceFeed) => void,
    onError?: (err: Error) => void
  ): () => void {
    if (this.subscriptions.has(feedId)) {
      return this.subscriptions.get(feedId)!;
    }

    this.connection.subscribePriceFeedUpdates([feedId], (priceFeed) => {
      const priceObj = priceFeed.getPriceUnchecked();
      if (!priceObj) return;

      const feed: PythPriceFeed = {
        feed_id: feedId,
        symbol: this.symbolFromFeedId(feedId),
        price: priceObj.price * Math.pow(10, priceObj.expo),
        confidence: priceObj.conf * Math.pow(10, priceObj.expo),
        exponent: priceObj.expo,
        publish_time: priceObj.publishTime,
        ema_price: priceObj.price * Math.pow(10, priceObj.expo),
        status: "trading",
      };

      this.cache.set(feedId, { feed, cachedAt: Date.now() });
      onUpdate(feed);
    });

    const unsubscribe = () => {
      this.connection.unsubscribePriceFeedUpdates([feedId]);
      this.subscriptions.delete(feedId);
    };

    this.subscriptions.set(feedId, unsubscribe);
    return unsubscribe;
  }

  // ── Price update data for on-chain submission ───────────────────────────

  /**
   * Get the binary price update VAA for on-chain submission.
   * The routing-logic program uses this to update price accounts.
   */
  async getPriceUpdateData(feedIds: string[]): Promise<Buffer[]> {
    try {
      const vaas = await this.connection.getLatestVaas(feedIds);
      return vaas.map((vaa) => Buffer.from(vaa, "base64"));
    } catch (err) {
      console.error("[Pyth] Failed to get price update VAAs:", err);
      return [];
    }
  }

  private symbolFromFeedId(feedId: string): string {
    const { PYTH_FEED_IDS } = require("./types");
    const entry = Object.values(PYTH_FEED_IDS as Record<string, { feed_id: string; symbol: string }>)
      .find((f) => f.feed_id === feedId);
    return entry?.symbol ?? feedId.slice(0, 10);
  }

  async close() {
    for (const [feedId, unsub] of this.subscriptions) {
      this.connection.unsubscribePriceFeedUpdates([feedId]);
    }
    this.subscriptions.clear();
    this.cache.clear();
  }
}
