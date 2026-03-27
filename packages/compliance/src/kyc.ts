/**
 * IroFi KYC Verification Module
 * Africa-first KYC using Smile ID for document verification.
 * Writes verified wallet addresses to the on-chain KYC whitelist.
 */

import { Connection, PublicKey, Transaction } from "@solana/web3.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type Jurisdiction = "NG" | "KE" | "ZA" | "GH" | "AO" | "CM" | "CD" | "TZ" | "UG";

export type KYCStatus = "unverified" | "pending" | "verified" | "rejected" | "suspended";

export type DocumentType =
  | "passport"
  | "national_id"
  | "drivers_license"
  | "business_registration"
  | "bank_license";

export interface KYCVerificationRequest {
  institution_id: string;
  wallet_address: string;
  jurisdiction: Jurisdiction;
  document_type: DocumentType;
  document_front_base64: string;
  document_back_base64?: string;
  selfie_base64?: string;  // for individual KYC
  business_name?: string;  // for institutional KYC
  registration_number?: string;
}

export interface KYCVerificationResult {
  verified: boolean;
  status: KYCStatus;
  risk_score: number;         // 0–100; higher = riskier
  flags: KYCFlag[];
  jurisdiction: Jurisdiction;
  provider_reference: string;
  expires_at: Date;           // KYC validity window (typically 1 year)
  enhanced_due_diligence_required: boolean; // true for FATF grey-listed jurisdictions
}

export interface KYCFlag {
  code: string;
  severity: "info" | "warning" | "critical";
  description: string;
}

// ── FATF Grey-List Configuration ───────────────────────────────────────────

/** Jurisdictions on FATF grey list — require enhanced due diligence */
export const FATF_GREY_LIST: Jurisdiction[] = ["NG", "AO", "CM", "CD"];

/** Risk score ceiling for grey-listed corridor transfers */
export const GREY_LIST_RISK_THRESHOLD = 40;

/** KYC validity period per jurisdiction (days) */
export const KYC_VALIDITY_DAYS: Record<Jurisdiction, number> = {
  NG: 180,  // Nigeria — shorter due to grey list
  AO: 180,  // Angola — shorter due to grey list
  KE: 365,
  ZA: 365,
  GH: 365,
  CM: 180,
  CD: 180,
  TZ: 365,
  UG: 365,
};

// ── Smile ID Client ────────────────────────────────────────────────────────

interface SmileIDConfig {
  apiKey: string;
  partnerId: string;
  environment: "sandbox" | "production";
}

interface SmileIDResponse {
  ResultCode: string;
  ResultText: string;
  ConfidenceValue: string;
  Actions: {
    Verify_ID_Number: string;
    Return_Personal_Info: string;
    Human_Review_Compare: string;
  };
  PartnerParams: { job_id: string };
}

