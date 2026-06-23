import type { AxiosInstance } from "axios";

export interface ExtensionInfo {
  id: string;
  number: string;
  name: string;
  email: string;
  status: string;
}

export interface SystemStatusInfo {
  fqdn: string;
  version: string;
  activated: boolean;
  extensionsRegistered: number;
  extensionsTotal: number;
  trunksRegistered: number;
  trunksTotal: number;
  callsActive: number;
  maxSimCalls: number;
  ip: string;
  diskUsage: number;
  freeDiskSpace: number;
  totalDiskSpace: number;
  maintenanceExpiresAt: string;
}

export interface ActiveCallInfo {
  id: string;
  caller: string;
  callee: string;
  status: string;
  establishedAt: string;
  lastChangeStatus: string;
}

export interface AppUserInfo {
  id: number;
  extension: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string | null;
  mobile: string | null;
  enabled: boolean;
  internal: boolean;
}

export interface ListUsersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  enabledOnly?: boolean;
}

export async function getExtensions(http: AxiosInstance): Promise<ExtensionInfo[]> {
  const { data } = await http.get("/xapi/v1/Users", {
    params: { $select: "Id,Number,FirstName,LastName,EmailAddress", $count: true },
  });

  return (data.value || []).map((u: any) => ({
    id: u.Id?.toString() || "",
    number: u.Number || "",
    name: [u.FirstName, u.LastName].filter(Boolean).join(" ") || u.Number || "",
    email: u.EmailAddress || "",
    status: "unknown",
  }));
}

export async function getSystemStatus(http: AxiosInstance): Promise<SystemStatusInfo> {
  const { data } = await http.get("/xapi/v1/SystemStatus");

  return {
    fqdn: data.FQDN || "",
    version: data.Version || "",
    activated: data.Activated ?? false,
    extensionsRegistered: data.ExtensionsRegistered ?? 0,
    extensionsTotal: data.ExtensionsTotal ?? 0,
    trunksRegistered: data.TrunksRegistered ?? 0,
    trunksTotal: data.TrunksTotal ?? 0,
    callsActive: data.CallsActive ?? 0,
    maxSimCalls: data.MaxSimCalls ?? 0,
    ip: data.Ip || "",
    diskUsage: data.DiskUsage ?? 0,
    freeDiskSpace: data.FreeDiskSpace ?? 0,
    totalDiskSpace: data.TotalDiskSpace ?? 0,
    maintenanceExpiresAt: data.MaintenanceExpiresAt || "",
  };
}

export async function getActiveCalls(http: AxiosInstance): Promise<ActiveCallInfo[]> {
  const { data } = await http.get("/xapi/v1/ActiveCalls", {
    params: { $count: true, $orderby: "EstablishedAt desc" },
  });

  return (data.value || []).map((c: any) => ({
    id: c.Id?.toString() || "",
    caller: c.Caller || "",
    callee: c.Callee || "",
    status: c.Status || "",
    establishedAt: c.EstablishedAt || "",
    lastChangeStatus: c.LastChangeStatus || "",
  }));
}

export async function listUsers(
  http: AxiosInstance,
  options: ListUsersOptions = {},
): Promise<{ items: AppUserInfo[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(200, Math.max(1, options.pageSize || 50));

  const params: Record<string, any> = {
    $select: "Id,Number,FirstName,LastName,EmailAddress,Mobile,Enabled,Internal",
    $orderby: "Number",
    $top: pageSize,
    $skip: (page - 1) * pageSize,
    $count: true,
  };

  const filters: string[] = [];

  if (options.enabledOnly) {
    filters.push("Enabled eq true");
  }

  if (options.search?.trim()) {
    const q = options.search.trim().replace(/'/g, "''");
    filters.push(
      `(contains(FirstName,'${q}') or contains(LastName,'${q}') or startswith(Number,'${q}') or contains(EmailAddress,'${q}'))`,
    );
  }

  if (filters.length) {
    params.$filter = filters.join(" and ");
  }

  const { data } = await http.get("/xapi/v1/Users", { params });

  const total = data["@odata.count"] ?? 0;
  const items = (data.value || []).map(normalizeUser);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

function normalizeUser(raw: any): AppUserInfo {
  return {
    id: raw.Id ?? 0,
    extension: raw.Number || "",
    fullName: [raw.FirstName, raw.LastName].filter(Boolean).join(" ").trim(),
    firstName: raw.FirstName || "",
    lastName: raw.LastName || "",
    email: raw.EmailAddress || null,
    mobile: raw.Mobile || null,
    enabled: raw.Enabled ?? true,
    internal: raw.Internal ?? true,
  };
}
