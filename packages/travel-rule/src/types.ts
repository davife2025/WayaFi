/**
 * IroFi Travel Rule — Core Types
 * Based on FATF Recommendation 16 (June 2025 revision)
 * and IVMS101 (interVASP Messaging Standard)
 */

// ── IVMS101 Identity Types ─────────────────────────────────────────────────

export interface IVMS101NaturalPerson {
  name: {
    nameIdentifier: Array<{
      primaryIdentifier: string;    // surname
      secondaryIdentifier: string;  // given name
      nameIdentifierType: "LEGL" | "BIRT" | "MAID" | "NAKA" | "MISC";
    }>;
  };
  geographicAddress?: Array<{
    addressType: "HOME" | "BIZZ" | "GEOG";
    streetName?: string;
    buildingNumber?: string;
    townName: string;
    countrySubDivision?: string;
    country: string;              // ISO 3166-1 alpha-2
    addressLine?: string[];
  }>;
  nationalIdentification?: {
    nationalIdentifier: string;
    nationalIdentifierType:
      | "ARNU"  // Alien Registration Number
      | "CCPT"  // Passport Number
      | "RAID"  // Employer Identification Number
      | "DRLC"  // Driver's License
      | "FIIN"  // Foreign Investment Identity Number
      | "TXID"  // Tax Identification Number
      | "SOCS"  // Social Security Number
      | "IDCD"  // Identity Card Number
      | "LEIX"  // Legal Entity Identifier
      | "MISC"; // Other
    countryOfIssue?: string;
    registrationAuthority?: string;
  };
  dateAndPlaceOfBirth?: {
    dateOfBirth: string;          // YYYY-MM-DD
    placeOfBirth: string;
  };
  countryOfResidence?: string;
}

export interface IVMS101LegalPerson {
  name: {
    nameIdentifier: Array<{
      legalPersonName: string;
      legalPersonNameIdentifierType: "LEGL" | "SHRT" | "TRAD";
    }>;
  };
  geographicAddress?: IVMS101NaturalPerson["geographicAddress"];
  nationalIdentification?: {
    nationalIdentifier: string;
    nationalIdentifierType:
      | "RAID"  // Employer Identification Number
      | "MISC"  // Other
      | "LEIX"  // LEI
      | "TXID"; // Tax ID
    countryOfIssue?: string;
    registrationAuthority?: string;
  };
  countryOfRegistration?: string;
}

export type IVMS101Originator = {
  originatorPersons: Array<
    | { naturalPerson: IVMS101NaturalPerson }
    | { legalPerson: IVMS101LegalPerson }
  >;
  accountNumber: string[];        // wallet addresses
};

export type IVMS101Beneficiary = {
  beneficiaryPersons: Array<
    | { naturalPerson: IVMS101NaturalPerson }
    | { legalPerson: IVMS101LegalPerson }
  >;
  accountNumber: string[];
};

// ── IVMS101 Full Payload ───────────────────────────────────────────────────

export interface IVMS101Payload {
  originator: IVMS101Originator;
  beneficiary: IVMS101Beneficiary;
  originatingVASP: {
    originatingVASP: { legalPerson: IVMS101LegalPerson };
  };
  beneficiaryVASP?: {
    beneficiaryVASP: { legalPerson: IVMS101LegalPerson };
  };
  transferPath?: {
    intermediaryVASP: Array<{
      intermediaryVASP: { legalPerson: IVMS101LegalPerson };
      sequence: number;
    }>;
  };
}

// ── TRISA Protocol Types ───────────────────────────────────────────────────

export type TRISATransferState =
  | "AWAITING_REQUEST"
  | "PENDING_REVIEW"
  | "REVIEW_NO_REPLY"
  | "REPAIR_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "NOT_COMPLIED"
  | "EXPIRED"
  | "COMPLETED";

export interface TRISAEnvelope {
  id: string;                   // UUID
  payload: string;              // base64-encoded encrypted IVMS101 payload
  encryption_key: string;       // RSA-encrypted AES key
  encryption_algorithm: string; // e.g. "AES256-GCM"
  hmac_signature: string;       // HMAC-SHA256 of payload
  public_key_signature: string; // identifies sender's certificate
  timestamp: string;            // ISO 8601
  transfer_state: TRISATransferState;
}

export interface TRISATransaction {
  id: string;
  txid: string;                 // on-chain transaction signature
  originator: string;           // sender wallet
  beneficiary: string;          // receiver wallet
  originating_vasp: string;     // sender VASP DID
  beneficiary_vasp: string;     // receiver VASP DID
  network: "solana";
  asset_type: "USDC";
  amount: number;
  tag?: string;                  // memo / reference
  timestamp: string;
}

export interface TRISAInquiry {
  envelope: TRISAEnvelope;
  transaction: TRISATransaction;
}

export interface TRISAReply {
  envelope: TRISAEnvelope;
  transaction: TRISATransaction;
  transfer_state: TRISATransferState;
  rejected_reason?: string;
}

// ── VASP Directory Types ───────────────────────────────────────────────────

export interface VASPRecord {
  id: string;
  name: string;
  website: string;
  country: string;
  business_category: "EXCHANGE" | "DEX" | "P2P" | "KIOSK" | "CUSTODIAN" | "OTC" | "FUND" | "PROJECT" | "GAMBLING" | "MINER" | "MIXER" | "OTHER";
  vasp_categories: string[];
  verified_on: string;
  identity_certificate: string; // X.509 PEM
  signing_certificate: string;  // X.509 PEM
  trisa_endpoint: string;       // gRPC endpoint
  travel_rule_policy: TravelRulePolicy;
}

export interface TravelRulePolicy {
  threshold_amount: number;     // USD equivalent
  threshold_currency: string;
  applies_to_all: boolean;      // true = no threshold (EU MiCA)
  jurisdictions: string[];      // applicable jurisdiction codes
}

// ── Transfer Rule Thresholds ───────────────────────────────────────────────

/** Travel Rule threshold by jurisdiction (USD equivalent) */
export const TRAVEL_RULE_THRESHOLDS: Record<string, number> = {
  US: 1000,   // FinCEN
  EU: 0,      // EU MiCA/TFR — all transfers
  UK: 0,      // UK — all transfers  
  NG: 0,      // Nigeria — all transfers (VASP Act 2025)
  KE: 0,      // Kenya — all transfers (VASP Act Oct 2025)
  ZA: 1000,   // South Africa
  GH: 0,      // Ghana — all transfers (VARO)
  DEFAULT: 1000,
};

export function requiresTravelRule(
  amount: number,
  senderJurisdiction: string,
  receiverJurisdiction: string
): boolean {
  const senderThreshold = TRAVEL_RULE_THRESHOLDS[senderJurisdiction] ?? TRAVEL_RULE_THRESHOLDS.DEFAULT!;
  const receiverThreshold = TRAVEL_RULE_THRESHOLDS[receiverJurisdiction] ?? TRAVEL_RULE_THRESHOLDS.DEFAULT!;
  // Apply the stricter (lower) threshold
  const effectiveThreshold = Math.min(senderThreshold, receiverThreshold);
  return amount >= effectiveThreshold;
}
