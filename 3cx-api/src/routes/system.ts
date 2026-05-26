import { Router, type Request, type Response } from "express";
import { threecx } from "../config/3cx";
import type { I3CXModule } from "../types/i3cx-module";

export function createSystemRouter(module: I3CXModule): Router {
  const router = Router();

  router.get("/status", async (_req: Request, res: Response) => {
    const data = await module.getSystemStatus();
    res.json(data);
  });

  router.get("/extensions", async (_req: Request, res: Response) => {
    const data = await module.getExtensions();
    res.json({ data });
  });

  return router;
}

export default createSystemRouter(threecx as unknown as I3CXModule);
