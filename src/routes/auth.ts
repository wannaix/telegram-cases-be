import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validateTelegramWebAppData } from "../utils/telegram.js";
const loginSchema = z.object({
  initData: z.string(),
});
export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/login", async (request, reply) => {
    try {
      const { initData } = loginSchema.parse(request.body);
      if (initData === 'dev') {
        let devUser = await prisma.user.findUnique({ where: { id: 'dev-user' } });
        if (!devUser) {
          devUser = await prisma.user.create({
            data: {
              id: 'dev-user',
              telegramId: 'dev-telegram-id',
              username: 'dev',
              firstName: 'Dev',
              lastName: 'User',
              languageCode: 'en',
              isPremium: false,
              balance: 0,
            },
          });
        }
        const token = fastify.jwt.sign({ userId: devUser.id });
        return reply.send({
          token,
          user: devUser,
        });
      }
      const telegramData = validateTelegramWebAppData(initData);
      if (!telegramData) {
        return reply.status(400).send({ error: "Invalid Telegram data" });
      }
      const telegramUser = telegramData.user;
      let user = await prisma.user.findUnique({
        where: { telegramId: telegramUser.id.toString() },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            telegramId: telegramUser.id.toString(),
            username: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
            languageCode: telegramUser.language_code,
            isPremium: telegramUser.is_premium || false,
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            username: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
            languageCode: telegramUser.language_code,
            isPremium: telegramUser.is_premium || false,
          },
        });
      }
      const token = fastify.jwt.sign({ userId: user.id });
      return reply.send({
        token,
        user: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          balance: user.balance,
          isPremium: user.isPremium,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Authentication failed" });
    }
  });
  fastify.get(
    "/me",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: request.user.id },
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            balance: true,
            isPremium: true,
            totalSpent: true,
            totalWon: true,
            createdAt: true,
          },
        });
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        return reply.send({ user });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to get user data" });
      }
    }
  );
}
