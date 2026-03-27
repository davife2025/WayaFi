/**
 * IroFi Corridor Routes
 * Liquidity, FX rates, and corridor health for each supported corridor.
 */
import { FastifyInstance } from "fastify";

const CORRIDORS = ["NG_KE", "NG_ZA", "NG_GH", "KE_ZA", "KE_GH"];

export async function corridorRoutes(app: FastifyInstance) {

  // GET /v1/corridors — list all corridors with liquidity + health
  app.get("/corridors", async (_req, reply) => {
    return reply.send({
      corridors: CORRIDORS.map((c) => ({
        id: c,
        is_active: true,
        total_liquidity_usdc: 0,   // wired to on-chain pool in session 6
        pending_settlements_usdc: 0,
        transfer_fee_bps: 50,
        min_transfer_usdc: 100,
        max_transfer_usdc: 500_000,
        avg_settlement_seconds: 8,
        fatf_grey_listed: ["NG", "AO"].some((j) => c.startsWith(j)),
      })),
    });
  });

  // GET /v1/corridors/:id — detailed corridor stats
  app.get("/corridors/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!CORRIDORS.includes(id)) {
      return reply.code(404).send({ error: "CORRIDOR_NOT_FOUND" });
    }
    return reply.send({
      id,
      is_active: true,
      total_liquidity_usdc: 0,
      pending_settlements_usdc: 0,
      transfer_fee_bps: 50,
      fx_rate: null,           // populated from Pyth oracle in session 6
      fx_rate_updated_at: null,
    });
  });
}