import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
export const optionalAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return;
    }
    const token = authHeader.replace("Bearer ", "");
    const decoded = request.server.jwt.verify(token) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true, 
        telegramId: true, 
        username: true,
        isAdmin: true 
      },
    });
    if (user) {
      request.currentUser = {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username || undefined,
        isAdmin: user.isAdmin
      };
    }
  } catch (error) {
    console.debug("Optional auth failed:", error);
  }
};
export const requireAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const user = request.currentUser;
  if (!user) {
    return reply.status(401).send({ error: "Authentication required" });
  }
  if (!user.isAdmin) {
    return reply.status(403).send({ error: "Admin access required" });
  }
};