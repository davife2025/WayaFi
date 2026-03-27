/**
 * IroFi TypeScript SDK — Main Client
 * Clean, typed interface for interacting with IroFi.
 * Methods: initiateTreasuryTransfer, checkComplianceStatus,
 *          getCorridorLiquidity, getTransfer, listTransfers,
 *          registerWebhook, getOracleRate, getRampQuote
 */

export type Corridor = "NG_KE" | "NG_ZA" | "NG_GH" | "KE_ZA" | "KE_GH";
export type TransferStatus =
  | "initiated" | "kyc_check" | "kyt_check" | "sanctions_check"
  | "aml_assessment" | "travel_rule" | "on_chain" | "settling"
  | "completed" | "failed" | "held";

// ── Request / Response types ───────────────────────────────────────────────

export interface InitiateTransferParams {
  sender_institution_id: string;
  receiver_institution_id: string;
  amount_usdc: number;
  corridor: Corridor;
  memo: string;                     // min 8 chars — Travel Rule reference
  idempotency_key: string;
  fx_rate_limit?: number;           // abort if rate exceeds this
}

export interface TransferResponse {
  transfer_id: string;
  status: TransferStatus;
  corridor: Corridor;
  amount_usdc: number;
  idempotency_key: string;
  estimated_completion_seconds: number;
  message: string;
}

export interface TransferDetail extends TransferResponse {
  fee_usdc: number;
  net_amount_usdc: number;
  fx_rate?: number;
  tx_signature?: string;
  travel_rule_state?: string;
  travel_rule_envelope_id?: string;
  aml_risk_score?: number;
  kyt_risk_score?: number;
  pipeline_steps: PipelineStep[];
  initiated_at: string;
  completed_at?: string;
}

export interface PipelineStep {
  step: string;
  status: "passed" | "failed" | "pending" | "skipped" | "confirmed" | "completed";
  duration_ms?: number;
  risk_score?: number;
  decision?: string;
  tx_signature?: string;
  envelope_id?: string;
}

export interface ComplianceStatus {
  institution_id: string;
  kyc_status: "unverified" | "pending" | "verified" | "rejected" | "suspended";
  kyc_risk_score: number;
  kyc_expires_at: string;
  aml_risk_score: number;
  sanctions_clear: boolean;
  travel_rule_active: boolean;
  fatf_grey_listed: boolean;
}

export interface CorridorLiquidity {
  id: Corridor;
  is_active: boolean;
  total_liquidity_usdc: number;
  pending_settlements_usdc: number;
  transfer_fee_bps: number;
  min_transfer_usdc: number;
  max_transfer_usdc: number;
  avg_settlement_seconds: number;
  fatf_grey_listed: boolean;
  fx_rate?: number;
}

export interface OracleRate {
  corridor: Corridor;
  sender_currency: string;
  receiver_currency: string;
  usdc_to_sender: number;
  usdc_to_receiver: number;
  implied_rate: number;
  spread_bps: number;
  source: "SIX" | "PYTH" | "COMBINED";
  is_stale: boolean;
  fetched_at: string;
}

export interface RampQuoteResult {
  provider: string;
  direction: "ON" | "OFF";
  fiat_currency: string;
  fiat_amount: number;
  usdc_amount: number;
  exchange_rate: number;
  fee_fiat: number;
  net_usdc: number;
  net_fiat: number;
  quote_id: string;
  expires_at: string;
}

export interface WebhookRegistration {
  id: string;
  url: string;
  events: string[];
  secret: string;             // shown once — store securely
  created_at: string;
}

export interface ListTransfersParams {
  page?: number;
  limit?: number;
  status?: TransferStatus;
  corridor?: Corridor;
}

// ── SDK Client ─────────────────────────────────────────────────────────────

export interface IroFiClientConfig {
  apiUrl: string;             // e.g. https://api.irofi.io/v1
  apiKey: string;             // institution API key
  timeout?: number;           // request timeout ms (default 30000)
}

export class IroFiClient {
  private readonly baseUrl: string;
  private readonly headers: HeadersInit;
  private readonly timeout: number;

