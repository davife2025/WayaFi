/**
 * IroFi Oracle API Routes
 * FX rates, precious metals, corridor health, rate-threshold evaluation.
 */
import { FastifyInstance } from "fastify";
import { FXRateEngine } from "@irofi/oracle";
import type { CorridorId } from "@irofi/oracle";

function getEngine(): FXRateEngine {
  return new FXRateEngine(
    process.env.SOLANA_NETWORK === "mainnet-beta" ? "mainnet" : "devnet",
    {
      api_key: process.env.SIX_API_KEY!,
      base_url: process.env.SIX_FX_ENDPOINT ?? "https://api.six-group.com/api/findata/v1",
      timeout_ms: 8_000,
    }
  );
}

const engine = getEngine();

export async function oracleRoutes(app: FastifyInstance) {

  // Start polling on boot
  engine.startPolling(30_000);
  engine.onAlert((alert) => {
    app.log.warn({ msg: "FX Alert", ...alert });
  });

  // GET /v1/oracle/rates — all corridor rates
  app.get("/oracle/rates", async (_req, reply) => {
    const rates = await engine.getAllCorridorRates();
    return reply.send({
      rates: Object.fromEntries(rates),
      fetched_at: new Date().toISOString(),
    });
  });

  // GET /v1/oracle/rates/:corridor — single corridor rate
  app.get("/oracle/rates/:corridor", async (req, reply) => {
    const { corridor } = req.params as { corridor: string };
    const validCorridors = ["NG_KE", "NG_ZA", "NG_GH", "KE_ZA", "KE_GH"];
    if (!validCorridors.includes(corridor)) {
      return reply.code(400).send({ error: "INVALID_CORRIDOR" });
    }
    const rate = await engine.getCorridorRate(corridor as CorridorId);
    if (!rate) return reply.code(503).send({ error: "RATE_UNAVAILABLE" });
    return reply.send(rate);
  });

  // POST /v1/oracle/evaluate-threshold — check if rate meets transfer threshold
  app.post("/oracle/evaluate-threshold", {
    schema: {
      body: {
        type: "object",
        required: ["corridor", "amount_usdc", "target_rate"],
        properties: {
          corridor: { type: "string" },
          amount_usdc: { type: "number" },
          target_rate: { type: "number" },
          tolerance_bps: { type: "number", default: 50 },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as any;
    const result = await engine.evaluateRateThreshold({
      corridor: body.corridor as CorridorId,
      amount_usdc: body.amount_usdc,
      target_rate: body.target_rate,
      tolerance_bps: body.tolerance_bps ?? 50,
    });
    return reply.send(result);
  });

  // GET /v1/oracle/metals — precious metal prices from SIX
  app.get("/oracle/metals", async (_req, reply) => {
    const { SIXClient } = await import("@irofi/oracle");
    const six = new SIXClient({
      api_key: process.env.SIX_API_KEY!,
      base_url: process.env.SIX_FX_ENDPOINT!,
      timeout_ms: 8_000,
    });
    const metals = await six.getPreciousMetalPrices();
    return reply.send({ metals, fetched_at: new Date().toISOString() });
  });

  // GET /v1/oracle/health — oracle feed health
  app.get("/oracle/health", async (_req, reply) => {
    const health = await engine.getHealthStatus();
    const allOnline = health.pyth.online && health.six.online;
    return reply.code(allOnline ? 200 : 206).send(health);
  });
}
