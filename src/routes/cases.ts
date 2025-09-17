import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { openCase, getUserStats } from "../utils/caseLogic.js";
import { ImageService } from "../services/imageService.js";
const openCaseSchema = z.object({
  caseId: z.string(),
});
const openMultipleCasesSchema = z.object({
  caseId: z.string(),
  amount: z.number().min(1).max(3),
});
export async function casesRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (request, reply) => {
    try {
      const cases = await prisma.case.findMany({
        where: { isActive: true },
        include: {
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  rarity: true,
                  price: true,
                  imageUrl: true,
                },
              },
            },
            orderBy: { dropChance: "desc" },
          },
        },
        orderBy: { price: "asc" },
      });
      const casesWithFullUrls = cases.map((caseItem: any) => ({
        ...caseItem,
        imageUrl: ImageService.getImageUrl(caseItem.imageUrl),
        items: caseItem.items.map((caseItemRel: any) => ({
          ...caseItemRel,
          item: {
            ...caseItemRel.item,
            imageUrl: ImageService.getImageUrl(caseItemRel.item.imageUrl)
          }
        }))
      }));
      console.log(`Returning ${casesWithFullUrls.length} cases:`);
      casesWithFullUrls.forEach((c: any) => {
        console.log(`- Case "${c.name}": ${c.items.length} items, active: ${c.isActive}`);
      });
      return reply.send({ cases: casesWithFullUrls });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch cases" });
    }
  });
  fastify.get("/:caseId", async (request: any, reply) => {
    try {
      const { caseId } = request.params;
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          items: {
            include: {
              item: true,
            },
            orderBy: { dropChance: "desc" },
          },
        },
      });
      if (!caseData) {
        return reply.status(404).send({ error: "Case not found" });
      }
      const caseWithFullUrls = {
        ...caseData,
        imageUrl: ImageService.getImageUrl(caseData.imageUrl),
        items: caseData.items.map((caseItemRel: any) => ({
          ...caseItemRel,
          item: {
            ...caseItemRel.item,
            imageUrl: ImageService.getImageUrl(caseItemRel.item.imageUrl)
          }
        }))
      };
      return reply.send({ case: caseWithFullUrls });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Failed to fetch case" });
    }
  });
  fastify.post(
    "/open",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      try {
        const { caseId } = openCaseSchema.parse(request.body);
        const userId = request.user.id;
        const result = await openCase(caseId, userId);
        return reply.send({
          success: true,
          result: {
            item: result.item,
            profit: result.profit,
            message: result.profit > 0 ? "Profit!" : "Loss!",
          },
        });
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: "Failed to open case" });
      }
    }
  );
  fastify.post(
    "/open-multiple",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      try {
        const { caseId, amount } = openMultipleCasesSchema.parse(request.body);
        const userId = request.user.id;
        const results = [];
        for (let i = 0; i < amount; i++) {
          const result = await openCase(caseId, userId);
          results.push({
            item: result.item,
            profit: result.profit,
            message: result.profit > 0 ? "Profit!" : "Loss!",
          });
        }
        return reply.send({
          success: true,
          results,
        });
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: "Failed to open cases" });
      }
    }
  );
  fastify.get(
    "/history",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.id;
        const { page = 1, limit = 20 } = request.query;
        const skip = (page - 1) * limit;
        const openings = await prisma.caseOpening.findMany({
          where: { userId },
          include: {
            case: {
              select: { name: true, imageUrl: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        });
        const total = await prisma.caseOpening.count({
          where: { userId },
        });
        return reply.send({
          openings,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch history" });
      }
    }
  );
}
