import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { localUploadService } from "../services/uploadService.js";
export async function publicAdminRoutes(fastify: FastifyInstance) {
  fastify.get("/cases", async (request, reply) => {
    try {
      const cases = await prisma.case.findMany({
        include: {
          items: {
            include: {
              item: true
            }
          },
          openings: {
            select: { id: true, createdAt: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      const casesWithStats = cases.map((caseItem: any) => ({
        ...caseItem,
        totalOpenings: caseItem.openings.length,
        revenue: caseItem.openings.length * caseItem.price
      }));
      return { cases: casesWithStats };
    } catch (error) {
      console.error("Error fetching cases:", error);
      return reply.status(500).send({ error: "Failed to fetch cases" });
    }
  });
  fastify.post("/cases/with-nfts", async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().min(0),
      imageUrl: z.string().optional(),
      imageBase64: z.string().optional(),
      isActive: z.boolean().optional().default(true),
      isLocked: z.boolean().optional().default(false),
      unlockLevel: z.number().optional(),
      unlockPrice: z.number().optional(),
      nftItems: z.array(z.object({
        nftId: z.string(),
        name: z.string(),
        imageUrl: z.string(),
        rarity: z.enum(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'CONTRABAND']),
        dropChance: z.number().min(0).max(100),
        estimatedPrice: z.number().optional()
      }))
    });
    try {
      const data = bodySchema.parse(request.body);
      const totalChance = data.nftItems.reduce((sum, item) => sum + item.dropChance, 0);
      if (Math.abs(totalChance - 100) > 0.01) {
        return reply.status(400).send({ 
          error: `Total drop chance must be 100%, got ${totalChance}%` 
        });
      }
      const caseItem = await prisma.case.create({
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          imageUrl: data.imageUrl,
          imageBase64: data.imageBase64,
          isActive: data.isActive,
          isLocked: data.isLocked,
          unlockLevel: data.unlockLevel,
          unlockPrice: data.unlockPrice
        }
      });
      console.log(`Creating ${data.nftItems.length} items for case ${caseItem.id}`);
      const caseItems = await Promise.all(data.nftItems.map(async (nftItem, index) => {
        console.log(`[${index + 1}/${data.nftItems.length}] Processing NFT: ${nftItem.nftId} - ${nftItem.name}`);
        try {
          console.log(`Creating/updating item with partnersNftId: ${nftItem.nftId}`);
          const item = await prisma.item.upsert({
            where: { 
              partnersNftId: nftItem.nftId 
            },
            update: {
              name: nftItem.name,
              imageUrl: nftItem.imageUrl,
              rarity: nftItem.rarity,
              estimatedPrice: nftItem.estimatedPrice,
              price: nftItem.estimatedPrice || 0
            },
            create: {
              name: nftItem.name,
              imageUrl: nftItem.imageUrl,
              rarity: nftItem.rarity,
              type: 'STICKER', 
              price: nftItem.estimatedPrice || 0,
              estimatedPrice: nftItem.estimatedPrice,
              partnersNftId: nftItem.nftId
            }
          });
          console.log(`✓ Item created/updated: ${item.id} (${item.name})`);
          console.log(`Creating case-item relation: case=${caseItem.id}, item=${item.id}, chance=${nftItem.dropChance}%`);
          const caseItemResult = await prisma.caseItem.create({
            data: {
              caseId: caseItem.id,
              itemId: item.id,
              dropChance: nftItem.dropChance
            }
          });
          console.log(`✓ Case item relation created: ${caseItemResult.id}`);
          return caseItemResult;
        } catch (itemError) {
          console.error(`❌ Error processing NFT ${nftItem.nftId}:`, itemError);
          console.error(`Item data:`, JSON.stringify(nftItem, null, 2));
          throw itemError;
        }
      }));
      console.log(`✓ Successfully created ${caseItems.length} case items`);
      const fullCase = await prisma.case.findUnique({
        where: { id: caseItem.id },
        include: {
          items: {
            include: {
              item: true
            }
          }
        }
      });
      return { success: true, case: fullCase };
    } catch (error) {
      console.error("Error creating NFT case:", error);
      console.error("Request body:", JSON.stringify(request.body, null, 2));
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error details:", errorMessage);
      return reply.status(500).send({ 
        error: "Failed to create NFT case", 
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
      });
    }
  });
  fastify.put("/cases/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string()
    });
    const bodySchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      price: z.number().min(0).optional(),
      imageUrl: z.string().optional(),
      imageBase64: z.string().optional(),
      isActive: z.boolean().optional(),
      isLocked: z.boolean().optional(),
      unlockLevel: z.number().optional(),
      unlockPrice: z.number().optional()
    });
    try {
      const { id } = paramsSchema.parse(request.params);
      const data = bodySchema.parse(request.body);
      const caseItem = await prisma.case.update({
        where: { id },
        data
      });
      return { success: true, case: caseItem };
    } catch (error) {
      console.error("Error updating case:", error);
      return reply.status(500).send({ error: "Failed to update case" });
    }
  });
  fastify.delete("/cases/empty", async (_request, reply) => {
    try {
      const emptyCases = await prisma.case.findMany({
        where: {
          items: {
            none: {}
          }
        },
        select: {
          id: true,
          name: true,
          createdAt: true
        }
      });
      console.log(`Found ${emptyCases.length} empty cases to delete:`, emptyCases);
      if (emptyCases.length === 0) {
        return { success: true, message: "No empty cases found", deletedCount: 0 };
      }
      const result = await prisma.case.deleteMany({
        where: {
          items: {
            none: {}
          }
        }
      });
      console.log(`Successfully deleted ${result.count} empty cases`);
      return { 
        success: true, 
        message: `Deleted ${result.count} empty cases`,
        deletedCount: result.count,
        deletedCases: emptyCases
      };
    } catch (error) {
      console.error("Error deleting empty cases:", error);
      return reply.status(500).send({ error: "Failed to delete empty cases" });
    }
  });
  fastify.delete("/cases/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string()
    });
    try {
      const { id } = paramsSchema.parse(request.params);
      console.log(`Attempting to delete case with ID: ${id}`);
      const caseItem = await prisma.case.findUnique({
        where: { id },
        include: {
          items: true,
          openings: true
        }
      });
      if (!caseItem) {
        console.log(`Case not found: ${id}`);
        return reply.status(404).send({ error: "Case not found" });
      }
      console.log(`Found case: ${caseItem.name}, items: ${caseItem.items.length}, openings: ${caseItem.openings.length}`);
      if (caseItem.openings.length > 0) {
        console.log(`Deleting ${caseItem.openings.length} case openings...`);
        await prisma.caseOpening.deleteMany({
          where: { caseId: id }
        });
        console.log(`✓ Deleted case openings`);
      }
      if (caseItem.items.length > 0) {
        console.log(`Deleting ${caseItem.items.length} case items...`);
        await prisma.caseItem.deleteMany({
          where: { caseId: id }
        });
        console.log(`✓ Deleted case items`);
      }
      console.log(`Deleting case...`);
      await prisma.case.delete({
        where: { id }
      });
      console.log(`✓ Successfully deleted case: ${caseItem.name}`);
      return { success: true };
    } catch (error) {
      console.error("Error deleting case:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return reply.status(500).send({ 
        error: "Failed to delete case",
        details: errorMessage
      });
    }
  });
  fastify.get("/migrate/add-imagebase64-field", async (_request, reply) => {
    try {
      console.log("Applying migration: add imageBase64 field...");
      await prisma.$executeRaw`ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "imageBase64" TEXT`;
      console.log("✓ Migration applied successfully!");
      console.log("ℹ️ Please restart the server to regenerate Prisma client");
      return { 
        success: true, 
        message: "Migration applied successfully. Please restart the server.",
        fields: ["imageBase64"]
      };
    } catch (error) {
      console.error("Error applying migration:", error);
      return reply.status(500).send({ error: "Failed to apply migration" });
    }
  });
  fastify.post("/upload/case-image", async (request: any, reply) => {
    try {
      console.log("Starting local image upload...");
      console.log("Request headers:", JSON.stringify(request.headers, null, 2));
      console.log("Request content-type:", request.headers['content-type']);
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "No file provided" });
      }
      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({ error: "File too large. Maximum size is 5MB" });
      }
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ error: "Invalid file type. Only images are allowed" });
      }
      const imageUrl = await localUploadService.uploadImage(buffer, data.filename);
      console.log(`Local upload completed: ${data.filename}, size: ${buffer.length} bytes, URL: ${imageUrl}`);
      return { 
        success: true,
        imageUrl: imageUrl,
        filename: data.filename,
        size: buffer.length
      };
    } catch (error: any) {
      console.error("Error uploading case image:", error);
      return reply.status(400).send({ error: error.message || "Failed to upload image" });
    }
  });
  fastify.delete("/upload/case-image", async (request: any, reply) => {
    const bodySchema = z.object({
      imagePath: z.string()
    });
    try {
      const { imagePath } = bodySchema.parse(request.body);
      const deleted = await localUploadService.deleteImage(imagePath);
      if (!deleted) {
        return reply.status(404).send({ error: "File not found" });
      }
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting case image:", error);
      return reply.status(400).send({ error: error.message || "Failed to delete image" });
    }
  });
}