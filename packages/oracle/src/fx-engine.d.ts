/**
 * IroFi FX Rate Engine
 * Combines Pyth + SIX into corridor rates with rate-triggered routing.
 */
import type { CorridorFXRate, CorridorId, FXRateAlert, OracleHealthStatus, SIXConfig } from "./types";
export declare class FXRateEngine {
    private pyth;
    private six;
    private rateCache;
    private alertCallbacks;
    private pollingInterval;
    constructor(pythNetwork: "mainnet" | "devnet", sixConfig: SIXConfig);
    getCorridorRate(corridor: CorridorId): Promise<CorridorFXRate | null>;
    getAllCorridorRates(): Promise<Map<CorridorId, CorridorFXRate>>;
    evaluateRateThreshold(params: {
        corridor: CorridorId;
        amount_usdc: number;
        target_rate: number;
        tolerance_bps: number;
    }): Promise<{
        should_execute: boolean;
        current_rate: number;
        reason: string;
    }>;
    startPolling(intervalMs?: number): void;
    stopPolling(): void;
    onAlert(callback: (alert: FXRateAlert) => void): void;
    private checkAlerts;
    private emit;
    getHealthStatus(): Promise<OracleHealthStatus>;
    private buildCorridorRate;
}
