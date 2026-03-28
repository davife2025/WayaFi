import { FastifyInstance } from "fastify";
import { generateChallenge, verifyWalletSignature } from "../middleware/auth";
export async function institutionRoutes(app: FastifyInstance) {
  app.post("/auth/challenge", {
    schema: { body: { type: "object", required: ["wallet_address"], properties: { wallet_address: { type: "string" } } } },
  }, async (req, reply) => {
    const { wallet_address } = req.body as { wallet_address: string };
    return reply.send({ challenge: generateChallenge(wallet_address), expires_in_seconds: 300 });
  });

  app.post("/auth/login", {
    schema: { body: { type: "object", required: ["wallet_address","signature"], properties: { wallet_address: { type: "string" }, signature: { type: "string" } } } },
  }, async (req, reply) => {
    const { wallet_address, signature } = req.body as { wallet_address: string; signature: string };
    const valid = verifyWalletSignature(wallet_address, signature);
    if (!valid) return reply.code(401).send({ error: "INVALID_SIGNATURE" });
    const token = await reply.jwtSign({ wallet_address, institution_id: `inst_${wallet_address.slice(0,8)}`, role: "operator" });
    return reply.send({ token, expires_in: "24h" });
  });

  app.post("/institutions", async (req, reply) => {
    const body = req.body as any;
    return reply.code(201).send({ id: `inst_${Date.now()}`, name: body.name, jurisdiction: body.jurisdiction, wallet_address: body.wallet_address, kyc_status: "pending", created_at: new Date().toISOString() });
  });

  app.get("/institutions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send({ id, kyc_status: "verified", aml_risk_score: 28, sanctions_clear: true });
  });
}
