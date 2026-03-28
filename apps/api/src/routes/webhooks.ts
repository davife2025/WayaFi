import { FastifyInstance } from "fastify";
import { createHmac, randomBytes } from "crypto";
export async function webhookRoutes(app: FastifyInstance) {
  app.post("/webhooks", {
    schema: { body: { type: "object", required: ["url","events"], properties: { url: { type: "string" }, events: { type: "array", items: { type: "string" } } } } },
  }, async (req, reply) => {
    const body = req.body as any;
    return reply.code(201).send({ id: `wh_${Date.now()}`, url: body.url, events: body.events, secret: `whsec_${randomBytes(24).toString("hex")}`, created_at: new Date().toISOString() });
  });
  app.get("/webhooks", async (_req, reply) => reply.send({ webhooks: [] }));
  app.delete("/webhooks/:id", async (_req, reply) => reply.code(204).send());
}