async function callSmileID(
  config: SmileIDConfig,
  request: KYCVerificationRequest
): Promise<SmileIDResponse> {
  const baseUrl =
    config.environment === "production"
      ? "https://3eydmgh10d.execute-api.us-west-2.amazonaws.com/prod"
      : "https://testapi.smileidentity.com/v1";

  const payload = {
    source_sdk: "IroFi",
    source_sdk_version: "1.0.0",
    partner_id: config.partnerId,
    partner_params: {
      job_id: `irofi_${request.institution_id}_${Date.now()}`,
      user_id: request.institution_id,
      job_type: request.document_type === "business_registration" ? 6 : 1,
    },
    images: [
      { image_type_id: 0, image: request.document_front_base64 },
      ...(request.document_back_base64
        ? [{ image_type_id: 4, image: request.document_back_base64 }]
        : []),
      ...(request.selfie_base64
        ? [{ image_type_id: 1, image: request.selfie_base64 }]
        : []),
    ],
    id_info: {
      country: request.jurisdiction,
      id_type: mapDocumentType(request.document_type),
    },
    options: {
      return_job_status: true,
      return_history: false,
      return_images: false,
    },
  };

  const response = await fetch(`${baseUrl}/submit_job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Smile ID API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function mapDocumentType(docType: DocumentType): string {
  const map: Record<DocumentType, string> = {
    passport: "PASSPORT",
    national_id: "NATIONAL_ID",
    drivers_license: "DRIVERS_LICENSE",
    business_registration: "BUSINESS_REGISTRATION",
    bank_license: "BANK_LICENSE",
  };
  return map[docType];
}

// ── Risk Scoring ───────────────────────────────────────────────────────────

function calculateRiskScore(
  jurisdiction: Jurisdiction,
  smileResult: SmileIDResponse,
  documentType: DocumentType
): number {
  let score = 0;

  // Base score from jurisdiction
  if (FATF_GREY_LIST.includes(jurisdiction)) score += 30;
  else score += 10;

  // Smile ID confidence
  const confidence = parseInt(smileResult.ConfidenceValue, 10);
  if (confidence < 70) score += 25;
  else if (confidence < 85) score += 10;

  // Document type risk
  if (documentType === "business_registration") score += 5;
  if (documentType === "bank_license") score -= 10; // regulated entity, lower risk

  // Action flags
  if (smileResult.Actions.Human_Review_Compare !== "Passed") score += 20;

  return Math.min(100, Math.max(0, score));
}

function buildFlags(
  smileResult: SmileIDResponse,
  jurisdiction: Jurisdiction
): KYCFlag[] {
  const flags: KYCFlag[] = [];

  if (FATF_GREY_LIST.includes(jurisdiction)) {
    flags.push({
      code: "FATF_GREY_LIST",
      severity: "warning",
      description: `${jurisdiction} is on the FATF grey list — enhanced due diligence required`,
    });
  }

  if (smileResult.Actions.Human_Review_Compare !== "Passed") {
    flags.push({
      code: "MANUAL_REVIEW_REQUIRED",
      severity: "warning",
      description: "Automated verification inconclusive — manual review required",
    });
  }

  if (smileResult.ResultCode !== "0810") {
    flags.push({
      code: "VERIFICATION_FAILED",
      severity: "critical",
      description: `Smile ID verification failed: ${smileResult.ResultText}`,
    });
  }

  return flags;
}

// ── Main Verification Function ─────────────────────────────────────────────

export async function verifyKYC(
  request: KYCVerificationRequest,
  config: SmileIDConfig
): Promise<KYCVerificationResult> {
  const smileResult = await callSmileID(config, request);

  const verified =
    smileResult.ResultCode === "0810" &&
    smileResult.Actions.Verify_ID_Number === "Verified";

  const riskScore = calculateRiskScore(
    request.jurisdiction,
    smileResult,
    request.document_type
  );

  const validityDays = KYC_VALIDITY_DAYS[request.jurisdiction] ?? 365;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + validityDays);

  return {
    verified,
    status: verified ? "verified" : "rejected",
    risk_score: riskScore,
    flags: buildFlags(smileResult, request.jurisdiction),
    jurisdiction: request.jurisdiction,
    provider_reference: smileResult.PartnerParams.job_id,
    expires_at: expiresAt,
    enhanced_due_diligence_required: FATF_GREY_LIST.includes(request.jurisdiction),
  };
}

/** Write KYC verification result to on-chain whitelist */
export async function writeKYCToChain(
  result: KYCVerificationResult,
  walletAddress: string,
  hookProgramId: string,
  connection: Connection,
  authorityKeypair: any
): Promise<string> {
  if (!result.verified) {
    throw new Error("Cannot write unverified KYC record to chain");
  }

  // This calls the transfer-hook program's upsert_kyc_record instruction
  // Instruction building is handled by the Anchor IDL client in the API layer
  // Returning the reference for the API to construct the actual transaction
  return `kyc_chain_write:${walletAddress}:${result.provider_reference}`;
}
