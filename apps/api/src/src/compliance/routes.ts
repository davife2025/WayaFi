/**
 * IroFi Compliance API Routes
 * Fastify routes for KYC, KYT, AML, and sanctions endpoints.
 */

import { FastifyInstance } from "fastify";
import { verifyKYC } from "@irofi/compliance";
import { screenTransaction } from "@irofi/compliance";
import { checkSanctions } from "@irofi/compliance";
import { assessAMLRisk } from "@irofi/compliance";

export async function complianceRoutes(app: FastifyInstance) {

  /** POST /compliance/kyc — Submit institution for KYC verification */
  app.post("/compliance/kyc", {
    schema: {
      body: {
        type: "object",
        required: ["institution_id", "wallet_address", "jurisdiction", "document_type", "document_front_base64"],
        properties: {
          institution_id: { type: "string" },
          wallet_address: { type: "string" },
          jurisdiction: { type: "string", enum: ["NG", "KE", "ZA", "GH", "AO", "CM", "CD", "TZ", "UG"] },
          document_type: { type: "string" },
          document_front_base64: { type: "string" },
          document_back_base64: { type: "string" },
          selfie_base64: { type: "string" },
          business_name: { type: "string" },
          registration_number: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as any;

    const result = await verifyKYC(body, {
      apiKey: process.env.SMILE_ID_API_KEY!,
      partnerId: process.env.SMILE_ID_PARTNER_ID!,
      environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
    });

    // If verified, write to chain
    if (result.verified) {
      app.log.info(`KYC verified for ${body.wallet_address} — writing to chain`);
      // Chain write handled by separate worker to avoid blocking HTTP response
    }

    return reply.send({
      success: result.verified,
      status: result.status,
      risk_score: result.risk_score,
      flags: result.flags,
      expires_at: result.expires_at,
      enhanced_due_diligence_required: result.enhanced_due_diligence_required,
      provider_reference: result.provider_reference,
    });
  });

  /** POST /compliance/kyt — Screen a pending transaction */
  app.post("/compliance/kyt", {
    schema: {
      body: {
        type: "object",
        required: ["sender_address", "receiver_address", "amount_usdc", "corridor"],
        properties: {
          sender_address: { type: "string" },
          receiver_address: { type: "string" },
          amount_usdc: { type: "number" },
          corridor: { type: "string" },
          memo: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as any;

    const result = await screenTransaction(body, {
      apiKey: process.env.ELLIPTIC_API_KEY!,
      apiSecret: process.env.ELLIPTIC_API_SECRET!,
      environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
    });

    return reply.code(result.approved ? 200 : 422).send({
      approved: result.approved,
      risk_level: result.risk_level,
      risk_score: result.risk_score,
      flags: result.flags,
      hold_for_review: result.hold_for_review,
      screening_id: result.screening_id,
    });
  });

  /** POST /compliance/sanctions — Check wallet against sanctions lists */
  app.post("/compliance/sanctions", {
    schema: {
      body: {
        type: "object",
        required: ["wallet_address", "jurisdiction"],
        properties: {
          wallet_address: { type: "string" },
          jurisdiction: { type: "string" },
          entity_name: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as any;

    const result = await checkSanctions(body, {
      ellipticApiKey: process.env.ELLIPTIC_API_KEY!,
      environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
    });

    return reply.code(result.is_sanctioned ? 403 : 200).send({
      is_sanctioned: result.is_sanctioned,
      matched_lists: result.matched_lists,
      confidence: result.confidence,
      screening_id: result.screening_id,
    });
  });

  /** POST /compliance/aml/assess — Full AML assessment for a transfer */
  app.post("/compliance/aml/assess", async (req, reply) => {
    const ctx = req.body as any;

    const assessment = assessAMLRisk(ctx);

    return reply.code(assessment.decision === "reject" ? 422 : 200).send(assessment);
  });
}
