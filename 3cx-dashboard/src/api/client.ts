const BASE_URL = import.meta.env.VITE_THREECX_BASE_URL || '';
const CLIENT_ID = import.meta.env.VITE_THREECX_CLIENT_ID || '';
const CLIENT_SECRET = import.meta.env.VITE_THREECX_CLIENT_SECRET || '';

function getCredentialHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (BASE_URL) headers['x-3cx-base-url'] = BASE_URL;
  if (CLIENT_ID) headers['x-3cx-client-id'] = CLIENT_ID;
  if (CLIENT_SECRET) headers['x-3cx-client-secret'] = CLIENT_SECRET;
  return headers;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getCredentialHeaders(),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Erreur ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

// ─── Calls ──────────────────────────────────────────────────

export function getCallHistory(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<PaginatedList<CallRecord>>(`/api/calls/history${qs}`);
}

export function getActiveCalls() {
  return request<{ data: ActiveCall[] }>('/api/calls/active').then((r) => r.data);
}

// ─── Recordings ─────────────────────────────────────────────

export function getRecordings(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<PaginatedList<Recording>>(`/api/recordings${qs}`);
}

export function getRecordingDownloadUrl(id: string) {
  return `/api/recordings/${id}/download`;
}

/**
 * Telecharge un enregistrement via fetch avec les headers d'auth,
 * puis declenche le telechargement cote navigateur.
 */
export async function downloadRecording(id: string, filename?: string): Promise<void> {
  const res = await fetch(getRecordingDownloadUrl(id), {
    headers: getCredentialHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur ${res.status}: ${res.statusText}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `recording-${id}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Cree une URL blob pour la lecture audio avec les headers d'auth.
 */
export async function getRecordingAudioUrl(id: string): Promise<string> {
  const res = await fetch(getRecordingDownloadUrl(id), {
    headers: getCredentialHeaders(),
  });
  if (!res.ok) throw new Error(`Erreur ${res.status}: ${res.statusText}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ─── Transcriptions ─────────────────────────────────────────

export function getTranscriptions(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<PaginatedList<Recording>>(`/api/transcriptions${qs}`);
}

export function getTranscription(id: string) {
  return request<Transcription>(`/api/transcriptions/${id}`);
}

// ─── System ─────────────────────────────────────────────────

export function getSystemStatus() {
  return request<Record<string, unknown>>('/api/system/status');
}

export function getExtensions() {
  return request<{ data: Extension[] }>('/api/system/extensions').then((r) => r.data);
}

// ─── Users ──────────────────────────────────────────────────

export function listUsers(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<UserListResult>(`/api/users${qs}`);
}

// ─── Chauffeurs ─────────────────────────────────────────

export function listDrivers() {
  return request<{ data: Driver[]; total: number }>('/api/drivers');
}

export function getDriverDetail(id: string) {
  return request<Driver>(`/api/drivers/${id}`);
}

export function getDriverByPhone(phone: string) {
  return request<Driver>(`/api/drivers/by-phone/${encodeURIComponent(phone)}`);
}

export function createDriver(data: CreateDriverInput) {
  return request<Driver>('/api/drivers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateDriver(id: string, data: Partial<CreateDriverInput>) {
  return request<Driver>(`/api/drivers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteDriverApi(id: string) {
  return request<{ success: boolean }>(`/api/drivers/${id}`, {
    method: 'DELETE',
  });
}

export function getDriverDossier(id: string, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<DriverDossier>(`/api/drivers/${id}/dossier${qs}`);
}

export function getDriverCommunicationsByPhone(phone: string, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<DriverDossier>(`/api/drivers/by-phone/${encodeURIComponent(phone)}/communications${qs}`);
}

export function getDriverRecentComms(id: string, minutes: number = 60) {
  return request<DriverDossier>(`/api/drivers/${id}/recent?minutes=${minutes}`);
}

// ─── Diagnostic ─────────────────────────────────────────────

export function getAccessAudit() {
  return request<AccessAuditResult>('/api/diagnostic/access-audit');
}

// ─── Types ──────────────────────────────────────────────────

export interface PaginatedList<T> {
  list: T[];
  totalCount: number;
  data?: T[];
  total?: number;
}

export interface CallRecord {
  id: string;
  caller: string;
  callee: string;
  callerName?: string;
  calleeName?: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  driver?: Driver | null;
  recording?: Recording | null;
  recordingId?: string | null;
  transcript?: Transcription | null;
  [key: string]: unknown;
}

export interface ActiveCall {
  id?: string;
  caller?: string;
  callee?: string;
  status?: string;
  establishedAt?: string;
  [key: string]: unknown;
}

export interface Recording {
  id: string;
  startTime?: string;
  endTime?: string;
  caller?: string;
  callee?: string;
  callerName?: string;
  calleeName?: string;
  duration?: number;
  isTranscribed?: boolean;
  transcription?: string;
  summary?: string;
  sentimentScore?: number;
  [key: string]: unknown;
}

export interface TranscriptionSegment {
  speaker?: string;
  text: string;
  startTime?: number;
  endTime?: number;
}

export interface Transcription {
  id?: string;
  transcription: string;
  summary?: string;
  sentimentScore?: number;
  isTranscribed?: boolean;
  segments: TranscriptionSegment[];
}

export interface Extension {
  id: string;
  number: string;
  name: string;
  status: string;
  [key: string]: unknown;
}

export interface AppUser {
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

export interface UserListResult {
  items: AppUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Chauffeurs Types ────────────────────────────────────

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  extension: string;
  threecxUserId: string | null;
  email: string | null;
  active: boolean;
  source: 'auto' | 'manual';
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

export interface DriverDossier {
  driver: Driver;
  calls: CallRecord[];
  recordings: Recording[];
  totalCalls: number;
  totalRecordings: number;
  generatedAt: string;
}

export interface AccessAuditResult {
  tokenInfo: {
    clientId: string;
    maxRole: string;
    roleClaims: string[];
    issuedAt: string;
    expiresAt: string;
    issuer: string;
  };
  audit: Array<{
    endpoint: string;
    description: string;
    critical: boolean;
    httpCode: number;
    accessible: boolean;
    responseTimeMs: number;
    errorBody: string | null;
  }>;
  summary: {
    total: number;
    accessible: number;
    forbidden: number;
    badRequest: number;
    other: number;
  };
  generatedAt: string;
}
