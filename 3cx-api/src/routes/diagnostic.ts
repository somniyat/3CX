import { Router, type Request, type Response } from "express";
import type { I3CXModule } from "../types/i3cx-module";

export function createDiagnosticRouter(injectedModule?: I3CXModule): Router {
  const router = Router();

  const m = (req: Request) => injectedModule || req.threecx;

  router.get("/access-audit", async (req: Request, res: Response) => {
    const start = Date.now();
    console.log("[Diagnostic] Audit lance");

    const result = await m(req).runAccessAudit();

    const elapsed = Date.now() - start;
    console.log(
      `[Diagnostic] Audit termine en ${elapsed}ms (${result.summary.accessible}/${result.summary.total} OK)`
    );

    res.json(result);
  });

  return router;
}

export default createDiagnosticRouter();
