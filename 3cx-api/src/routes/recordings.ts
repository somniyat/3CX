import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { I3CXModule, Recording } from "../types/i3cx-module";

const SORTABLE_FIELDS = ["date", "caller", "callee", "duration"] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

const listQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  caller: z.string().optional(),
  callee: z.string().optional(),
  phone: z.string().optional(),
  transcribed: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(SORTABLE_FIELDS).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
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

function str(v: unknown): string { return String(v ?? ""); }
function num(v: unknown): number { return typeof v === "number" ? v : 0; }

function sortRecordings(recordings: Recording[], sortBy?: SortField, sortOrder: "asc" | "desc" = "asc"): Recording[] {
  if (!sortBy) return recordings;
  const dir = sortOrder === "desc" ? -1 : 1;
  return [...recordings].sort((a, b) => {
    let va: string | number;
    let vb: string | number;
    switch (sortBy) {
      case "date":
        va = str(a.startTime || a.date);
        vb = str(b.startTime || b.date);
        break;
      case "caller":
        va = str(a.callerName || a.caller).toLowerCase();
        vb = str(b.callerName || b.caller).toLowerCase();
        break;
      case "callee":
        va = str(a.calleeName || a.callee).toLowerCase();
        vb = str(b.calleeName || b.callee).toLowerCase();
        break;
      case "duration":
        va = num(a.duration);
        vb = num(b.duration);
        break;
      default:
        return 0;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
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
    const { caller, callee, phone, transcribed, sortBy, sortOrder, page, pageSize, ...dateParams } = parsed.data;
    const needsClientFilter = Boolean(caller || callee || phone || transcribed);

    if (needsClientFilter || sortBy) {
      // Fetch a large batch so client-side filtering/sorting has enough candidates
      const apiParams = { ...dateParams, page: 1, pageSize: 500 };
      const data = normalizePaginated(await m(req).getRecordings(apiParams as any) as PaginatedLike<Recording>);
      const filtered = filterRecordings(data.list, parsed.data);
      const sorted = sortRecordings(filtered, sortBy, sortOrder);
      const p = page || 1;
      const ps = pageSize || 50;
      const start = (p - 1) * ps;
      const list = sorted.slice(start, start + ps);
      res.json({ list, totalCount: filtered.length, data: list, total: filtered.length });
    } else {
      const data = normalizePaginated(await m(req).getRecordings(parsed.data as any) as PaginatedLike<Recording>);
      res.json({ list: data.list, totalCount: data.totalCount, data: data.list, total: data.totalCount });
    }
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
