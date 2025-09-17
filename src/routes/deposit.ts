import { FastifyInstance } from "fastify";
import axios from "axios";
import { prisma } from "../lib/prisma.js";
import type { FastifyRequest } from "fastify";
const depositWsClients: Record<string, Set<any>> = {};
export async function depositRoutes(fastify: FastifyInstance) {
  fastify.get("/", { websocket: true }, async (connection, req: FastifyRequest) => {
    let userId: string | undefined;
    try {
      const token = req.headers["authorization"]?.replace("Bearer ", "");
      if (token) {
        const decoded: any = fastify.jwt.decode(token);
        userId = decoded.id;
      }
    } catch {}
    if (!userId) {
      connection.close();
      return;
    }
    if (!depositWsClients[userId]) depositWsClients[userId] = new Set();
    depositWsClients[userId].add(connection);
    connection.on("close", () => {
      depositWsClients[userId].delete(connection);
      if (depositWsClients[userId].size === 0) delete depositWsClients[userId];
    });
  });
  fastify.post("/cryptobot-invoice", async (request, reply) => {
    const { amount } = request.body as { amount: string | number };
    const CRYPTOBOT_TOKEN = process.env.CRYPTOBOT_TOKEN!;
    if (!CRYPTOBOT_TOKEN) {
      reply.status(500).send({ error: "CryptoBot token not set" });
      return;
    }
    try {
      const res = await axios.post(
        "https://pay.crypt.bot/api/createInvoice",
        {
          asset: "TON",
          amount: amount,
        },
        {
          headers: {
            "Crypto-Pay-API-Token": CRYPTOBOT_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );
      const hash = res.data.result.hash;
      const appUrl = `https://t.me/CryptoBot/app?startapp=invoice-${hash}&mode=compact`;
      return { invoiceUrl: appUrl };
    } catch (e: any) {
      reply.status(500).send({ error: e.message || "Failed to create invoice" });
      return;
    }
  });
  fastify.post(
    "/ton-initiate",
    { preHandler: [fastify.authenticate] },
    async (request: any, reply) => {
      const userId = request.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true },
      });
      if (!user || !user.telegramId) {
        return reply.status(404).send({ error: "User not found or no telegramId" });
      }
      const tonAddress = process.env.TON_DEPOSIT_ADDRESS;
      const memo = `tg${user.telegramId}`;
      return reply.send({ address: tonAddress, memo });
    }
  );
  fastify.get(
    "/balance",
    { preHandler: [fastify.authenticate] },
    async (request: any, reply) => {
      const userId = request.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      return { balance: user.balance };
    }
  );
  fastify.post(
    "/ton-check",
    { preHandler: [fastify.authenticate] }, 
    async (request: any, reply) => {
      const tonAddress = process.env.TON_DEPOSIT_ADDRESS;
      const tonApiKey = process.env.TONCENTER_API_KEY;
      if (!tonAddress || !tonApiKey) {
        return reply.status(500).send({ error: "TON address or API key not set" });
      }
      try {
        const res = await axios.get(
          `https://toncenter.com/api/v2/getTransactions?address=${tonAddress}&limit=20&api_key=${tonApiKey}`
        );
        const txs = res.data.result;
        let credited = 0;
        for (const tx of txs) {
          if (tx.in_msg && tx.in_msg.message) {
            const memo = tx.in_msg.message;
            if (memo.startsWith("tg")) {
              const telegramId = memo.slice(2);
              const user = await prisma.user.findUnique({ where: { telegramId } });
              if (user) {
                const exists = await prisma.transaction.findFirst({
                  where: { description: tx.transaction_id },
                });
                if (!exists) {
                  await creditDeposit({
                    userId: user.id,
                    amount: Number(tx.in_msg.value) / 1e9, 
                    description: tx.transaction_id, 
                  });
                  credited++;
                }
              }
            }
          }
        }
        return reply.send({ credited });
      } catch (e: any) {
        return reply.status(500).send({ error: e.message || "Failed to check TON transactions" });
      }
    }
  );
}
export async function creditDeposit({ userId, amount, description = "Deposit via CryptoBot" }: { userId: string, amount: number, description?: string }) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        amount,
        description,
      },
    }),
  ]);
  if (depositWsClients[userId]) {
    for (const ws of depositWsClients[userId]) {
      ws.send(JSON.stringify({ type: "deposit_credited", amount }));
    }
  }
} 