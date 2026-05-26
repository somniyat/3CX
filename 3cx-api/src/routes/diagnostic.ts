import { Router, type Request, type Response } from "express";
import { threecx } from "../config/3cx";
import type { I3CXModule } from "../types/i3cx-module";

export function createDiagnosticRouter(module: I3CXModule): Router {
  const router = Router();

  router.get("/access-audit", async (_req: Request, res: Response) => {
    const start = Date.now();
    console.log("[Diagnostic] Audit lance");

    const result = await module.runAccessAudit();

    const elapsed = Date.now() - start;
    console.log(
      `[Diagnostic] Audit termine en ${elapsed}ms (${result.summary.accessible}/${result.summary.total} OK)`
    );

    res.json(result);
  });

  return router;
}

export default createDiagnosticRouter(threecx as unknown as I3CXModule);
