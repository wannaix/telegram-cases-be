import { FastifyInstance } from "fastify";
export async function upgradeRoutes(fastify: FastifyInstance) {
  fastify.post("/roll", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { baseChance, coef } = request.body as { baseChance: number, coef: number };
    fastify.log.info({ baseChance, coef }, "Upgrade roll input");
    if (
      typeof baseChance !== "number" ||
      typeof coef !== "number" ||
      baseChance <= 0 ||
      coef <= 0
    ) {
      return reply.status(400).send({ error: "Invalid input" });
    }
    const normalizedChance = baseChance > 1 ? baseChance / 100 : baseChance;
    let chance = normalizedChance / coef;
    chance = Math.max(0, Math.min(1, chance));
    const rolled = Math.random();
    const success = rolled < chance;
    fastify.log.info({ chance, rolled, success }, "Upgrade roll result");
    return { success, chance, rolled };
  });
} 