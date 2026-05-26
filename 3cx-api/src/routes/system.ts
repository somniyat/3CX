import { Router, type Request, type Response } from "express";
import type { I3CXModule } from "../types/i3cx-module";

export function createSystemRouter(injectedModule?: I3CXModule): Router {
  const router = Router();

  const m = (req: Request) => injectedModule || req.threecx;

  router.get("/status", async (req: Request, res: Response) => {
    const data = await m(req).getSystemStatus();
    res.json(data);
  });

  router.get("/extensions", async (req: Request, res: Response) => {
    const data = await m(req).getExtensions();
    res.json({ data });
  });

  return router;
}

export default createSystemRouter();
