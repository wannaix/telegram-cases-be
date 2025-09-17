import { FastifyInstance } from "fastify";
import { partnersApi } from "../services/partnersApi.js";
export async function liveDropsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    { websocket: true },
    (connection ) => {
      let lastSentActions = new Set<string>();
      const sendLatestDrops = async () => {
        try {
          const liveDrops = await partnersApi.getLiveDrops();
          if (liveDrops.length > 0) {
            const newDrops = liveDrops.filter(drop => {
              const key = `${drop.id}-${drop.timestamp}`;
              return !lastSentActions.has(key);
            });
            for (const drop of newDrops.slice(0, 3)) { 
              connection.send(JSON.stringify(drop));
              lastSentActions.add(`${drop.id}-${drop.timestamp}`);
            }
            if (lastSentActions.size > 50) {
              const entries = Array.from(lastSentActions);
              lastSentActions = new Set(entries.slice(-50));
            }
          } else {
            console.log("No live drops available from Partners API");
          }
        } catch (error) {
          console.error("Error fetching live drops:", error);
        }
      };
      sendLatestDrops();
      const interval = setInterval(sendLatestDrops, 10000);
      connection.on("close", () => {
        clearInterval(interval);
      });
    }
  );
} 