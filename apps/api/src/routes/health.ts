import { FastifyInstance } from "fastify";
export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok", service: "IroFi API", version: "1.0.0",
    timestamp: new Date().toISOString(),
  }));
}
