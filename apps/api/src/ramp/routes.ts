/**
 * IroFi Ramp API Routes
 * Quotes, order management, webhook ingestion for all providers.
 */
import { FastifyInstance } from "fastify";
import { RampManager } from "@irofi/ramp";
import type { RampProvider, SupportedCurrency, RampDirection } from "@irofi/ramp";

function getManager(): RampManager {
  const env = process.env.NODE_ENV === "production" ? "production" : "sandbox";
  return new RampManager({
    yellow_card: {
      api_key: process.env.YELLOW_CARD_API_KEY!,
      api_secret: process.env.YELLOW_CARD_API_SECRET!,
      environment: env,
    },
    bitnob: {
      api_key: process.env.BITNOB_API_KEY!,
      environment: env,
    },
    muda: {
      api_key: process.env.MUDA_API_KEY!,
      api_secret: process.env.MUDA_API_SECRET!,
      environment: env,
    },
  });
}

const manager = getManager();

export async function rampRoutes(app: FastifyInstance) {

  // GET /v1/ramp/quote — best quote across all providers
  app.get("/ramp/quote", {
    schema: {
      querystring: {
        type: "object",
        required: ["direction", "currency"],
        properties: {
          direction: { type: "string", enum: ["ON", "OFF"] },
          currency: { type: "string" },
          fiat_amount: { type: "number" },
          usdc_amount: { type: "number" },
        },
      },
    },
  }, async (req, reply) => {
    const q = req.query as any;
    const result = await manager.getBestQuote({
      direction: q.direction as RampDirection,
      fiat_currency: q.currency as SupportedCurrency,
      fiat_amount: q.fiat_amount ? Number(q.fiat_amount) : undefined,
      usdc_amount: q.usdc_amount ? Number(q.usdc_amount) : undefined,
    });
    if (!result) return reply.code(503).send({ error: "QUOTE_UNAVAILABLE" });
    return reply.send(result);
  });

  // GET /v1/ramp/quotes/compare — all provider quotes for comparison
  app.get("/ramp/quotes/compare", async (req, reply) => {
    const q = req.query as any;
    const quotes = await manager.getAllQuotes({
      direction: q.direction as RampDirection,
      fiat_currency: q.currency as SupportedCurrency,
      fiat_amount: q.fiat_amount ? Number(q.fiat_amount) : undefined,
      usdc_amount: q.usdc_amount ? Number(q.usdc_amount) : undefined,
    });
    return reply.send({ quotes, count: quotes.length });
  });

  // POST /v1/ramp/orders — create a ramp order
  app.post("/ramp/orders", {
    schema: {
      body: {
        type: "object",
        required: ["provider", "quote_id", "wallet_address", "payment_method_id"],
        properties: {
          provider: { type: "string" },
          quote_id: { type: "string" },
          wallet_address: { type: "string" },
          payment_method_id: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as any;
    const institution = (req as any).institution;
    const order = await manager.createOrder({
      provider: body.provider as RampProvider,
      quote_id: body.quote_id,
      wallet_address: body.wallet_address,
      payment_method_id: body.payment_method_id,
      institution_id: institution.institution_id,
    });
    return reply.code(201).send(order);
  });

  // GET /v1/ramp/orders/:provider/:id — get order status
  app.get("/ramp/orders/:provider/:id", async (req, reply) => {
    const { provider, id } = req.params as { provider: string; id: string };
    const order = await manager.getOrderStatus(provider as RampProvider, id);
    return reply.send(order);
  });

  // POST /v1/ramp/webhook/:provider — receive provider webhooks
  app.post("/ramp/webhook/:provider", async (req, reply) => {
    const { provider } = req.params as { provider: string };
    const signature =
      req.headers["x-yc-signature"] as string ??
      req.headers["x-bitnob-signature"] as string ??
      req.headers["x-muda-signature"] as string ?? "";

    try {
      const event = manager.handleWebhook(
        provider.toUpperCase() as RampProvider,
        JSON.stringify(req.body),
        signature
      );

      app.log.info({ msg: "Ramp webhook received", provider, event });

      // Update order status in DB + deliver webhook to institution
      // Wired to event-indexer worker in Session 5

      return reply.code(200).send({ received: true });
    } catch (err: any) {
      app.log.error({ msg: "Ramp webhook error", provider, error: err.message });
      return reply.code(400).send({ error: err.message });
    }
  });
}
