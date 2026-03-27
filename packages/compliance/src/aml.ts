/**
 * IroFi AML Risk Engine
 * Combines KYC risk scores, KYT flags, and corridor-specific rules
 * into a single AML decision for each transfer.
 */

import { FATF_GREY_LIST, GREY_LIST_RISK_THRESHOLD } from "./kyc";
import type { KYTScreeningResult } from "./kyt";
import type { SanctionsCheckResult } from "./sanctions";

export type AMLDecision = "approve" | "hold" | "reject";

export interface AMLAssessment {
  decision: AMLDecision;
  overall_risk_score: number;   // 0–100
  reasons: string[];
  requires_sar: boolean;        // Suspicious Activity Report required
  requires_ctr: boolean;        // Currency Transaction Report required
  manual_review_required: boolean;
  assessment_id: string;
  assessed_at: Date;
}

export interface AMLContext {
  sender_jurisdiction: string;
  receiver_jurisdiction: string;
  amount_usdc: number;
  sender_kyc_risk_score: number;
  receiver_kyc_risk_score: number;
  kyt_result: KYTScreeningResult;
  sanctions_result: SanctionsCheckResult;
  corridor: string;
}

// ── Reporting Thresholds ───────────────────────────────────────────────────

const CTR_THRESHOLD_USD = 10_000;    // Currency Transaction Report threshold
const SAR_RISK_THRESHOLD = 70;       // Suspicious Activity Report risk score threshold

// ── AML Decision Engine ────────────────────────────────────────────────────

export function assessAMLRisk(ctx: AMLContext): AMLAssessment {
  const reasons: string[] = [];
  let score = 0;

  // ── Hard blocks ────────────────────────────────────────────────────────
  if (ctx.sanctions_result.is_sanctioned) {
    return {
      decision: "reject",
      overall_risk_score: 100,
      reasons: ["Wallet or jurisdiction is on a sanctions list — transfer blocked"],
      requires_sar: true,
      requires_ctr: false,
      manual_review_required: true,
      assessment_id: `aml_${Date.now()}`,
      assessed_at: new Date(),
    };
  }

  if (!ctx.kyt_result.approved) {
    return {
      decision: "reject",
      overall_risk_score: 90,
      reasons: [
        `KYT screening blocked transfer: ${ctx.kyt_result.risk_level} risk`,
        ...ctx.kyt_result.flags.map((f) => f.description),
      ],
      requires_sar: ctx.kyt_result.risk_level === "critical",
      requires_ctr: ctx.amount_usdc >= CTR_THRESHOLD_USD,
      manual_review_required: true,
      assessment_id: `aml_${Date.now()}`,
      assessed_at: new Date(),
    };
  }

  // ── Risk scoring ───────────────────────────────────────────────────────

  // KYC risk contribution
  const avgKYCRisk = (ctx.sender_kyc_risk_score + ctx.receiver_kyc_risk_score) / 2;
  score += avgKYCRisk * 0.3; // 30% weight

  // KYT risk contribution
  score += ctx.kyt_result.risk_score * 10 * 0.4; // 40% weight (0-10 → 0-100)

  // Jurisdiction risk
  const senderGrey = FATF_GREY_LIST.includes(ctx.sender_jurisdiction as any);
  const receiverGrey = FATF_GREY_LIST.includes(ctx.receiver_jurisdiction as any);
  if (senderGrey) { score += 15; reasons.push(`Sender is in FATF grey-listed jurisdiction: ${ctx.sender_jurisdiction}`); }
  if (receiverGrey) { score += 15; reasons.push(`Receiver is in FATF grey-listed jurisdiction: ${ctx.receiver_jurisdiction}`); }

  // Amount risk
  if (ctx.amount_usdc >= 50_000) { score += 10; reasons.push("Large transfer ≥ $50,000"); }
  else if (ctx.amount_usdc >= 10_000) { score += 5; }

  // KYT flags
  const criticalFlags = ctx.kyt_result.flags.filter((f) => f.severity === "critical");
  const warningFlags = ctx.kyt_result.flags.filter((f) => f.severity === "warning");
  score += criticalFlags.length * 15;
  score += warningFlags.length * 5;

  const finalScore = Math.min(100, Math.round(score));

  // ── Decision ───────────────────────────────────────────────────────────
  let decision: AMLDecision;
  if (finalScore >= 75) decision = "reject";
  else if (finalScore >= 40 || ctx.kyt_result.hold_for_review) decision = "hold";
  else decision = "approve";

  return {
    decision,
    overall_risk_score: finalScore,
    reasons,
    requires_sar: finalScore >= SAR_RISK_THRESHOLD,
    requires_ctr: ctx.amount_usdc >= CTR_THRESHOLD_USD,
    manual_review_required: decision === "hold" || decision === "reject",
    assessment_id: `aml_${Date.now()}`,
    assessed_at: new Date(),
  };
}
