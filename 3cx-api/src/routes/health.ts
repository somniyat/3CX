import { Router, type Request, type Response } from "express";
import { env } from "../config/env";
import { logger } from "../config/logger";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const health: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };

  // Deep check : tenter de joindre le serveur 3CX si des credentials env sont configures
  if (env.THREECX_BASE_URL) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${env.THREECX_BASE_URL}/xapi/v1/SystemStatus`, {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      health.threecx = {
        reachable: resp !== null && resp.status < 500,
        statusCode: resp?.status ?? null,
        latencyMs: Date.now() - start,
      };
    } catch {
      health.threecx = { reachable: false, latencyMs: Date.now() - start };
    }
  }

  const isHealthy = !health.threecx || (health.threecx as any).reachable;
  if (!isHealthy) {
    logger.warn(health, "Health check: serveur 3CX injoignable");
  }

  res.status(isHealthy ? 200 : 503).json(health);
});

export default router;
