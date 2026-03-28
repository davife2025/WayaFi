import { FastifyInstance } from "fastify";
export async function rampRoutes(app: FastifyInstance) {
  app.get("/ramp/quote", async (req, reply) => {
    const q = req.query as any;
    return reply.send({ provider: "YELLOW_CARD", quote: { direction: q.direction, fiat_currency: q.currency, exchange_rate: 1580, fee_fiat: 50, quote_id: `q_${Date.now()}`, expires_at: new Date(Date.now() + 300_000) } });
  });
  app.get("/ramp/quotes/compare", async (_req, reply) => reply.send({ quotes: [], count: 0 }));
  app.post("/ramp/orders", async (req, reply) => {
    const body = req.body as any;
    return reply.code(201).send({ id: `order_${Date.now()}`, provider: body.provider, status: "pending", payment_reference: `REF_${Date.now()}`, created_at: new Date() });
  });
  app.get("/ramp/orders/:provider/:id", async (req, reply) => {
    const { provider, id } = req.params as { provider: string; id: string };
    return reply.send({ id, provider, status: "completed" });
  });
  app.post("/ramp/webhook/:provider", async (req, reply) => {
    return reply.send({ received: true });
  });
}
