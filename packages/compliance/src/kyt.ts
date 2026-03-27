/**
 * IroFi KYT — Know Your Transaction
 * Real-time transaction screening using Elliptic.
 * Every transfer is screened before the on-chain Transfer Hook fires.
 * The hook is the final gate; KYT is the pre-flight check.
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface KYTScreeningRequest {
  tx_signature?: string;       // on-chain tx signature (post-execution screening)
  sender_address: string;      // Solana wallet
  receiver_address: string;
  amount_usdc: number;
  corridor: string;            // e.g. "NG_KE"
  memo?: string;               // Travel Rule reference
}

export interface KYTScreeningResult {
  approved: boolean;
  risk_level: RiskLevel;
  risk_score: number;          // 0–10 (Elliptic scale)
  flags: KYTFlag[];
  screening_id: string;
  screened_at: Date;
  hold_for_review: boolean;    // true = auto-hold, trigger manual review
}

export interface KYTFlag {
  rule_id: string;
  category: KYTFlagCategory;
  severity: "info" | "warning" | "critical";
  description: string;
  counterparty?: string;       // flagged address if known
}

export type KYTFlagCategory =
  | "sanctions"
  | "mixing"
  | "darknet"
  | "fraud"
  | "terrorism_financing"
  | "money_laundering"
  | "high_risk_jurisdiction"
  | "unusual_pattern"
  | "structuring"              // splitting large transfers to evade reporting
  | "velocity";                // too many transactions in short period

// ── Elliptic Config ────────────────────────────────────────────────────────

interface EllipticConfig {
  apiKey: string;
  apiSecret: string;
  environment: "sandbox" | "production";
}

interface EllipticWalletScreeningResponse {
  id: string;
  risk_score: number;
  risk_score_normalised: number;
  triggers: Array<{
    rule_id: string;
    category: string;
    reason: string;
    risk_score: number;
    counterparty_name?: string;
  }>;
  contributed_to_riskiest_path: boolean;
  blockchain_info: {
    cluster_entities: Array<{ name: string; category: string }>;
  };
}

interface EllipticTransactionScreeningResponse {
  id: string;
  risk_score: number;
  risk_score_normalised: number;
  analysed_at: string;
  triggers: Array<{
    rule_id: string;
    category: string;
    reason: string;
    risk_score: number;
  }>;
}

const ELLIPTIC_BASE_URL = {
  sandbox: "https://aml-api-sandbox.elliptic.co",
  production: "https://aml-api.elliptic.co",
};

async function ellipticHeaders(config: EllipticConfig): Promise<HeadersInit> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // HMAC-SHA256 signature — production requires signed requests
  return {
    "Content-Type": "application/json",
    "x-access-key": config.apiKey,
    "x-access-sign": `${config.apiSecret}:${timestamp}`, // simplified — use proper HMAC in prod
    "x-access-timestamp": timestamp,
  };
}

// ── Wallet Screening ───────────────────────────────────────────────────────

async function screenWallet(
  address: string,
  config: EllipticConfig
): Promise<EllipticWalletScreeningResponse> {
  const url = `${ELLIPTIC_BASE_URL[config.environment]}/v2/wallet/synchronous`;
  const res = await fetch(url, {
    method: "POST",
    headers: await ellipticHeaders(config),
    body: JSON.stringify({
      subject: {
        asset: "holistic",
        blockchain: "solana",
        type: "address",
        hash: address,
      },
      type: "wallet_exposure",
    }),
  });

  if (!res.ok) throw new Error(`Elliptic wallet screen failed: ${res.status}`);
  return res.json();
}

// ── Transaction Screening ──────────────────────────────────────────────────

async function screenOnChainTransaction(
  txSignature: string,
  config: EllipticConfig
): Promise<EllipticTransactionScreeningResponse> {
  const url = `${ELLIPTIC_BASE_URL[config.environment]}/v2/analyses/synchronous`;
  const res = await fetch(url, {
    method: "POST",
    headers: await ellipticHeaders(config),
    body: JSON.stringify({
      subject: {
        asset: "holistic",
        blockchain: "solana",
        type: "transaction",
        hash: txSignature,
      },
      type: "transaction_analysis",
    }),
  });

  if (!res.ok) throw new Error(`Elliptic tx screen failed: ${res.status}`);
  return res.json();
}

// ── Risk Evaluation ────────────────────────────────────────────────────────

function evaluateRiskLevel(score: number): RiskLevel {
  if (score >= 8) return "critical";
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function shouldHoldForReview(flags: KYTFlag[], riskLevel: RiskLevel): boolean {
  if (riskLevel === "critical") return true;
  if (riskLevel === "high") return true;
  const criticalFlags = flags.filter((f) => f.severity === "critical");
  return criticalFlags.length > 0;
}

function mapEllipticTriggers(
  triggers: EllipticWalletScreeningResponse["triggers"]
): KYTFlag[] {
  return triggers.map((t) => ({
    rule_id: t.rule_id,
    category: (t.category.toLowerCase().replace(/ /g, "_") as KYTFlagCategory) ?? "unusual_pattern",
    severity: t.risk_score >= 7 ? "critical" : t.risk_score >= 4 ? "warning" : "info",
    description: t.reason,
    counterparty: t.counterparty_name,
  }));
}

// ── Structuring Detection ──────────────────────────────────────────────────

interface TransactionVelocityRecord {
  address: string;
  transactions: Array<{ amount: number; timestamp: number }>;
}

// In-memory velocity tracker (replace with Redis in production)
const velocityCache = new Map<string, TransactionVelocityRecord>();

function checkStructuring(
  address: string,
  amount: number,
  corridor: string
): KYTFlag[] {
  const flags: KYTFlag[] = [];
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000; // 24-hour window
  const reportingThreshold = 10_000; // $10,000 — common CTR threshold

  const record = velocityCache.get(address) ?? { address, transactions: [] };

  // Clean old entries outside window
  record.transactions = record.transactions.filter(
    (tx) => now - tx.timestamp < windowMs
  );

  record.transactions.push({ amount, timestamp: now });
  velocityCache.set(address, record);

  // Check velocity
  if (record.transactions.length >= 10) {
    flags.push({
      rule_id: "VELOCITY_10_TX_24H",
      category: "velocity",
      severity: "warning",
      description: `${address} sent 10+ transactions in 24 hours on ${corridor}`,
    });
  }

  // Check structuring — multiple transactions just below reporting threshold
  const nearThreshold = record.transactions.filter(
    (tx) => tx.amount >= reportingThreshold * 0.8 && tx.amount < reportingThreshold
  );
  if (nearThreshold.length >= 3) {
    flags.push({
      rule_id: "STRUCTURING_DETECTED",
      category: "structuring",
      severity: "critical",
      description: `Possible structuring: ${nearThreshold.length} transactions just below $${reportingThreshold.toLocaleString()} threshold`,
    });
  }

  return flags;
}

// ── Main Screening Function ────────────────────────────────────────────────

export async function screenTransaction(
  request: KYTScreeningRequest,
  config: EllipticConfig
): Promise<KYTScreeningResult> {
  const [senderScreening, receiverScreening] = await Promise.all([
    screenWallet(request.sender_address, config),
    screenWallet(request.receiver_address, config),
  ]);

  // Take the higher risk score between sender and receiver
  const maxRiskScore = Math.max(
    senderScreening.risk_score_normalised,
    receiverScreening.risk_score_normalised
  );

  const allFlags: KYTFlag[] = [
    ...mapEllipticTriggers(senderScreening.triggers),
    ...mapEllipticTriggers(receiverScreening.triggers),
    ...checkStructuring(request.sender_address, request.amount_usdc, request.corridor),
  ];

  const riskLevel = evaluateRiskLevel(maxRiskScore);
  const holdForReview = shouldHoldForReview(allFlags, riskLevel);

  // Critical and high risk transactions are blocked; medium and low are approved (possibly with hold)
  const approved = riskLevel !== "critical" && riskLevel !== "high";

  return {
    approved,
    risk_level: riskLevel,
    risk_score: maxRiskScore,
    flags: allFlags,
    screening_id: senderScreening.id,
    screened_at: new Date(),
    hold_for_review: holdForReview,
  };
}

/** Screen an already-confirmed on-chain transaction (post-execution monitoring) */
export async function screenConfirmedTransaction(
  txSignature: string,
  config: EllipticConfig
): Promise<KYTScreeningResult> {
  const result = await screenOnChainTransaction(txSignature, config);
  const riskLevel = evaluateRiskLevel(result.risk_score_normalised);
  const flags = mapEllipticTriggers(result.triggers);

  return {
    approved: riskLevel !== "critical",
    risk_level: riskLevel,
    risk_score: result.risk_score_normalised,
    flags,
    screening_id: result.id,
    screened_at: new Date(result.analysed_at),
    hold_for_review: riskLevel === "high" || riskLevel === "critical",
  };
}
