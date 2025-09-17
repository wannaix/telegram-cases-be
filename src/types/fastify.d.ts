import { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth.js";
interface AuthUser {
  id: string;
  telegramId: string;
  username?: string;
}
interface OptionalUser extends AuthUser {
  isAdmin?: boolean;
}
declare module "fastify" {
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
  interface FastifyRequest {
    user?: AuthUser; 
    currentUser?: OptionalUser; 
  }
}
