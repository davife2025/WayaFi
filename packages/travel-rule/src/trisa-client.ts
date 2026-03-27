/**
 * IroFi TRISA Client
 * Handles the full VASP-to-VASP Travel Rule exchange lifecycle.
 * Implements the TRISA protocol for encrypted IVMS101 data exchange.
 *
 * Flow:
 *   1. IroFi (originating VASP) looks up beneficiary VASP in GDS
 *   2. Sends encrypted TRISAInquiry to beneficiary VASP endpoint
 *   3. Beneficiary VASP replies with TRISAReply (accept / reject / repair)
 *   4. On acceptance, on-chain settlement proceeds
 *   5. Completion notification sent back to beneficiary VASP
 */

import { sealEnvelope, openEnvelope } from "./envelope";
import { lookupVASPByAddress, lookupVASPByDID, handleSunriseProblem, validateVASPCertificate } from "./vasp-directory";
import {
  requiresTravelRule,
  type IVMS101Payload,
  type TRISAInquiry,
  type TRISAReply,
  type TRISATransaction,
  type TRISATransferState,
  type VASPRecord,
} from "./types";

// ── Config ─────────────────────────────────────────────────────────────────

export interface TRISAConfig {
  irofi_vasp_did: string;
  irofi_vasp_name: string;
  private_key_pem: string;         // IroFi's RSA private key
  certificate_pem: string;         // IroFi's X.509 certificate
  hmac_secret: string;
  gds_endpoint: string;
  environment: "testnet" | "mainnet";
}

// ── Transfer Record ────────────────────────────────────────────────────────

export interface TravelRuleRecord {
  transfer_id: string;
  tx_signature?: string;
  originating_vasp_did: string;
  beneficiary_vasp_did: string;
  beneficiary_vasp_name: string;
  amount_usdc: number;
  corridor: string;
  ivms101_payload: IVMS101Payload;
  envelope_id: string;
  state: TRISATransferState;
  sunrise_exemption: boolean;
  sunrise_reason?: string;
  initiated_at: Date;
  resolved_at?: Date;
  rejection_reason?: string;
}

// ── Main TRISA Exchange ────────────────────────────────────────────────────

/**
 * Initiate Travel Rule exchange with the beneficiary VASP.
 * Returns a TravelRuleRecord that tracks the exchange state.
 */
export async function initiateExchange(params: {
  transfer_id: string;
  sender_wallet: string;
  receiver_wallet: string;
  sender_jurisdiction: string;
  receiver_jurisdiction: string;
  amount_usdc: number;
  corridor: string;
  ivms101_payload: IVMS101Payload;
  config: TRISAConfig;
}): Promise<TravelRuleRecord> {

  const {
    transfer_id, sender_wallet, receiver_wallet,
    sender_jurisdiction, receiver_jurisdiction,
    amount_usdc, corridor, ivms101_payload, config,
  } = params;

  // ── Step 1: Check if Travel Rule applies ────────────────────────────────
  const trRequired = requiresTravelRule(amount_usdc, sender_jurisdiction, receiver_jurisdiction);

  if (!trRequired) {
    return buildRecord({
      transfer_id, amount_usdc, corridor, ivms101_payload,
      vasp_did: "N/A", vasp_name: "N/A",
      envelope_id: "not-required",
      state: "COMPLETED",
      sunrise_exemption: true,
      sunrise_reason: `Amount $${amount_usdc} below Travel Rule threshold for ${sender_jurisdiction}/${receiver_jurisdiction}`,
    });
  }

  // ── Step 2: Look up beneficiary VASP ────────────────────────────────────
  const beneficiaryVASP = await lookupVASPByAddress(receiver_wallet, {
    endpoint: config.gds_endpoint,
    certPath: "",
    keyPath: "",
    environment: config.environment,
  });

  // ── Step 3: Handle sunrise problem (VASP not registered) ────────────────
  if (!beneficiaryVASP) {
    const sunriseDecision = handleSunriseProblem(
      sender_jurisdiction,
      receiver_jurisdiction,
      amount_usdc
    );

    if (sunriseDecision.strategy === "block") {
      return buildRecord({
        transfer_id, amount_usdc, corridor, ivms101_payload,
        vasp_did: "UNREGISTERED", vasp_name: "UNREGISTERED",
        envelope_id: "blocked",
        state: "NOT_COMPLIED",
        sunrise_exemption: false,
        sunrise_reason: sunriseDecision.reason,
      });
    }

    // proceed_with_log — sunrise exemption
    return buildRecord({
      transfer_id, amount_usdc, corridor, ivms101_payload,
      vasp_did: "UNREGISTERED", vasp_name: "UNREGISTERED",
      envelope_id: "sunrise-exempt",
      state: "COMPLETED",
      sunrise_exemption: true,
      sunrise_reason: sunriseDecision.reason,
    });
  }

  // ── Step 4: Validate beneficiary VASP certificate ───────────────────────
  const certValidation = await validateVASPCertificate(beneficiaryVASP);
  if (!certValidation.valid) {
    return buildRecord({
      transfer_id, amount_usdc, corridor, ivms101_payload,
      vasp_did: beneficiaryVASP.id, vasp_name: beneficiaryVASP.name,
      envelope_id: "cert-invalid",
      state: "REJECTED",
      sunrise_exemption: false,
      sunrise_reason: `Invalid VASP certificate: ${certValidation.reason}`,
    });
  }

  // ── Step 5: Seal envelope with beneficiary VASP's public key ────────────
  const envelope = await sealEnvelope(
    ivms101_payload,
    beneficiaryVASP.signing_certificate,
    config.private_key_pem,
    config.hmac_secret
  );

  // ── Step 6: Build TRISA transaction object ───────────────────────────────
  const transaction: TRISATransaction = {
    id: transfer_id,
    txid: transfer_id,
    originator: sender_wallet,
    beneficiary: receiver_wallet,
    originating_vasp: config.irofi_vasp_did,
    beneficiary_vasp: beneficiaryVASP.id,
    network: "solana",
    asset_type: "USDC",
    amount: amount_usdc,
    tag: ivms101_payload.originator.accountNumber[0],
    timestamp: new Date().toISOString(),
  };

  // ── Step 7: Send TRISA inquiry to beneficiary VASP ──────────────────────
  const inquiry: TRISAInquiry = { envelope, transaction };
  const reply = await sendTRISAInquiry(inquiry, beneficiaryVASP, config);

  // ── Step 8: Handle reply ─────────────────────────────────────────────────
  return buildRecord({
    transfer_id, amount_usdc, corridor, ivms101_payload,
    vasp_did: beneficiaryVASP.id,
    vasp_name: beneficiaryVASP.name,
    envelope_id: envelope.id,
    state: reply.transfer_state,
    sunrise_exemption: false,
    rejection_reason: reply.rejected_reason,
  });
}

