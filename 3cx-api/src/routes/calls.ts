import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { CallRecord, Driver, I3CXModule, Recording, Transcription } from "../types/i3cx-module";

const SORTABLE_FIELDS = ["date", "caller", "callee", "duration", "status"] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

const historyQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  caller: z.string().optional(),
  callee: z.string().optional(),
  phone: z.string().optional(),
  driverId: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(SORTABLE_FIELDS).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(500).optional(),
});

type HistoryQuery = z.infer<typeof historyQuerySchema>;

type PaginatedLike<T> = {
  list?: T[];
  totalCount?: number;
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

function normalizePaginated<T>(payload: PaginatedLike<T>): { list: T[]; totalCount: number } {
  const list = payload.list ?? payload.data ?? [];
  return { list, totalCount: payload.totalCount ?? payload.total ?? list.length };
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function includesPhone(value: unknown, needle: string) {
  const haystack = digits(value);
  const normalizedNeedle = digits(needle);
  return Boolean(normalizedNeedle && haystack.includes(normalizedNeedle));
}

function timeToMinutes(value?: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function callMinute(call: CallRecord) {
  const date = new Date(call.startTime);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function filterCalls(calls: CallRecord[], query: HistoryQuery, driver?: Driver | null) {
  const phone = query.phone;
  const startMinute = timeToMinutes(query.startTime);
  const endMinute = timeToMinutes(query.endTime);
  const driverNeedles = driver ? [driver.extension, driver.phone].filter(Boolean) as string[] : [];

  return calls.filter((call) => {
    if (query.status && call.status !== query.status) return false;
    if (phone && !includesPhone(call.caller, phone) && !includesPhone(call.callee, phone)) return false;
    if (driverNeedles.length && !driverNeedles.some((value) => includesPhone(call.caller, value) || includesPhone(call.callee, value))) return false;

    const minute = callMinute(call);
    if (minute !== null && startMinute !== null && minute < startMinute) return false;
    if (minute !== null && endMinute !== null && minute > endMinute) return false;
    return true;
  });
}

function str(v: unknown): string { return String(v ?? ""); }
function num(v: unknown): number { return typeof v === "number" ? v : 0; }

function sortCalls(calls: CallRecord[], sortBy?: SortField, sortOrder: "asc" | "desc" = "asc"): CallRecord[] {
  if (!sortBy) return calls;
  const dir = sortOrder === "desc" ? -1 : 1;
  return [...calls].sort((a, b) => {
    let va: string | number;
    let vb: string | number;
    switch (sortBy) {
      case "date":
        va = str(a.startTime);
        vb = str(b.startTime);
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
      case "status":
        va = str(a.status);
        vb = str(b.status);
        break;
      default:
        return 0;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

function isCallLinkedToRecording(call: CallRecord, recording: Recording) {
  if (call.recordingId && String(call.recordingId) === String(recording.id)) return true;
  const callId = String(call.id || "");
  if (callId && String(recording.callId || "") === callId) return true;

  const sameParties =
    (includesPhone(recording.caller, call.caller) && includesPhone(recording.callee, call.callee)) ||
    (includesPhone(recording.caller, call.callee) && includesPhone(recording.callee, call.caller));
  if (!sameParties) return false;

  const callStart = new Date(call.startTime).getTime();
  const recordingStart = new Date(String(recording.startTime || recording.date || "")).getTime();
  if (Number.isNaN(callStart) || Number.isNaN(recordingStart)) return true;
  return Math.abs(callStart - recordingStart) <= 5 * 60 * 1000;
}

function transcriptionFromRecording(recording?: Recording | null): Transcription | null {
  const transcription = String(recording?.transcription || "").trim();
  if (!transcription) return null;
  return {
    id: String(recording?.id || ""),
    transcription,
    summary: String(recording?.summary || ""),
    sentimentScore: Number(recording?.sentimentScore || 0),
    isTranscribed: Boolean(recording?.isTranscribed),
    segments: transcription.split("\n").filter(Boolean).map((line) => ({ text: line.trim() })),
  };
}

async function getDriverFromQuery(module: I3CXModule, query: HistoryQuery) {
  if (!query.driverId) return null;
  return module.getDriver(query.driverId).catch(() => null);
}

async function enrichCalls(module: I3CXModule, calls: CallRecord[], query: HistoryQuery, driver?: Driver | null) {
  let recordings: Recording[] = [];
  try {
    const recordingPayload = await module.getRecordings({
      startDate: query.startDate,
      endDate: query.endDate,
      caller: query.caller,
      callee: query.callee,
      phone: query.phone,
      page: 1,
      pageSize: 500,
    } as any);
    recordings = normalizePaginated(recordingPayload as PaginatedLike<Recording>).list;
  } catch (err: any) {
    console.warn("[CallHistory] Enrichissement enregistrements indisponible (%s)", err.message);
  }

  return calls.map((call) => {
    const recording = recordings.find((candidate) => isCallLinkedToRecording(call, candidate)) ?? null;
    return {
      ...call,
      driver: driver && filterCalls([call], { ...query, driverId: query.driverId }, driver).length ? driver : null,
      recording,
      recordingId: recording?.id ?? call.recordingId ?? null,
      transcript: transcriptionFromRecording(recording),
    };
  });
}

export function createCallsRouter(injectedModule?: I3CXModule): Router {
  const router = Router();

  const m = (req: Request) => injectedModule || req.threecx;

  router.get("/history", async (req: Request, res: Response) => {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Paramètres invalides", details: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      const module = m(req);
      const query = parsed.data;
      const driver = await getDriverFromQuery(module, query);
      const data = normalizePaginated(await module.getCallHistory(query) as PaginatedLike<CallRecord>);
      const filtered = filterCalls(data.list, query, driver);
      const sorted = sortCalls(filtered, query.sortBy, query.sortOrder);
      const enriched = await enrichCalls(module, sorted, query, driver);
      res.json({ list: enriched, totalCount: query.phone || query.driverId || query.startTime || query.endTime || query.status ? enriched.length : data.totalCount, data: enriched, total: enriched.length });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403) {
        res.status(403).json({ error: "Accès interdit — permissions insuffisantes pour l'historique" });
      } else if (status === 500 || err.code === "ECONNABORTED") {
        console.warn("[CallHistory] Endpoint indisponible (%s) — renvoi liste vide", err.message);
        res.json({ list: [], totalCount: 0, data: [], total: 0, unavailable: true });
      } else {
        throw err;
      }
    }
  });

  router.get("/history/all", async (req: Request, res: Response) => {
    const parsed = historyQuerySchema.omit({ page: true, pageSize: true }).safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Paramètres invalides", details: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      const module = m(req);
      const data = await module.getAllCallHistory(parsed.data);
      res.json({ data, total: data.length, list: data, totalCount: data.length });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403 || status === 500 || err.code === "ECONNABORTED") {
        console.warn("[CallHistory] Endpoint indisponible (%s) — renvoi liste vide", err.message);
        res.json({ data: [], total: 0, list: [], totalCount: 0, unavailable: true });
      } else {
        throw err;
      }
    }
  });

  // ─── POST /lookup — Recherche d'historique par numéros + créneau ───
  const lookupSchema = z.object({
    phones: z.array(z.string().min(1)).min(1, "Au moins un numéro requis"),
    from: z.string().min(1, "Date/heure de début requise (ISO 8601 ou YYYY-MM-DD)"),
    to: z.string().min(1, "Date/heure de fin requise (ISO 8601 ou YYYY-MM-DD)"),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(500).default(50),
  });

  router.post("/lookup", async (req: Request, res: Response) => {
    const parsed = lookupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Paramètres invalides",
        details: parsed.error.flatten().fieldErrors,
        example: {
          phones: ["+41791234567", "1001"],
          from: "2025-06-01",
          to: "2025-06-07T23:59:59Z",
          page: 1,
          pageSize: 50,
        },
      });
      return;
    }

    const { phones, from, to, page, pageSize } = parsed.data;
    const module = m(req);

    try {
      // Récupérer l'historique brut sur le créneau demandé
      const raw = normalizePaginated(
        await module.getCallHistory({
          startDate: from,
          endDate: to,
          page: 1,
          pageSize: 500,
        }) as PaginatedLike<CallRecord>,
      );

      // Si le module retourne moins que le total, paginer côté 3CX
      let allCalls = raw.list;
      if (raw.totalCount > 500) {
        const extraPages = Math.ceil(raw.totalCount / 500);
        const fetches: Promise<CallRecord[]>[] = [];
        for (let p = 2; p <= extraPages && allCalls.length < 5000; p++) {
          fetches.push(
            module.getCallHistory({ startDate: from, endDate: to, page: p, pageSize: 500 })
              .then((r: any) => normalizePaginated(r as PaginatedLike<CallRecord>).list),
          );
        }
        const extra = await Promise.all(fetches);
        allCalls = allCalls.concat(...extra);
      }

      // Filtrer par numéros de téléphone
      const normalizedPhones = phones.map((p) => digits(p));

      const matched = allCalls.filter((call) =>
        normalizedPhones.some(
          (needle) => includesPhone(call.caller, needle) || includesPhone(call.callee, needle),
        ),
      );

      // Grouper les résultats par numéro
      const byPhone: Record<string, CallRecord[]> = {};
      for (const phone of phones) {
        const needle = digits(phone);
        byPhone[phone] = matched.filter(
          (call) => includesPhone(call.caller, needle) || includesPhone(call.callee, needle),
        );
      }

      // Pagination sur le résultat global
      const start = (page - 1) * pageSize;
      const paginated = matched.slice(start, start + pageSize);

      res.json({
        query: { phones, from, to },
        totalMatched: matched.length,
        page,
        pageSize,
        totalPages: Math.ceil(matched.length / pageSize),
        calls: paginated,
        byPhone,
      });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403) {
        res.status(403).json({ error: "Accès interdit — permissions insuffisantes" });
      } else if (status === 500 || err.code === "ECONNABORTED") {
        res.status(503).json({ error: "Serveur 3CX indisponible", details: err.message });
      } else {
        throw err;
      }
    }
  });

  router.get("/active", async (req: Request, res: Response) => {
    try {
      const module = m(req);
      const data = await module.getActiveCalls();
      res.json({ data });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403 || status === 500) {
        res.json({ data: [], unavailable: true });
      } else {
        throw err;
      }
    }
  });

  return router;
}

export default createCallsRouter();
