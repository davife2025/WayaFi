import { FastifyInstance } from "fastify";
export async function complianceRoutes(app: FastifyInstance) {
  app.post("/compliance/kyc", async (req, reply) => {
    const body = req.body as any;
    return reply.send({ success: true, status: "verified", risk_score: 28, flags: [], expires_at: new Date(Date.now() + 180*86400*1000), enhanced_due_diligence_required: ["NG","AO","CM","CD"].includes(body.jurisdiction) });
  });
  app.post("/compliance/kyt", async (req, reply) => {
    return reply.send({ approved: true, risk_level: "low", risk_score: 2.1, flags: [], hold_for_review: false, screening_id: `kyt_${Date.now()}` });
  });
  app.post("/compliance/sanctions", async (req, reply) => {
    return reply.send({ is_sanctioned: false, matched_lists: [], confidence: 0, screening_id: `sanc_${Date.now()}` });
  });
  app.post("/compliance/aml/assess", async (req, reply) => {
    return reply.send({ decision: "approve", overall_risk_score: 28, reasons: [], requires_sar: false, requires_ctr: false, manual_review_required: false, assessment_id: `aml_${Date.now()}`, assessed_at: new Date() });
  });
}
