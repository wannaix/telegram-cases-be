import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    telegramId: string;
    username?: string;
  };
}
export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "No token provided" });
    }
    const token = authHeader.replace("Bearer ", "");
    const decoded = request.server.jwt.verify(token) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, telegramId: true, username: true },
    });
    if (!user) {
      return reply.status(401).send({ error: "User not found" });
    }
    const { id, telegramId, username } = user;
    (request as AuthenticatedRequest).user = {
      id,
      telegramId,
      ...(username ? { username } : {})
    };
  } catch (error) {
    return reply.status(401).send({ error: "Invalid token" });
  }
};
