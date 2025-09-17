import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getUserStats } from "../utils/caseLogic.js";
export async function userRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/profile",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.id;
        const user = await prisma.user.findUnique({
          where: { id: userId },
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
        const stats = await getUserStats(userId);
        return reply.send({
          user,
          stats,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch profile" });
      }
    }
  );
  fastify.get(
    "/inventory",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.id;
        const { page = 1, limit = 50 } = request.query;
        const skip = (page - 1) * limit;
        const inventory = await prisma.inventoryItem.findMany({
          where: { userId },
          include: {
            item: true,
          },
          orderBy: [{ item: { price: "desc" } }, { createdAt: "desc" }],
          skip,
          take: limit,
        });
        const total = await prisma.inventoryItem.count({
          where: { userId },
        });
        const totalValue = await prisma.inventoryItem.aggregate({
          where: { userId },
          _sum: {
            quantity: true,
          },
        });
        const inventoryValue = inventory.reduce((sum: number, invItem: any) => {
          return sum + invItem.item.price * invItem.quantity;
        }, 0);
        return reply.send({
          inventory,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
          summary: {
            totalItems: totalValue._sum.quantity || 0,
            totalValue: inventoryValue,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch inventory" });
      }
    }
  );
  fastify.get("/leaderboard", async (request, reply) => {
    try {
      const { type = "totalWon", limit = 10 } = request.query as any;
      const orderField = type === "totalSpent" ? "totalSpent" : "totalWon";
      const users = await prisma.user.findMany({
        select: {
          username: true,
          firstName: true,
          totalSpent: true,
          totalWon: true,
          isPremium: true,
        },
        orderBy: { [orderField]: "desc" },
        take: limit,
      });
      return reply.send({
        leaderboard: users.map((user: any, index: number) => ({
          rank: index + 1,
          username: user.username || user.firstName || "Anonymous",
          value: type === "totalSpent" ? user.totalSpent : user.totalWon,
          isPremium: user.isPremium,
        })),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch leaderboard" });
    }
  });
  fastify.post(
    "/balance",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.id;
        const { amount, type } = request.body; 
        if (!amount || amount <= 0) {
          return reply.status(400).send({ error: "Invalid amount" });
        }
        if (type === "withdraw") {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { balance: true },
          });
          if (!user || user.balance < amount) {
            return reply.status(400).send({ error: "Insufficient balance" });
          }
        }
        const updatedUser = await prisma.$transaction(async (tx: any) => {
          const user = await tx.user.update({
            where: { id: userId },
            data: {
              balance: {
                [type === "deposit" ? "increment" : "decrement"]: amount,
              },
            },
          });
          await tx.transaction.create({
            data: {
              userId,
              type: type === "deposit" ? "DEPOSIT" : "WITHDRAWAL",
              amount: type === "deposit" ? amount : -amount,
              description: `Balance ${type}`,
            },
          });
          return user;
        });
        return reply.send({
          success: true,
          newBalance: updatedUser.balance,
          message: `Successfully ${
            type === "deposit" ? "deposited" : "withdrawn"
          } $${amount}`,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Balance operation failed" });
      }
    }
  );
}
