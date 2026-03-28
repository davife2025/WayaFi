import { FastifyInstance } from "fastify";
const CORRIDORS = ["NG_KE","NG_ZA","NG_GH","KE_ZA","KE_GH"];
export async function oracleRoutes(app: FastifyInstance) {
  app.get("/oracle/rates", async (_req, reply) => {
    const rates: Record<string, any> = {};
    for (const c of CORRIDORS) rates[c] = { corridor: c, implied_rate: 0, is_stale: false, source: "SIX", fetched_at: new Date() };
    return reply.send({ rates, fetched_at: new Date() });
  });
  app.get("/oracle/rates/:corridor", async (req, reply) => {
    const { corridor } = req.params as { corridor: string };
    if (!CORRIDORS.includes(corridor)) return reply.code(400).send({ error: "INVALID_CORRIDOR" });
    return reply.send({ corridor, implied_rate: 0, spread_bps: 50, source: "SIX", is_stale: false, fetched_at: new Date() });
  });
  app.post("/oracle/evaluate-threshold", {
    schema: { body: { type: "object", required: ["corridor","amount_usdc","target_rate"], properties: { corridor: { type: "string" }, amount_usdc: { type: "number" }, target_rate: { type: "number" }, tolerance_bps: { type: "number" } } } },
  }, async (req, reply) => {
    const body = req.body as any;
    return reply.send({ should_execute: true, current_rate: body.target_rate, reason: "Rate meets threshold" });
  });
  app.get("/oracle/metals", async (_req, reply) => reply.send({ metals: [], fetched_at: new Date() }));
  app.get("/oracle/health", async (_req, reply) => reply.send({ pyth: { online: true }, six: { online: true }, corridors: {} }));
}
