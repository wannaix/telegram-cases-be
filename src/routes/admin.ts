import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { adminAuthenticate, logAdminAction } from "../middleware/adminAuth.js";
import { z } from "zod";
import { handleFileUpload, deleteFile, ensureUploadDir } from "../utils/upload.js";
export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", adminAuthenticate);
  fastify.get("/stats", async (request, reply) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const totalUsers = await prisma.user.count();
      const todayUsers = await prisma.user.count({
        where: { createdAt: { gte: startOfDay } }
      });
      const monthUsers = await prisma.user.count({
        where: { createdAt: { gte: startOfMonth } }
      });
      const payingUsersToday = await prisma.transaction.groupBy({
        by: ['userId'],
        where: {
          type: 'DEPOSIT',
          createdAt: { gte: startOfDay }
        }
      });
      const payingUsersMonth = await prisma.transaction.groupBy({
        by: ['userId'],
        where: {
          type: 'DEPOSIT',
          createdAt: { gte: startOfMonth }
        }
      });
      const todayDeposits = await prisma.transaction.aggregate({
        where: {
          type: 'DEPOSIT',
          createdAt: { gte: startOfDay }
        },
        _sum: { amount: true },
        _count: true
      });
      const todayWithdrawals = await prisma.transaction.aggregate({
        where: {
          type: 'WITHDRAWAL',
          createdAt: { gte: startOfDay }
        },
        _sum: { amount: true },
        _count: true
      });
      const monthDeposits = await prisma.transaction.aggregate({
        where: {
          type: 'DEPOSIT',
          createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true },
        _count: true
      });
      const monthWithdrawals = await prisma.transaction.aggregate({
        where: {
          type: 'WITHDRAWAL',
          createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true },
        _count: true
      });
      await logAdminAction(
        request.admin!.id,
        "VIEW_STATS",
        null,
        "Viewed dashboard statistics"
      );
      return {
        users: {
          total: totalUsers,
          today: todayUsers,
          month: monthUsers,
          payingToday: payingUsersToday.length,
          payingMonth: payingUsersMonth.length
        },
        finances: {
          today: {
            deposits: todayDeposits._sum.amount || 0,
            withdrawals: todayWithdrawals._sum.amount || 0,
            depositsCount: todayDeposits._count,
            withdrawalsCount: todayWithdrawals._count
          },
          month: {
            deposits: monthDeposits._sum.amount || 0,
            withdrawals: monthWithdrawals._sum.amount || 0,
            depositsCount: monthDeposits._count,
            withdrawalsCount: monthWithdrawals._count
          }
        }
      };
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      return reply.status(500).send({ error: "Failed to fetch statistics" });
    }
  });
  fastify.get("/stats/chart", async (request, reply) => {
    const querySchema = z.object({
      days: z.string().optional().default("30")
    });
    try {
      const { days } = querySchema.parse(request.query);
      const daysCount = parseInt(days);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);
      const deposits = await prisma.transaction.groupBy({
        by: ['createdAt'],
        where: {
          type: 'DEPOSIT',
          createdAt: { gte: startDate }
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { createdAt: 'asc' }
      });
      const withdrawals = await prisma.transaction.groupBy({
        by: ['createdAt'],
        where: {
          type: 'WITHDRAWAL',
          createdAt: { gte: startDate }
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { createdAt: 'asc' }
      });
      const chartData = [];
      for (let i = 0; i < daysCount; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const dayDeposits = deposits.filter(d => 
          new Date(d.createdAt) >= dayStart && new Date(d.createdAt) < dayEnd
        ).reduce((sum, d) => sum + (d._sum.amount || 0), 0);
        const dayWithdrawals = withdrawals.filter(w => 
          new Date(w.createdAt) >= dayStart && new Date(w.createdAt) < dayEnd
        ).reduce((sum, w) => sum + (w._sum.amount || 0), 0);
        chartData.unshift({
          date: dayStart.toISOString().split('T')[0],
          deposits: dayDeposits,
          withdrawals: dayWithdrawals
        });
      }
      return { data: chartData };
    } catch (error) {
      console.error("Error fetching chart data:", error);
      return reply.status(500).send({ error: "Failed to fetch chart data" });
    }
  });
  fastify.get("/users", async (request, reply) => {
    const querySchema = z.object({
      page: z.string().optional().default("1"),
      limit: z.string().optional().default("20"),
      search: z.string().optional(),
      status: z.enum(["all", "active", "blocked"]).optional().default("all")
    });
    try {
      const { page, limit, search, status } = querySchema.parse(request.query);
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const where: any = {};
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { telegramId: { contains: search } }
        ];
      }
      if (status === "blocked") {
        where.isBlocked = true;
      } else if (status === "active") {
        where.isBlocked = false;
      }
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            transactions: {
              where: { type: 'DEPOSIT' },
              take: 1,
              orderBy: { createdAt: 'desc' }
            }
          }
        }),
        prisma.user.count({ where })
      ]);
      await logAdminAction(
        request.admin!.id,
        "VIEW_USERS",
        null,
        `Viewed users list (page ${page})`
      );
      return {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      console.error("Error fetching users:", error);
      return reply.status(500).send({ error: "Failed to fetch users" });
    }
  });
  fastify.post("/users/:userId/balance", async (request, reply) => {
    const paramsSchema = z.object({
      userId: z.string()
    });
    const bodySchema = z.object({
      amount: z.number(),
      reason: z.string().optional()
    });
    try {
      const { userId } = paramsSchema.parse(request.params);
      const { amount, reason } = bodySchema.parse(request.body);
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          balance: user.balance + amount
        }
      });
      await prisma.transaction.create({
        data: {
          userId,
          type: 'ADMIN_ADJUSTMENT',
          amount,
          description: reason || `Admin balance adjustment by ${request.admin!.username || request.admin!.telegramId}`
        }
      });
      await logAdminAction(
        request.admin!.id,
        "BALANCE_CHANGE",
        userId,
        `Changed user balance by ${amount}`,
        { amount, reason, oldBalance: user.balance, newBalance: updatedUser.balance }
      );
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error("Error updating user balance:", error);
      return reply.status(500).send({ error: "Failed to update balance" });
    }
  });
  fastify.post("/users/:userId/block", async (request, reply) => {
    const paramsSchema = z.object({
      userId: z.string()
    });
    const bodySchema = z.object({
      blocked: z.boolean(),
      reason: z.string().optional()
    });
    try {
      const { userId } = paramsSchema.parse(request.params);
      const { blocked, reason } = bodySchema.parse(request.body);
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isBlocked: blocked }
      });
      await logAdminAction(
        request.admin!.id,
        blocked ? "BLOCK_USER" : "UNBLOCK_USER",
        userId,
        `${blocked ? 'Blocked' : 'Unblocked'} user: ${reason || 'No reason provided'}`,
        { reason }
      );
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error("Error blocking/unblocking user:", error);
      return reply.status(500).send({ error: "Failed to update user status" });
    }
  });
  fastify.get("/users/:userId/history", async (request, reply) => {
    const paramsSchema = z.object({
      userId: z.string()
    });
    try {
      const { userId } = paramsSchema.parse(request.params);
      const [transactions, caseOpenings] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),
        prisma.caseOpening.findMany({
          where: { userId },
          include: {
            case: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        })
      ]);
      await logAdminAction(
        request.admin!.id,
        "VIEW_USER_HISTORY",
        userId,
        "Viewed user transaction and case opening history"
      );
      return { transactions, caseOpenings };
    } catch (error) {
      console.error("Error fetching user history:", error);
      return reply.status(500).send({ error: "Failed to fetch user history" });
    }
  });
  fastify.get("/promocodes", async (request, reply) => {
    try {
      const promocodes = await prisma.promocode.findMany({
        include: {
          userPromocodes: {
            include: {
              user: {
                select: { username: true, firstName: true, telegramId: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      await logAdminAction(
        request.admin!.id,
        "VIEW_PROMOCODES",
        null,
        "Viewed promocodes list"
      );
      return { promocodes };
    } catch (error) {
      console.error("Error fetching promocodes:", error);
      return reply.status(500).send({ error: "Failed to fetch promocodes" });
    }
  });
  fastify.post("/promocodes", async (request, reply) => {
    const bodySchema = z.object({
      code: z.string().min(3).max(50),
      description: z.string().optional(),
      bonusAmount: z.number().min(0),
      bonusPercent: z.number().min(0).max(100).optional(),
      maxUses: z.number().min(1).optional(),
      expiresAt: z.string().optional().transform(str => str ? new Date(str) : undefined)
    });
    try {
      const data = bodySchema.parse(request.body);
      const promocode = await prisma.promocode.create({
        data
      });
      await logAdminAction(
        request.admin!.id,
        "CREATE_PROMOCODE",
        promocode.id,
        `Created promocode: ${promocode.code}`,
        data
      );
      return { success: true, promocode };
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.status(400).send({ error: "Promocode already exists" });
      }
      console.error("Error creating promocode:", error);
      return reply.status(500).send({ error: "Failed to create promocode" });
    }
  });
  fastify.put("/promocodes/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string()
    });
    const bodySchema = z.object({
      description: z.string().optional(),
      bonusAmount: z.number().min(0).optional(),
      bonusPercent: z.number().min(0).max(100).optional(),
      maxUses: z.number().min(1).optional(),
      isActive: z.boolean().optional(),
      expiresAt: z.string().optional().transform(str => str ? new Date(str) : undefined)
    });
    try {
      const { id } = paramsSchema.parse(request.params);
      const data = bodySchema.parse(request.body);
      const promocode = await prisma.promocode.update({
        where: { id },
        data
      });
      await logAdminAction(
        request.admin!.id,
        "UPDATE_PROMOCODE",
        promocode.id,
        `Updated promocode: ${promocode.code}`,
        data
      );
      return { success: true, promocode };
    } catch (error) {
      console.error("Error updating promocode:", error);
      return reply.status(500).send({ error: "Failed to update promocode" });
    }
  });
  fastify.delete("/promocodes/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string()
    });
    try {
      const { id } = paramsSchema.parse(request.params);
      const promocode = await prisma.promocode.delete({
        where: { id }
      });
      await logAdminAction(
        request.admin!.id,
        "DELETE_PROMOCODE",
        promocode.id,
        `Deleted promocode: ${promocode.code}`
      );
      return { success: true };
    } catch (error) {
      console.error("Error deleting promocode:", error);
      return reply.status(500).send({ error: "Failed to delete promocode" });
    }
  });
  fastify.get("/referral-links", async (request, reply) => {
    try {
      const links = await prisma.referralLink.findMany({
        include: {
          users: {
            select: { id: true, username: true, firstName: true, createdAt: true }
          },
          deposits: {
            select: { amount: true, createdAt: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      const linksWithStats = links.map(link => ({
        ...link,
        totalUsers: link.users.length,
        totalDeposits: link.deposits.reduce((sum, d) => sum + d.amount, 0),
        depositsCount: link.deposits.length
      }));
      await logAdminAction(
        request.admin!.id,
        "VIEW_REFERRAL_LINKS",
        null,
        "Viewed referral links list"
      );
      return { referralLinks: linksWithStats };
    } catch (error) {
      console.error("Error fetching referral links:", error);
      return reply.status(500).send({ error: "Failed to fetch referral links" });
    }
  });
  fastify.post("/referral-links", async (request, reply) => {
    const bodySchema = z.object({
      code: z.string().min(3).max(50),
      name: z.string().optional(),
      description: z.string().optional()
    });
    try {
      const data = bodySchema.parse(request.body);
      const referralLink = await prisma.referralLink.create({
        data
      });
      await logAdminAction(
        request.admin!.id,
        "CREATE_REFERRAL_LINK",
        referralLink.id,
        `Created referral link: ${referralLink.code}`,
        data
      );
      return { success: true, referralLink };
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.status(400).send({ error: "Referral link code already exists" });
      }
      console.error("Error creating referral link:", error);
      return reply.status(500).send({ error: "Failed to create referral link" });
    }
  });
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
      const casesWithStats = cases.map(caseItem => ({
        ...caseItem,
        totalOpenings: caseItem.openings.length,
        revenue: caseItem.openings.length * caseItem.price
      }));
      await logAdminAction(
        request.admin!.id,
        "VIEW_CASES",
        null,
        "Viewed cases list"
      );
      return { cases: casesWithStats };
    } catch (error) {
      console.error("Error fetching cases:", error);
      return reply.status(500).send({ error: "Failed to fetch cases" });
    }
  });
  fastify.post("/cases", async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().min(0),
      imageUrl: z.string().optional(),
      isActive: z.boolean().optional().default(true),
      isLocked: z.boolean().optional().default(false),
      unlockLevel: z.number().optional(),
      unlockPrice: z.number().optional()
    });
    try {
      const data = bodySchema.parse(request.body);
      const caseItem = await prisma.case.create({
        data
      });
      await logAdminAction(
        request.admin!.id,
        "CREATE_CASE",
        caseItem.id,
        `Created case: ${caseItem.name}`,
        data
      );
      return { success: true, case: caseItem };
    } catch (error) {
      console.error("Error creating case:", error);
      return reply.status(500).send({ error: "Failed to create case" });
    }
  });
  fastify.post("/cases/with-nfts", async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().min(0),
      imageUrl: z.string().optional(),
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
          isActive: data.isActive,
          isLocked: data.isLocked,
          unlockLevel: data.unlockLevel,
          unlockPrice: data.unlockPrice
        }
      });
      await Promise.all(data.nftItems.map(async (nftItem) => {
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
        return prisma.caseItem.create({
          data: {
            caseId: caseItem.id,
            itemId: item.id,
            dropChance: nftItem.dropChance
          }
        });
      }));
      await logAdminAction(
        request.admin!.id,
        "CREATE_NFT_CASE",
        caseItem.id,
        `Created NFT case: ${caseItem.name} with ${data.nftItems.length} items`,
        { 
          caseData: data,
          totalItems: data.nftItems.length,
          totalChance
        }
      );
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
      return reply.status(500).send({ error: "Failed to create NFT case" });
    }
  });
  fastify.get("/cases/available-nfts", async (request, reply) => {
    const querySchema = z.object({
      search: z.string().optional(),
      collection: z.string().optional(),
      limit: z.string().optional().default("100")
    });
    try {
      const { search, collection, limit } = querySchema.parse(request.query);
      await logAdminAction(
        request.admin!.id,
        "VIEW_AVAILABLE_NFTS",
        null,
        "Viewed available NFTs for case creation"
      );
      return { 
        message: "Use frontend partners API integration to get available NFTs",
        params: { search, collection, limit }
      };
    } catch (error) {
      console.error("Error fetching available NFTs:", error);
      return reply.status(500).send({ error: "Failed to fetch available NFTs" });
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
      await logAdminAction(
        request.admin!.id,
        "UPDATE_CASE",
        caseItem.id,
        `Updated case: ${caseItem.name}`,
        data
      );
      return { success: true, case: caseItem };
    } catch (error) {
      console.error("Error updating case:", error);
      return reply.status(500).send({ error: "Failed to update case" });
    }
  });
  fastify.delete("/cases/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string()
    });
    try {
      const { id } = paramsSchema.parse(request.params);
      const caseItem = await prisma.case.findUnique({
        where: { id }
      });
      if (!caseItem) {
        return reply.status(404).send({ error: "Case not found" });
      }
      await prisma.case.delete({
        where: { id }
      });
      await logAdminAction(
        request.admin!.id,
        "DELETE_CASE",
        id,
        `Deleted case: ${caseItem.name}`
      );
      return { success: true };
    } catch (error) {
      console.error("Error deleting case:", error);
      return reply.status(500).send({ error: "Failed to delete case" });
    }
  });
  fastify.get("/gifts", async (request, reply) => {
    try {
      const gifts = await prisma.gift.findMany({
        orderBy: { createdAt: 'desc' }
      });
      await logAdminAction(
        request.admin!.id,
        "VIEW_GIFTS",
        null,
        "Viewed gifts list"
      );
      return { gifts };
    } catch (error) {
      console.error("Error fetching gifts:", error);
      return reply.status(500).send({ error: "Failed to fetch gifts" });
    }
  });
  fastify.post("/gifts", async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      price: z.number().min(0),
      isActive: z.boolean().optional().default(true)
    });
    try {
      const data = bodySchema.parse(request.body);
      const gift = await prisma.gift.create({
        data
      });
      await logAdminAction(
        request.admin!.id,
        "CREATE_GIFT",
        gift.id,
        `Created gift: ${gift.name}`,
        data
      );
      return { success: true, gift };
    } catch (error) {
      console.error("Error creating gift:", error);
      return reply.status(500).send({ error: "Failed to create gift" });
    }
  });
  fastify.put("/referral-links/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string()
    });
    const bodySchema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional()
    });
    try {
      const { id } = paramsSchema.parse(request.params);
      const data = bodySchema.parse(request.body);
      const referralLink = await prisma.referralLink.update({
        where: { id },
        data
      });
      await logAdminAction(
        request.admin!.id,
        "UPDATE_REFERRAL_LINK",
        referralLink.id,
        `Updated referral link: ${referralLink.code}`,
        data
      );
      return { success: true, referralLink };
    } catch (error) {
      console.error("Error updating referral link:", error);
      return reply.status(500).send({ error: "Failed to update referral link" });
    }
  });
  fastify.delete("/referral-links/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string()
    });
    try {
      const { id } = paramsSchema.parse(request.params);
      const referralLink = await prisma.referralLink.findUnique({
        where: { id }
      });
      if (!referralLink) {
        return reply.status(404).send({ error: "Referral link not found" });
      }
      await prisma.referralLink.delete({
        where: { id }
      });
      await logAdminAction(
        request.admin!.id,
        "DELETE_REFERRAL_LINK",
        id,
        `Deleted referral link: ${referralLink.code}`
      );
      return { success: true };
    } catch (error) {
      console.error("Error deleting referral link:", error);
      return reply.status(500).send({ error: "Failed to delete referral link" });
    }
  });
  fastify.get("/logs", async (request, reply) => {
    const querySchema = z.object({
      page: z.string().optional().default("1"),
      limit: z.string().optional().default("50")
    });
    try {
      const { page, limit } = querySchema.parse(request.query);
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [logs, total] = await Promise.all([
        prisma.adminLog.findMany({
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.adminLog.count()
      ]);
      return {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      console.error("Error fetching admin logs:", error);
      return reply.status(500).send({ error: "Failed to fetch logs" });
    }
  });
  fastify.post("/upload/case-image", async (request: any, reply) => {
    try {
      await ensureUploadDir();
      const imagePath = await handleFileUpload(request);
      const fileName = imagePath.split('/').pop();
      const gitlabUrl = `https://gitlab.com/Monty2493/telegram-cases-be/-/raw/main/public/images/cases/${fileName}`;
      await logAdminAction(
        request.admin!.id,
        "upload_case_image",
        "image",
        `Uploaded case image: ${gitlabUrl}`
      );
      return { 
        success: true,
        imagePath: gitlabUrl,
        imageUrl: gitlabUrl
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
      await deleteFile(imagePath);
      await logAdminAction(
        request.admin!.id,
        "delete_case_image",
        "image",
        `Deleted case image: ${imagePath}`
      );
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting case image:", error);
      return reply.status(400).send({ error: error.message || "Failed to delete image" });
    }
  });
}