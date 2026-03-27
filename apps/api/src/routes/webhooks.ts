/**
 * IroFi Webhook Routes
 * Subscribe to transfer lifecycle events.
 * Delivers: transfer.initiated, transfer.completed, transfer.failed,
 *           compliance.hold, compliance.rejected, travel_rule.accepted
 */
import { FastifyInstance } from "fastify";
import { createHmac } from "crypto";

export const WEBHOOK_EVENTS = [
  "transfer.initiated",
  "transfer.completed",
  "transfer.failed",
  "transfer.held",
  "compliance.kyc_verified",
  "compliance.hold",
  "compliance.rejected",
  "travel_rule.accepted",
  "travel_rule.rejected",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export async function webhookRoutes(app: FastifyInstance) {

  // POST /v1/webhooks — register a webhook endpoint
  app.post("/webhooks", {
    schema: {
      body: {
        type: "object",
        required: ["url", "events"],
        properties: {
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { type: "string" } },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as any;
    const secret = generateWebhookSecret();
    return reply.code(201).send({
      id: `wh_${Date.now()}`,
      url: body.url,
      events: body.events,
      secret,  // shown once — store it securely
      created_at: new Date().toISOString(),
    });
  });

  // GET /v1/webhooks — list registered webhooks
  app.get("/webhooks", async (_req, reply) => {
    return reply.send({ webhooks: [] });
  });

  // DELETE /v1/webhooks/:id — remove a webhook
  app.delete("/webhooks/:id", async (req, reply) => {
    return reply.code(204).send();
  });
}

/** Deliver a webhook event with HMAC signature */
export async function deliverWebhook(params: {
  url: string;
  secret: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
}): Promise<{ delivered: boolean; status_code?: number; error?: string }> {
  const body = JSON.stringify({
    event: params.event,
    data: params.payload,
    timestamp: new Date().toISOString(),
  });

  const signature = createHmac("sha256", params.secret).update(body).digest("hex");

  try {
    const res = await fetch(params.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-IroFi-Signature": `sha256=${signature}`,
        "X-IroFi-Event": params.event,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return { delivered: res.ok, status_code: res.status };
  } catch (err: any) {
    return { delivered: false, error: err.message };
  }
}

function generateWebhookSecret(): string {
  const { randomBytes } = require("crypto");
  return `whsec_${randomBytes(24).toString("hex")}`;
}