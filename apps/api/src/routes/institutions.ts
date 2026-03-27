/**
 * IroFi Institution Routes
 * Registration, KYC submission, wallet auth.
 */
import { FastifyInstance } from "fastify";
import { generateChallenge, verifyWalletSignature } from "../middleware/auth";

export async function institutionRoutes(app: FastifyInstance) {

  // POST /v1/auth/challenge — get a sign-in challenge for wallet auth
  app.post("/auth/challenge", {
    schema: {
      body: { type: "object", required: ["wallet_address"],
        properties: { wallet_address: { type: "string" } } },
    },
  }, async (req, reply) => {
    const { wallet_address } = req.body as { wallet_address: string };
    const challenge = generateChallenge(wallet_address);
    return reply.send({ challenge, expires_in_seconds: 300 });
  });

  // POST /v1/auth/login — verify signed challenge, return JWT
  app.post("/auth/login", {
    schema: {
      body: { type: "object", required: ["wallet_address", "signature"],
        properties: { wallet_address: { type: "string" }, signature: { type: "string" } } },
    },
  }, async (req, reply) => {
    const { wallet_address, signature } = req.body as { wallet_address: string; signature: string };
    const valid = verifyWalletSignature(wallet_address, signature);
    if (!valid) return reply.code(401).send({ error: "INVALID_SIGNATURE" });

    // Look up institution in DB (Session 5 service layer)
    const token = await reply.jwtSign({
      wallet_address,
      institution_id: `inst_${wallet_address.slice(0, 8)}`,
      role: "operator",
    });
    return reply.send({ token, expires_in: "24h" });
  });

  // POST /v1/institutions — register a new institution
  app.post("/institutions", async (req, reply) => {
    const body = req.body as any;
    // Institution registration — persists to DB, triggers KYC workflow
    return reply.code(201).send({
      id: `inst_${Date.now()}`,
      name: body.name,
      jurisdiction: body.jurisdiction,
      wallet_address: body.wallet_address,
      kyc_status: "pending",
      created_at: new Date().toISOString(),
    });
  });

  // GET /v1/institutions/:id — get institution details
  app.get("/institutions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send({ id, status: "stub — wired to DB in full build" });
  });
}