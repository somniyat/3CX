import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { I3CXModule } from "../types/i3cx-module";

const listQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(500).optional(),
});

function emptyTranscription(id: string) {
  return { id, transcription: "", summary: "", sentimentScore: 0, isTranscribed: false, segments: [], unavailable: true };
}

export function createTranscriptionsRouter(injectedModule?: I3CXModule): Router {
  const router = Router();

  const m = (req: Request) => injectedModule || req.threecx;

  router.get("/", async (req: Request, res: Response) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Paramètres invalides", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const data = await m(req).getTranscriptions(parsed.data);
    const list = (data as any).list ?? (data as any).data ?? [];
    const totalCount = (data as any).totalCount ?? (data as any).total ?? list.length;
    res.json({ list, totalCount, data: list, total: totalCount });
  });

  router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params.id;
    try {
      const data = await m(req).getTranscription(id);
      res.json(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        res.json(emptyTranscription(id));
        return;
      }
      throw err;
    }
  });

  return router;
}

export default createTranscriptionsRouter();
