import { FastifyRequest, FastifyReply } from "fastify";
export async function requestLogger(req: FastifyRequest, _reply: FastifyReply) {
  req.log.info({ method: req.method, url: req.url, institution_id: req.headers["x-institution-id"] });
}