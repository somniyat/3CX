import fs from "fs";
import path from "path";
import type { AxiosInstance } from "axios";
import { normalizeCallRecord } from "./CallHistory";
import { getExtensions } from "./System";

const DEFAULT_STORE_PATH = path.join(process.cwd(), "data", "drivers.json");

// ─── Types ──────────────────────────────────────────────────────

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  extension: string;
  threecxUserId: string | null;
  email: string | null;
  active: boolean;
  source: "auto" | "manual";
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateDriverInput {
  id?: string;
  name: string;
  phone?: string;
  extension: string;
  threecxUserId?: string;
  email?: string;
  active?: boolean;
}

export interface DriverDossierOptions {
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface DriverDossier {
  driver: Driver;
  calls: any[];
  recordings: any[];
  totalCalls: number;
  totalRecordings: number;
  generatedAt: string;
}

// ─── Stockage local ─────────────────────────────────────────────

function ensureStore(storePath: string): void {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({ drivers: [] }, null, 2), "utf-8");
  }
}

function readStore(storePath: string): { drivers: any[] } {
  ensureStore(storePath);
  return JSON.parse(fs.readFileSync(storePath, "utf-8"));
}

function writeStore(storePath: string, data: { drivers: any[] }): void {
  ensureStore(storePath);
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Auto-detection ─────────────────────────────────────────────

function detectDriversFromExtensions(extensions: any[]): Driver[] {
  return extensions
    .filter((ext) => ext.name && ext.name.toLowerCase().startsWith("chauffeur"))
    .map((ext) => ({
      id: `AUTO-${ext.number}`,
      name: ext.name,
      phone: null,
      extension: ext.number,
      threecxUserId: ext.id || null,
      email: ext.email || null,
      active: true,
      source: "auto" as const,
      createdAt: null,
      updatedAt: null,
    }));
}

function mergeDrivers(autoDrivers: Driver[], manualDrivers: Driver[]): Driver[] {
  const manualExtensions = new Set(manualDrivers.map((d) => d.extension));
  const filtered = autoDrivers.filter((d) => !manualExtensions.has(d.extension));
  return [...filtered, ...manualDrivers.map((d) => ({ ...d, source: (d.source || "manual") as "auto" | "manual" }))];
}

// ─── CRUD ───────────────────────────────────────────────────────

function listManualDrivers(storePath = DEFAULT_STORE_PATH): Driver[] {
  const store = readStore(storePath);
  return (store.drivers || []).map((d: any) => ({ ...d, source: "manual" as const }));
}

export async function listDrivers(http: AxiosInstance, storePath = DEFAULT_STORE_PATH): Promise<Driver[]> {
  let extensions: any[] = [];
  try {
    extensions = await getExtensions(http);
  } catch {
    // Si les extensions ne sont pas accessibles, on continue avec les manuels
  }
  const autoDrivers = detectDriversFromExtensions(extensions);
  const manualDrivers = listManualDrivers(storePath);
  return mergeDrivers(autoDrivers, manualDrivers);
}

export async function getDriver(http: AxiosInstance, driverId: string, storePath = DEFAULT_STORE_PATH): Promise<Driver | null> {
  const all = await listDrivers(http, storePath);
  return all.find((d) => d.id === driverId) || null;
}

export async function getDriverByPhone(http: AxiosInstance, phone: string, storePath = DEFAULT_STORE_PATH): Promise<Driver | null> {
  const all = await listDrivers(http, storePath);
  return all.find((d) => d.phone === phone || d.extension === phone) || null;
}

export function createDriver(driverData: CreateDriverInput, storePath = DEFAULT_STORE_PATH): Driver {
  const store = readStore(storePath);
  const drivers = store.drivers || [];

  const newDriver: Driver = {
    id: driverData.id || `DRV-${Date.now()}`,
    name: driverData.name,
    phone: driverData.phone || null,
    extension: driverData.extension,
    threecxUserId: driverData.threecxUserId || null,
    email: driverData.email || null,
    active: driverData.active !== false,
    source: "manual",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (drivers.some((d: any) => d.extension === newDriver.extension)) {
    throw new Error(`Un chauffeur avec l'extension ${newDriver.extension} existe deja.`);
  }

  drivers.push(newDriver);
  store.drivers = drivers;
  writeStore(storePath, store);
  return newDriver;
}

export function updateDriver(driverId: string, updates: Partial<CreateDriverInput>, storePath = DEFAULT_STORE_PATH): Driver | null {
  const store = readStore(storePath);
  const drivers = store.drivers || [];
  const index = drivers.findIndex((d: any) => d.id === driverId);
  if (index === -1) return null;

  if (updates.extension && updates.extension !== drivers[index].extension) {
    if (drivers.some((d: any) => d.extension === updates.extension)) {
      throw new Error(`Un chauffeur avec l'extension ${updates.extension} existe deja.`);
    }
  }

  drivers[index] = {
    ...drivers[index],
    ...updates,
    id: driverId,
    updatedAt: new Date().toISOString(),
  };

  store.drivers = drivers;
  writeStore(storePath, store);
  return drivers[index];
}

export function deleteDriver(driverId: string, storePath = DEFAULT_STORE_PATH): boolean {
  const store = readStore(storePath);
  const drivers = store.drivers || [];
  const index = drivers.findIndex((d: any) => d.id === driverId);
  if (index === -1) return false;

  drivers.splice(index, 1);
  store.drivers = drivers;
  writeStore(storePath, store);
  return true;
}

// ─── Dossier chauffeur ──────────────────────────────────────────

export async function getDriverDossier(
  http: AxiosInstance,
  driverId: string,
  options: DriverDossierOptions = {},
  storePath = DEFAULT_STORE_PATH,
): Promise<DriverDossier> {
  const driver = await getDriver(http, driverId, storePath);
  if (!driver) throw new Error(`Chauffeur ${driverId} introuvable.`);

  const ext = driver.extension;
  const limit = options.limit || 20;
  const { startDate, endDate } = options;

  const [callsOut, callsIn, recordings] = await Promise.all([
    fetchCallHistory(http, { caller: ext, startDate, endDate, pageSize: limit }),
    fetchCallHistory(http, { callee: ext, startDate, endDate, pageSize: limit }),
    fetchRecordings(http, { extension: ext, startDate, endDate, pageSize: limit }),
  ]);

  const allCalls = [...callsOut, ...callsIn]
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, limit);

  const seen = new Set<string>();
  const uniqueCalls = allCalls.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  return {
    driver,
    calls: uniqueCalls,
    recordings,
    totalCalls: uniqueCalls.length,
    totalRecordings: recordings.length,
    generatedAt: new Date().toISOString(),
  };
}

export async function getDriverCommunicationsByPhone(
  http: AxiosInstance,
  phone: string,
  options: DriverDossierOptions = {},
  storePath = DEFAULT_STORE_PATH,
): Promise<DriverDossier> {
  const driver = await getDriverByPhone(http, phone, storePath);
  if (!driver) throw new Error(`Aucun chauffeur trouve avec le numero ${phone}.`);
  return getDriverDossier(http, driver.id, options, storePath);
}

export async function getDriverRecentCommunications(
  http: AxiosInstance,
  driverId: string,
  minutes = 60,
  storePath = DEFAULT_STORE_PATH,
): Promise<DriverDossier> {
  const now = new Date();
  const from = new Date(now.getTime() - minutes * 60 * 1000);

  return getDriverDossier(
    http,
    driverId,
    {
      startDate: from.toISOString().split("T")[0],
      endDate: now.toISOString().split("T")[0],
      limit: 100,
    },
    storePath,
  );
}

// ─── Helpers internes ───────────────────────────────────────────

function buildGetCallLogPath(options: { caller?: string; callee?: string; startDate?: string; endDate?: string }): string {
  const now = new Date();

  let periodFrom: string;
  let periodTo: string;

  if (options.startDate) {
    periodFrom = options.startDate.includes("T") ? options.startDate : `${options.startDate}T00:00:00Z`;
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    periodFrom = `${d.toISOString().split("T")[0]}T00:00:00Z`;
  }
  if (options.endDate) {
    periodTo = options.endDate.includes("T") ? options.endDate : `${options.endDate}T23:59:59Z`;
  } else {
    periodTo = now.toISOString();
  }

  return (
    `/xapi/v1/ReportCallLogData/Pbx.GetCallLogData(` +
    `periodFrom=${periodFrom}` +
    `,periodTo=${periodTo}` +
    `,sourceType=0` +
    `,sourceFilter='${options.caller || ""}'` +
    `,destinationType=0` +
    `,destinationFilter='${options.callee || ""}'` +
    `,callsType=0` +
    `,callTimeFilterType=0` +
    `,callTimeFilterFrom='0:00:0'` +
    `,callTimeFilterTo='0:00:0'` +
    `,hidePcalls=true` +
    `)`
  );
}

async function fetchCallHistory(http: AxiosInstance, options: any): Promise<any[]> {
  const callPath = buildGetCallLogPath(options);
  const params = {
    $top: options.pageSize || 50,
    $skip: 0,
    $orderby: "StartTime desc",
  };

  try {
    const { data } = await http.get(callPath, { params, timeout: 60000 });
    return (data.value || []).map(normalizeCallRecord);
  } catch {
    return [];
  }
}

function normalizeRecordingLocal(raw: any): any {
  return {
    id: raw.Id?.toString() || "",
    startTime: raw.StartTime || "",
    endTime: raw.EndTime || "",
    caller: raw.FromCallerNumber || raw.FromDisplayName || "",
    callerName: raw.FromDisplayName || "",
    callee: raw.ToCallerNumber || raw.ToDisplayName || "",
    calleeName: raw.ToDisplayName || "",
    isTranscribed: raw.IsTranscribed ?? false,
    transcription: raw.Transcription || "",
    summary: raw.Summary || "",
    sentimentScore: raw.SentimentScore ?? 0,
  };
}

async function fetchRecordings(http: AxiosInstance, options: any): Promise<any[]> {
  const params: Record<string, any> = {
    $top: options.pageSize || 50,
    $skip: 0,
    $orderby: "StartTime desc",
    $count: true,
  };

  const filters: string[] = [];
  if (options.startDate) {
    const d = options.startDate.includes("T") ? options.startDate : `${options.startDate}T00:00:00Z`;
    filters.push(`StartTime ge ${d}`);
  }
  if (options.endDate) {
    const d = options.endDate.includes("T") ? options.endDate : `${options.endDate}T23:59:59Z`;
    filters.push(`StartTime le ${d}`);
  }
  if (options.extension) {
    filters.push(`(contains(FromCallerNumber,'${options.extension}') or contains(ToCallerNumber,'${options.extension}'))`);
  }
  if (filters.length) {
    params.$filter = filters.join(" and ");
  }

  try {
    const { data } = await http.get("/xapi/v1/Recordings", { params });
    return (data.value || []).map(normalizeRecordingLocal);
  } catch {
    return [];
  }
}