  constructor(config: IroFiClientConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "X-SDK-Version": "1.0.0",
      "X-SDK-Language": "typescript",
    };
    this.timeout = config.timeout ?? 30_000;
  }

  // ── Transfers ─────────────────────────────────────────────────────────

  /**
   * Initiate a cross-border USDC transfer.
   * Runs the full compliance pipeline (KYT → Sanctions → AML → Travel Rule)
   * before submitting to the chain.
   *
   * @example
   * const transfer = await client.initiateTreasuryTransfer({
   *   sender_institution_id: "inst_lagos_001",
   *   receiver_institution_id: "inst_nairobi_001",
   *   amount_usdc: 50000,
   *   corridor: "NG_KE",
   *   memo: "Invoice #INV-2026-001 — goods settlement",
   *   idempotency_key: "unique-key-123",
   * });
   */
  async initiateTreasuryTransfer(params: InitiateTransferParams): Promise<TransferResponse> {
    return this.post<TransferResponse>("/transfers", params);
  }

  /**
   * Get full transfer detail including pipeline audit trail.
   */
  async getTransfer(transferId: string): Promise<TransferDetail> {
    return this.get<TransferDetail>(`/transfers/${transferId}`);
  }

  /**
   * List transfers with optional filters.
   */
  async listTransfers(params: ListTransfersParams = {}): Promise<{ transfers: TransferDetail[]; total: number }> {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return this.get(`/transfers${qs ? `?${qs}` : ""}`);
  }

  // ── Compliance ────────────────────────────────────────────────────────

  /**
   * Get full compliance status for an institution.
   */
  async checkComplianceStatus(institutionId: string): Promise<ComplianceStatus> {
    return this.get<ComplianceStatus>(`/institutions/${institutionId}`);
  }

  /**
   * Submit institution for KYC verification.
   */
  async submitKYC(params: {
    institution_id: string;
    wallet_address: string;
    jurisdiction: string;
    document_type: string;
    document_front_base64: string;
    document_back_base64?: string;
    business_name?: string;
    registration_number?: string;
  }): Promise<{ verified: boolean; status: string; risk_score: number; expires_at: string }> {
    return this.post("/compliance/kyc", params);
  }

  // ── Corridors ─────────────────────────────────────────────────────────

  /**
   * Get liquidity and health for a specific corridor.
   */
  async getCorridorLiquidity(corridor: Corridor): Promise<CorridorLiquidity> {
    return this.get<CorridorLiquidity>(`/corridors/${corridor}`);
  }

  /**
   * Get all corridor liquidity stats.
   */
  async getAllCorridors(): Promise<CorridorLiquidity[]> {
    const res = await this.get<{ corridors: CorridorLiquidity[] }>("/corridors");
    return res.corridors;
  }

  // ── Oracle / FX ───────────────────────────────────────────────────────

  /**
   * Get the current FX rate for a corridor (Pyth + SIX combined).
   */
  async getOracleRate(corridor: Corridor): Promise<OracleRate> {
    return this.get<OracleRate>(`/oracle/rates/${corridor}`);
  }

  /**
   * Evaluate whether a rate threshold is met for a deferred transfer.
   */
  async evaluateRateThreshold(params: {
    corridor: Corridor;
    amount_usdc: number;
    target_rate: number;
    tolerance_bps?: number;
  }): Promise<{ should_execute: boolean; current_rate: number; reason: string }> {
    return this.post("/oracle/evaluate-threshold", params);
  }

  // ── On/Off Ramp ───────────────────────────────────────────────────────

  /**
   * Get the best ramp quote across providers for a fiat/USDC conversion.
   */
  async getRampQuote(params: {
    direction: "ON" | "OFF";
    currency: string;
    fiat_amount?: number;
    usdc_amount?: number;
  }): Promise<{ quote: RampQuoteResult; provider: string }> {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString();
    return this.get(`/ramp/quote?${qs}`);
  }

  // ── Webhooks ──────────────────────────────────────────────────────────

  /**
   * Register a webhook to receive transfer lifecycle events.
   * Events: transfer.completed, transfer.failed, compliance.hold, travel_rule.accepted, etc.
   */
  async registerWebhook(params: {
    url: string;
    events: string[];
  }): Promise<WebhookRegistration> {
    return this.post<WebhookRegistration>("/webhooks", params);
  }

  /**
   * Remove a webhook registration.
   */
  async removeWebhook(webhookId: string): Promise<void> {
    await this.delete(`/webhooks/${webhookId}`);
  }

  // ── Travel Rule ───────────────────────────────────────────────────────

  /**
   * Look up a VASP in the TRISA directory by wallet address.
   */
  async lookupVASP(walletAddress: string): Promise<{
    found: boolean;
    vasp_id?: string;
    vasp_name?: string;
    country?: string;
    travel_rule_policy?: object;
  }> {
    return this.get(`/travel-rule/vasp/${walletAddress}`);
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async delete(path: string): Promise<void> {
    await this.request("DELETE", path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "UNKNOWN", message: res.statusText }));
        throw new IroFiError(
          error.message ?? `HTTP ${res.status}`,
          error.error ?? "HTTP_ERROR",
          res.status
        );
      }

      return res.json() as Promise<T>;

    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new IroFiError(`Request timed out after ${this.timeout}ms`, "TIMEOUT", 408);
      }
      if (err instanceof IroFiError) throw err;
      throw new IroFiError(err.message, "NETWORK_ERROR", 0);
    }
  }
}

// ── Error class ───────────────────────────────────────────────────────────

export class IroFiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "IroFiError";
  }
}
