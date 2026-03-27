/**
 * IroFi Sanctions Screening Module
 * Checks every wallet address against OFAC SDN, UN, EU, and UK sanctions lists.
 * Uses Elliptic for blockchain-native screening + direct list lookups.
 */

export interface SanctionsCheckRequest {
  wallet_address: string;
  entity_name?: string;       // business or individual name
  jurisdiction: string;       // sending/receiving jurisdiction
}

export interface SanctionsCheckResult {
  is_sanctioned: boolean;
  matched_lists: SanctionsList[];
  confidence: number;         // 0–1
  match_details: SanctionsMatch[];
  checked_at: Date;
  screening_id: string;
}

export type SanctionsList =
  | "OFAC_SDN"            // US Treasury OFAC Specially Designated Nationals
  | "OFAC_NON_SDN"        // Other OFAC lists
  | "UN_SECURITY_COUNCIL" // UN Security Council sanctions
  | "EU_CONSOLIDATED"     // EU consolidated sanctions list
  | "UK_HMT"              // UK His Majesty's Treasury
  | "INTERPOL"            // Interpol Red Notices
  | "FATF_HIGH_RISK";     // FATF high-risk jurisdictions

export interface SanctionsMatch {
  list: SanctionsList;
  matched_name?: string;
  matched_address?: string;
  program?: string;           // e.g. "IRAN", "RUSSIA", "CYBER"
  confidence: number;
  reason: string;
}

// ── OFAC Screening via Elliptic ────────────────────────────────────────────

interface EllipticSanctionsResponse {
  id: string;
  is_sanctioned: boolean;
  sanctions_sources: Array<{
    source: string;
    name: string;
    program: string;
    confidence: number;
  }>;
}

async function checkEllipticSanctions(
  address: string,
  apiKey: string,
  environment: "sandbox" | "production"
): Promise<EllipticSanctionsResponse> {
  const baseUrl =
    environment === "production"
      ? "https://aml-api.elliptic.co"
      : "https://aml-api-sandbox.elliptic.co";

  const res = await fetch(`${baseUrl}/v2/wallet/synchronous`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-access-key": apiKey,
    },
    body: JSON.stringify({
      subject: {
        asset: "holistic",
        blockchain: "solana",
        type: "address",
        hash: address,
      },
      type: "sanctions_screening",
    }),
  });

  if (!res.ok) throw new Error(`Elliptic sanctions check failed: ${res.status}`);
  return res.json();
}

// ── FATF High-Risk Jurisdiction Check ─────────────────────────────────────

const FATF_HIGH_RISK_JURISDICTIONS = [
  "KP", // North Korea
  "IR", // Iran
  "MM", // Myanmar (Burma)
  "NG", // Nigeria (grey list)
  "AO", // Angola (grey list)
  "CM", // Cameroon (grey list)
  "CD", // DRC (grey list)
];

function checkFATFJurisdiction(jurisdiction: string): SanctionsMatch | null {
  if (FATF_HIGH_RISK_JURISDICTIONS.includes(jurisdiction)) {
    const isHighRisk = ["KP", "IR", "MM"].includes(jurisdiction);
    return {
      list: "FATF_HIGH_RISK",
      program: isHighRisk ? "HIGH_RISK_JURISDICTION" : "GREY_LIST",
      confidence: 1.0,
      reason: isHighRisk
        ? `${jurisdiction} is a FATF high-risk jurisdiction — transactions blocked`
        : `${jurisdiction} is on the FATF grey list — enhanced due diligence required`,
    };
  }
  return null;
}

// ── Entity Name Fuzzy Matching ─────────────────────────────────────────────

// In production, integrate with Refinitiv World-Check or ComplyAdvantage
// for entity name matching. This stub handles the interface.
async function checkEntityName(
  entityName: string
): Promise<SanctionsMatch[]> {
  if (!entityName) return [];

  // Stub — replace with ComplyAdvantage or Refinitiv API in production
  console.log(`[Sanctions] Entity name check: ${entityName} (stub — integrate ComplyAdvantage)`);
  return [];
}

// ── Main Sanctions Check ───────────────────────────────────────────────────

interface SanctionsConfig {
  ellipticApiKey: string;
  environment: "sandbox" | "production";
}

export async function checkSanctions(
  request: SanctionsCheckRequest,
  config: SanctionsConfig
): Promise<SanctionsCheckResult> {
  const matches: SanctionsMatch[] = [];

  // 1. Blockchain-native sanctions check via Elliptic
  const ellipticResult = await checkEllipticSanctions(
    request.wallet_address,
    config.ellipticApiKey,
    config.environment
  );

  if (ellipticResult.is_sanctioned) {
    for (const source of ellipticResult.sanctions_sources) {
      matches.push({
        list: mapEllipticSource(source.source),
        matched_address: request.wallet_address,
        matched_name: source.name,
        program: source.program,
        confidence: source.confidence,
        reason: `Wallet directly linked to sanctioned entity: ${source.name} (${source.program})`,
      });
    }
  }

  // 2. FATF jurisdiction check
  const fatfMatch = checkFATFJurisdiction(request.jurisdiction);
  if (fatfMatch) matches.push(fatfMatch);

  // 3. Entity name check (if provided)
  if (request.entity_name) {
    const nameMatches = await checkEntityName(request.entity_name);
    matches.push(...nameMatches);
  }

  const isSanctioned = matches.some(
    (m) =>
      m.list !== "FATF_HIGH_RISK" || // Non-FATF matches are hard blocks
      ["KP", "IR", "MM"].includes(request.jurisdiction) // FATF high-risk (not grey) = block
  );

  const maxConfidence = matches.length > 0
    ? Math.max(...matches.map((m) => m.confidence))
    : 0;

  return {
    is_sanctioned: isSanctioned,
    matched_lists: [...new Set(matches.map((m) => m.list))],
    confidence: maxConfidence,
    match_details: matches,
    checked_at: new Date(),
    screening_id: ellipticResult.id,
  };
}

function mapEllipticSource(source: string): SanctionsList {
  const map: Record<string, SanctionsList> = {
    OFAC: "OFAC_SDN",
    "UN Security Council": "UN_SECURITY_COUNCIL",
    "EU Consolidated": "EU_CONSOLIDATED",
    "UK HMT": "UK_HMT",
  };
  return map[source] ?? "OFAC_SDN";
}
