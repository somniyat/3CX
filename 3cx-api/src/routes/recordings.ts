import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { I3CXModule, Recording } from "../types/i3cx-module";

const listQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  caller: z.string().optional(),
  callee: z.string().optional(),
  phone: z.string().optional(),
  transcribed: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(500).optional(),
});

type PaginatedLike<T> = { list?: T[]; totalCount?: number; data?: T[]; total?: number };

function normalizePaginated<T>(payload: PaginatedLike<T>): { list: T[]; totalCount: number } {
  const list = payload.list ?? payload.data ?? [];
  return { list, totalCount: payload.totalCount ?? payload.total ?? list.length };
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function includesPhone(value: unknown, needle?: string) {
  if (!needle) return true;
  const normalizedNeedle = digits(needle);
  return Boolean(normalizedNeedle && digits(value).includes(normalizedNeedle));
}

function filterRecordings(recordings: Recording[], query: z.infer<typeof listQuerySchema>) {
  return recordings.filter((recording) => {
    if (query.phone && !includesPhone(recording.caller, query.phone) && !includesPhone(recording.callee, query.phone)) return false;
    if (query.caller && !includesPhone(recording.caller, query.caller) && !String(recording.callerName || "").toLowerCase().includes(query.caller.toLowerCase())) return false;
    if (query.callee && !includesPhone(recording.callee, query.callee) && !String(recording.calleeName || "").toLowerCase().includes(query.callee.toLowerCase())) return false;
    if (query.transcribed === "true" && !recording.isTranscribed && !recording.transcription) return false;
    if (query.transcribed === "false" && (recording.isTranscribed || recording.transcription)) return false;
    return true;
  });
}

export function createRecordingsRouter(injectedModule?: I3CXModule): Router {
  const router = Router();

  const m = (req: Request) => injectedModule || req.threecx;

  router.get("/", async (req: Request, res: Response) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Paramètres invalides", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const data = normalizePaginated(await m(req).getRecordings(parsed.data as any) as PaginatedLike<Recording>);
    const list = filterRecordings(data.list, parsed.data);
    const filteredOnApi = Boolean(parsed.data.phone || parsed.data.caller || parsed.data.callee || parsed.data.transcribed);
    res.json({ list, totalCount: filteredOnApi ? list.length : data.totalCount, data: list, total: filteredOnApi ? list.length : data.totalCount });
  });

  router.get("/:id/download", async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params.id as string;
    try {
      const { stream, contentType } = await m(req).downloadRecording(id);
      res.setHeader("Content-Type", contentType || "audio/wav");
      res.setHeader("Content-Disposition", `attachment; filename="recording-${id}.wav"`);
      (stream as any).pipe(res);
    } catch (err: any) {
      console.error(`[Recordings] Echec download ${id}:`, err.message);
      const status = err.response?.status || 500;
      res.status(status).json({ error: `Impossible de telecharger l'enregistrement ${id}` });
    }
  });

  return router;
}

export default createRecordingsRouter();
