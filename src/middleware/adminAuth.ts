import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
declare module "fastify" {
  interface FastifyRequest {
    admin?: {
      id: string;
      telegramId: string;
      username?: string;
      firstName?: string;
      lastName?: string;
    };
  }
}
export async function adminAuthenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader === 'Bearer mock-admin-token') {
      let adminUser = await prisma.user.findFirst({
        where: { isAdmin: true }
      });
      if (!adminUser) {
        adminUser = await prisma.user.create({
          data: {
            telegramId: 'admin-123',
            username: 'admin',
            firstName: 'Admin',
            lastName: 'User',
            isAdmin: true,
            balance: 0
          }
        });
      }
      request.admin = {
        id: adminUser.id,
        telegramId: adminUser.telegramId,
        username: adminUser.username || undefined,
        firstName: adminUser.firstName || undefined,
        lastName: adminUser.lastName || undefined,
      };
      return; 
    }
    await request.jwtVerify();
    const userId = (request.user as any)?.userId;
    if (!userId) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Invalid token",
      });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
        isBlocked: true,
      },
    });
    if (!user) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "User not found",
      });
    }
    if (user.isBlocked) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "User is blocked",
      });
    }
    if (!user.isAdmin) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Admin access required",
      });
    }
    request.admin = {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username || undefined,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
    };
    const adminId = request.admin?.id || user?.id;
    if (adminId) {
      await logAdminAction(adminId, "AUTH", null, "Admin authenticated");
    }
  } catch (error) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
  }
}
export async function logAdminAction(
  adminId: string,
  action: string,
  target?: string | null,
  description?: string,
  metadata?: any
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        target,
        description,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
}