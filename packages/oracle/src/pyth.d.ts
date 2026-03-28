/**
 * IroFi Pyth Network Client
 * Fixed: price/expo arithmetic uses Number() cast for bigint compatibility
 */
import type { PythPriceFeed } from "./types";
export { PYTH_FEED_IDS } from "./types";
export declare class PythClient {
    private readonly network;
    private connection;
    private cache;
    constructor(network?: "mainnet" | "devnet");
    getPrice(feedId: string, maxAgeSeconds?: number): Promise<PythPriceFeed | null>;
    getPrices(feedIds: string[]): Promise<Map<string, PythPriceFeed>>;
    getPriceUpdateData(feedIds: string[]): Promise<Buffer[]>;
    subscribeToFeed(feedId: string, onUpdate: (feed: PythPriceFeed) => void): () => void;
    private symbolFromFeedId;
    close(): Promise<void>;
}
