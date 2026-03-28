import { FastifyInstance } from "fastify";
export async function travelRuleRoutes(app: FastifyInstance) {
  app.post("/travel-rule/initiate", async (req, reply) => {
    const body = req.body as any;
    return reply.send({ transfer_id: body.transfer_id, state: "ACCEPTED", envelope_id: `env_${Date.now()}`, beneficiary_vasp: "Nairobi Bank VASP", sunrise_exemption: false, can_proceed: true });
  });
  app.post("/travel-rule/incoming", async (req, reply) => {
    return reply.send({ transfer_state: "ACCEPTED" });
  });
  app.get("/travel-rule/vasp/:address", async (req, reply) => {
    return reply.send({ found: true, vasp_id: "vasp_001", vasp_name: "IroFi Protocol", country: "NG", verified_on: new Date().toISOString() });
  });
}
