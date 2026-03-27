import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import { transferRoutes } from "./routes/transfers";
import { institutionRoutes } from "./routes/institutions";
import { corridorRoutes } from "./routes/corridors";
import { webhookRoutes } from "./routes/webhooks";
import { healthRoutes } from "./routes/health";
import { authMiddleware } from "./middleware/auth";
import { requestLogger } from "./middleware/logger";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

async function bootstrap() {
  await app.register(fastifyCors, {
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  });

  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
    sign: { expiresIn: "24h" },
  });

  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (req) => (req.headers["x-institution-id"] as string) ?? req.ip,
  });

  app.addHook("onRequest", requestLogger);
  app.addHook("onRequest", authMiddleware);

  await app.register(healthRoutes, { prefix: "/" });
  await app.register(institutionRoutes, { prefix: "/v1" });
  await app.register(transferRoutes, { prefix: "/v1" });
  await app.register(corridorRoutes, { prefix: "/v1" });
  await app.register(webhookRoutes, { prefix: "/v1" });

  app.setErrorHandler((error, req, reply) => {
    app.log.error({ err: error, url: req.url });
    if (error.validation) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: error.validation });
    }
    return reply.code(error.statusCode ?? 500).send({
      error: error.code ?? "INTERNAL_ERROR",
      message: process.env.NODE_ENV === "production" ? "An internal error occurred" : error.message,
    });
  });

  const port = parseInt(process.env.API_PORT ?? "3001");
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`IroFi API running on port ${port}`);
}

bootstrap().catch((err) => { console.error("Fatal startup error:", err); process.exit(1); });
export { app };