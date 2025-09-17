import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    try {
      const userId = request.user.id;
      const inventory = await prisma.inventoryItem.findMany({
        where: { userId },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              price: true,
            },
          },
        },
      });
      return reply.send({ inventory });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch inventory" });
    }
  });
  fastify.post("/sell", { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const bodySchema = z.object({
      itemId: z.string().optional(),
      quantity: z.number().optional(),
      sellAll: z.boolean().optional(),
    });
    try {
      const userId = request.user.id;
      const { itemId, quantity, sellAll } = bodySchema.parse(request.body);
      if (sellAll) {
        const items = await prisma.inventoryItem.findMany({ where: { userId }, include: { item: true } });
        let total = 0;
        for (const inv of items) {
          if (inv.quantity > 0) {
            total += inv.quantity * (inv.item.price || 0);
            await prisma.inventoryItem.update({ where: { id: inv.id }, data: { quantity: 0 } });
          }
        }
        await prisma.user.update({ where: { id: userId }, data: { balance: { increment: total } } });
        return reply.send({ success: true, total });
      }
      if (!itemId || !quantity || quantity <= 0) {
        return reply.status(400).send({ error: "Invalid itemId or quantity" });
      }
      const inv = await prisma.inventoryItem.findFirst({ where: { userId, itemId }, include: { item: true } });
      if (!inv || inv.quantity < quantity) {
        return reply.status(400).send({ error: "Not enough items" });
      }
      const price = (inv.item.price || 0) * quantity;
      await prisma.inventoryItem.update({ where: { id: inv.id }, data: { quantity: { decrement: quantity } } });
      await prisma.user.update({ where: { id: userId }, data: { balance: { increment: price } } });
      return reply.send({ success: true, price });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to sell item(s)" });
    }
  });
  fastify.post("/withdraw", { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const bodySchema = z.object({
      itemId: z.string(),
      quantity: z.number().min(1),
    });
    try {
      const userId = request.user.id;
      const { itemId, quantity } = bodySchema.parse(request.body);
      const inv = await prisma.inventoryItem.findFirst({ where: { userId, itemId } });
      if (!inv || inv.quantity < quantity) {
        return reply.status(400).send({ error: "Not enough items" });
      }
      await prisma.inventoryItem.update({ where: { id: inv.id }, data: { quantity: { decrement: quantity } } });
      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to withdraw item" });
    }
  });
} 