import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config/index.js";
import { prisma } from "./lib/prisma.js";
import { authenticate } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { casesRoutes } from "./routes/cases.js";
import { userRoutes } from "./routes/users.js";
import { inventoryRoutes } from "./routes/inventory.js";
import { upgradeRoutes } from "./routes/upgrade.js";
import { liveDropsRoutes } from "./routes/liveDrops.js";
import { depositRoutes } from "./routes/deposit.js";
import { adminRoutes } from "./routes/admin.js";
import { publicAdminRoutes } from "./routes/publicAdmin.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === "development" ? "info" : "warn",
  },
  bodyLimit: 50 * 1024 * 1024, 
});
await fastify.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});
await fastify.register(cookie);
await fastify.register(jwt, {
  secret: config.JWT_SECRET,
});
await fastify.register(websocket);
await fastify.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, 
  }
});
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, "..", "public"),
  prefix: "/", 
});
await fastify.register(fastifyStatic, {
  root: path.join(process.cwd(), "uploads"),
  prefix: "/uploads/",
  decorateReply: false 
});
fastify.decorate("authenticate", authenticate);
await fastify.register(authRoutes, { prefix: "/api/auth" });
await fastify.register(casesRoutes, { prefix: "/api/cases" });
await fastify.register(userRoutes, { prefix: "/api/users" });
await fastify.register(inventoryRoutes, { prefix: "/api/inventory" });
await fastify.register(upgradeRoutes, { prefix: "/api/upgrade" });
await fastify.register(liveDropsRoutes, { prefix: "/api/live-drops" });
await fastify.register(depositRoutes, { prefix: "/api/deposit" });
await fastify.register(adminRoutes, { prefix: "/api/admin" });
await fastify.register(publicAdminRoutes, { prefix: "/api/public-admin" });
fastify.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(500).send({
    error: "Internal Server Error",
    message:
      config.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});
const start = async () => {
  try {
    await fastify.listen({
      port: config.PORT,
      host: "0.0.0.0",
    });
    fastify.log.info(`🚀 Server running on http://localhost:${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
