import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();
const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("4000").transform(Number),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("7d"),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  PARTNERS_API_KEY: z.string().min(1),
});
export const config = configSchema.parse(process.env);
