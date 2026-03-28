import { FastifyInstance } from "fastify";
const CORRIDORS = ["NG_KE","NG_ZA","NG_GH","KE_ZA","KE_GH"];
export async function corridorRoutes(app: FastifyInstance) {
  app.get("/corridors", async (_req, reply) => reply.send({
    corridors: CORRIDORS.map((c) => ({
      id: c, is_active: true, total_liquidity_usdc: 0,
      pending_settlements_usdc: 0, transfer_fee_bps: 50,
      min_transfer_usdc: 100, max_transfer_usdc: 500_000,
      avg_settlement_seconds: 8,
      fatf_grey_listed: ["NG","AO"].some((j) => c.startsWith(j)),
    })),
  }));
  app.get("/corridors/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!CORRIDORS.includes(id)) return reply.code(404).send({ error: "CORRIDOR_NOT_FOUND" });
    return reply.send({ id, is_active: true, total_liquidity_usdc: 0, transfer_fee_bps: 50 });
  });
}