// ── TRISA HTTP Transport ───────────────────────────────────────────────────

async function sendTRISAInquiry(
  inquiry: TRISAInquiry,
  beneficiaryVASP: VASPRecord,
  config: TRISAConfig
): Promise<TRISAReply> {
  // TRISA uses gRPC in production; here we use the HTTP/JSON bridge
  // that TRISA Envoy exposes for easier integration
  const endpoint = beneficiaryVASP.trisa_endpoint;

  if (!endpoint) {
    return {
      ...inquiry,
      transfer_state: "NOT_COMPLIED",
      rejected_reason: "Beneficiary VASP has no TRISA endpoint configured",
    };
  }

  try {
    const res = await fetch(`${endpoint}/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VASP-ID": config.irofi_vasp_did,
        "X-Certificate": config.certificate_pem,
      },
      body: JSON.stringify(inquiry),
      signal: AbortSignal.timeout(15_000), // 15s timeout
    });

    if (!res.ok) {
      return {
        ...inquiry,
        transfer_state: "REVIEW_NO_REPLY",
        rejected_reason: `HTTP ${res.status}: ${await res.text()}`,
      };
    }

    return await res.json() as TRISAReply;

  } catch (err: any) {
    if (err.name === "TimeoutError") {
      return {
        ...inquiry,
        transfer_state: "REVIEW_NO_REPLY",
        rejected_reason: "Beneficiary VASP did not respond within 15 seconds",
      };
    }
    return {
      ...inquiry,
      transfer_state: "NOT_COMPLIED",
      rejected_reason: `Network error: ${err.message}`,
    };
  }
}

// ── Handle Incoming Inquiry ────────────────────────────────────────────────

/**
 * Handle an incoming TRISA inquiry from another VASP.
 * IroFi as beneficiary VASP — validate, decrypt, and accept/reject.
 */
export async function handleIncomingInquiry(
  inquiry: TRISAInquiry,
  config: TRISAConfig,
  onPayloadReceived: (payload: IVMS101Payload, transaction: TRISATransaction) => Promise<boolean>
): Promise<TRISAReply> {
  try {
    // Decrypt the envelope
    const payload = await openEnvelope(
      inquiry.envelope,
      config.private_key_pem,
      config.hmac_secret
    );

    // Validate the payload has required IVMS101 fields
    const validationError = validateIVMS101(payload);
    if (validationError) {
      return {
        ...inquiry,
        transfer_state: "REPAIR_REQUESTED",
        rejected_reason: validationError,
      };
    }

    // Call the acceptance callback (compliance check by API layer)
    const accepted = await onPayloadReceived(payload, inquiry.transaction);

    return {
      ...inquiry,
      transfer_state: accepted ? "ACCEPTED" : "REJECTED",
      rejected_reason: accepted ? undefined : "Transfer rejected by IroFi compliance engine",
    };

  } catch (err: any) {
    return {
      ...inquiry,
      transfer_state: "REPAIR_REQUESTED",
      rejected_reason: `Envelope decryption failed: ${err.message}`,
    };
  }
}

// ── IVMS101 Validation ─────────────────────────────────────────────────────

function validateIVMS101(payload: IVMS101Payload): string | null {
  if (!payload.originator) return "Missing originator";
  if (!payload.beneficiary) return "Missing beneficiary";
  if (!payload.originatingVASP) return "Missing originatingVASP";
  if (!payload.originator.accountNumber?.length) return "Originator account number required";
  if (!payload.beneficiary.accountNumber?.length) return "Beneficiary account number required";
  if (!payload.originator.originatorPersons?.length) return "Originator person data required";
  if (!payload.beneficiary.beneficiaryPersons?.length) return "Beneficiary person data required";
  return null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildRecord(p: {
  transfer_id: string;
  amount_usdc: number;
  corridor: string;
  ivms101_payload: IVMS101Payload;
  vasp_did: string;
  vasp_name: string;
  envelope_id: string;
  state: TRISATransferState;
  sunrise_exemption: boolean;
  sunrise_reason?: string;
  rejection_reason?: string;
}): TravelRuleRecord {
  return {
    transfer_id: p.transfer_id,
    originating_vasp_did: "irofi-vasp-did",
    beneficiary_vasp_did: p.vasp_did,
    beneficiary_vasp_name: p.vasp_name,
    amount_usdc: p.amount_usdc,
    corridor: p.corridor,
    ivms101_payload: p.ivms101_payload,
    envelope_id: p.envelope_id,
    state: p.state,
    sunrise_exemption: p.sunrise_exemption,
    sunrise_reason: p.sunrise_reason,
    initiated_at: new Date(),
    resolved_at: ["COMPLETED", "ACCEPTED", "REJECTED", "NOT_COMPLIED"].includes(p.state)
      ? new Date()
      : undefined,
    rejection_reason: p.rejection_reason,
  };
}

// ── IVMS101 Builder Helpers ────────────────────────────────────────────────

/** Build a minimal IVMS101 payload for an institutional transfer */
export function buildIVMS101Payload(params: {
  sender_name: string;
  sender_wallet: string;
  sender_jurisdiction: string;
  sender_registration_number: string;
  receiver_name: string;
  receiver_wallet: string;
  receiver_jurisdiction: string;
  receiver_registration_number: string;
  originating_vasp_name: string;
  beneficiary_vasp_name: string;
}): IVMS101Payload {
  return {
    originator: {
      originatorPersons: [{
        legalPerson: {
          name: {
            nameIdentifier: [{
              legalPersonName: params.sender_name,
              legalPersonNameIdentifierType: "LEGL",
            }],
          },
          nationalIdentification: {
            nationalIdentifier: params.sender_registration_number,
            nationalIdentifierType: "RAID",
            countryOfIssue: params.sender_jurisdiction,
          },
          countryOfRegistration: params.sender_jurisdiction,
        },
      }],
      accountNumber: [params.sender_wallet],
    },
    beneficiary: {
      beneficiaryPersons: [{
        legalPerson: {
          name: {
            nameIdentifier: [{
              legalPersonName: params.receiver_name,
              legalPersonNameIdentifierType: "LEGL",
            }],
          },
          nationalIdentification: {
            nationalIdentifier: params.receiver_registration_number,
            nationalIdentifierType: "RAID",
            countryOfIssue: params.receiver_jurisdiction,
          },
          countryOfRegistration: params.receiver_jurisdiction,
        },
      }],
      accountNumber: [params.receiver_wallet],
    },
    originatingVASP: {
      originatingVASP: {
        legalPerson: {
          name: {
            nameIdentifier: [{
              legalPersonName: params.originating_vasp_name,
              legalPersonNameIdentifierType: "LEGL",
            }],
          },
        },
      },
    },
    beneficiaryVASP: {
      beneficiaryVASP: {
        legalPerson: {
          name: {
            nameIdentifier: [{
              legalPersonName: params.beneficiary_vasp_name,
              legalPersonNameIdentifierType: "LEGL",
            }],
          },
        },
      },
    },
  };
}
