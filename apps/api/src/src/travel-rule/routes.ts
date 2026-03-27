/**
 * IroFi Travel Rule API Routes
 * Handles outbound TRISA inquiries and inbound VASP requests.
 */

import { FastifyInstance } from "fastify";
import {
  initiateExchange,
  handleIncomingInquiry,
  buildIVMS101Payload,
} from "@irofi/travel-rule";
import type { TRISAConfig } from "@irofi/travel-rule";

function getTRISAConfig(): TRISAConfig {
  return {
    irofi_vasp_did: process.env.IROFI_VASP_DID!,
    irofi_vasp_name: "IroFi Protocol",
    private_key_pem: process.env.TRISA_PRIVATE_KEY_PEM!,
    certificate_pem: process.env.TRISA_CERTIFICATE_PEM!,
    hmac_secret: process.env.TRISA_HMAC_SECRET!,
    gds_endpoint: process.env.TRISA_GDS_ENDPOINT ?? "https://api.trisatest.net",
    environment: (process.env.NODE_ENV === "production" ? "mainnet" : "testnet") as "mainnet" | "testnet",
  };
}

export async function travelRuleRoutes(app: FastifyInstance) {

  /**
   * POST /travel-rule/initiate
   * Initiate Travel Rule exchange for an outbound transfer.
   * Called by the transfer service before settlement proceeds.
   */
  app.post("/travel-rule/initiate", {
    schema: {
      body: {
        type: "object",
        required: [
          "transfer_id", "sender_wallet", "receiver_wallet",
          "sender_jurisdiction", "receiver_jurisdiction",
          "amount_usdc", "corridor",
          "sender_name", "sender_registration_number",
          "receiver_name", "receiver_registration_number",
        ],
      },
    },
  }, async (req, reply) => {
    const body = req.body as any;

    const ivms101 = buildIVMS101Payload({
      sender_name: body.sender_name,
      sender_wallet: body.sender_wallet,
      sender_jurisdiction: body.sender_jurisdiction,
      sender_registration_number: body.sender_registration_number,
      receiver_name: body.receiver_name,
      receiver_wallet: body.receiver_wallet,
      receiver_jurisdiction: body.receiver_jurisdiction,
      receiver_registration_number: body.receiver_registration_number,
      originating_vasp_name: "IroFi Protocol",
      beneficiary_vasp_name: body.receiver_name,
    });

    const record = await initiateExchange({
      transfer_id: body.transfer_id,
      sender_wallet: body.sender_wallet,
      receiver_wallet: body.receiver_wallet,
      sender_jurisdiction: body.sender_jurisdiction,
      receiver_jurisdiction: body.receiver_jurisdiction,
      amount_usdc: body.amount_usdc,
      corridor: body.corridor,
      ivms101_payload: ivms101,
      config: getTRISAConfig(),
    });

    const blocked = record.state === "NOT_COMPLIED" || record.state === "REJECTED";

    return reply.code(blocked ? 422 : 200).send({
      transfer_id: record.transfer_id,
      state: record.state,
      envelope_id: record.envelope_id,
      beneficiary_vasp: record.beneficiary_vasp_name,
      sunrise_exemption: record.sunrise_exemption,
      sunrise_reason: record.sunrise_reason,
      rejection_reason: record.rejection_reason,
      can_proceed: !blocked,
    });
  });

  /**
   * POST /travel-rule/incoming
   * Receive a Travel Rule inquiry from another VASP (IroFi as beneficiary).
   * This endpoint is called by counterparty VASPs sending TRISA inquiries.
   */
  app.post("/travel-rule/incoming", async (req, reply) => {
    const inquiry = req.body as any;

    const response = await handleIncomingInquiry(
      inquiry,
      getTRISAConfig(),
      async (payload, transaction) => {
        // Compliance acceptance callback:
        // In Session 5 this calls the full compliance pipeline
        app.log.info({
          msg: "Incoming Travel Rule inquiry",
          transfer_id: transaction.id,
          amount: transaction.amount,
          originating_vasp: transaction.originating_vasp,
        });
        // Auto-accept for now; Session 5 wires in full AML assessment
        return true;
      }
    );

    return reply.send(response);
  });

  /**
   * GET /travel-rule/vasp/:address
   * Look up a VASP by wallet address — useful for pre-flight checks.
   */
  app.get("/travel-rule/vasp/:address", async (req, reply) => {
    const { address } = req.params as { address: string };
    const { lookupVASPByAddress } = await import("@irofi/travel-rule");

    const config = getTRISAConfig();
    const vasp = await lookupVASPByAddress(address, {
      endpoint: config.gds_endpoint,
      certPath: "",
      keyPath: "",
      environment: config.environment,
    });

    if (!vasp) {
      return reply.code(404).send({
        found: false,
        message: "VASP not registered in TRISA directory (sunrise problem)",
      });
    }

    return reply.send({
      found: true,
      vasp_id: vasp.id,
      vasp_name: vasp.name,
      country: vasp.country,
      trisa_endpoint: vasp.trisa_endpoint,
      verified_on: vasp.verified_on,
      travel_rule_policy: vasp.travel_rule_policy,
    });
  });
}
