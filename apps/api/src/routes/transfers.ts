import { FastifyInstance } from "fastify";
export async function transferRoutes(app: FastifyInstance) {
  app.post("/transfers", {
    schema: {
      body: {
        type: "object",
        required: ["sender_institution_id","receiver_institution_id","amount_usdc","corridor","memo","idempotency_key"],
        properties: {
          sender_institution_id: { type: "string" },
          receiver_institution_id: { type: "string" },
          amount_usdc: { type: "number", minimum: 1 },
          corridor: { type: "string", enum: ["NG_KE","NG_ZA","NG_GH","KE_ZA","KE_GH"] },
          memo: { type: "string", minLength: 8, maxLength: 512 },
          idempotency_key: { type: "string" },
          fx_rate_limit: { type: "number" },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as any;
    const transferId = `txfr_${Date.now()}_${body.idempotency_key.slice(0,8)}`;
    app.log.info({ msg: "Transfer initiated", transfer_id: transferId, corridor: body.corridor });
    return reply.code(202).send({
      transfer_id: transferId, status: "initiated",
      corridor: body.corridor, amount_usdc: body.amount_usdc,
      idempotency_key: body.idempotency_key,
      message: "Transfer accepted — compliance pipeline starting",
      estimated_completion_seconds: 10,
    });
  });

  app.get("/transfers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send({
      transfer_id: id, status: "completed",
      pipeline_steps: [
        { step: "kyt_check",      status: "passed",    risk_score: 2.1,  duration_ms: 340 },
        { step: "sanctions_check",status: "passed",                      duration_ms: 120 },
        { step: "aml_assessment", status: "passed",    risk_score: 28,   duration_ms: 45  },
        { step: "travel_rule",    status: "completed", envelope_id: "env_abc123", duration_ms: 1200 },
        { step: "on_chain",       status: "confirmed", tx_signature: "5xYz...", duration_ms: 420 },
        { step: "settlement",     status: "completed",                   duration_ms: 890 },
      ],
      total_duration_ms: 3015,
    });
  });

  app.get("/transfers", async (req, reply) => {
    const query = req.query as any;
    return reply.send({ transfers: [], total: 0, page: query.page ?? 1, limit: query.limit ?? 20 });
  });
}
