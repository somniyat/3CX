import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { threecx } from "../config/3cx";
import type { I3CXModule } from "../types/i3cx-module";

const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(100).optional(),
  enabledOnly: z.coerce.boolean().optional(),
});

export function createUsersRouter(module: I3CXModule): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    const parsed = listUsersQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: "Parametres invalides",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const start = Date.now();

    try {
      const result = await module.listUsers(parsed.data);
      const elapsed = Date.now() - start;
      console.log(
        `[Users] page=${parsed.data.page} pageSize=${parsed.data.pageSize} search=${parsed.data.search ?? ""} → ${result.items.length} items en ${elapsed}ms`
      );
      res.json(result);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 403) {
        res.status(403).json({
          error: "forbidden",
          hint: "Le role actuel ne permet pas cette operation. Voir /diagnostic.",
        });
        return;
      }
      throw err;
    }
  });

  return router;
}

export default createUsersRouter(threecx as unknown as I3CXModule);
