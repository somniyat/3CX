/**
 * Interface decrivant le contrat du module 3CX tel qu'utilise par les routes.
 *
 * Decouple les routes de l'implementation concrete (`@omniyat/3cx-module`)
 * pour permettre l'injection d'un Fake en test sans toucher au module reel.
 */
export interface I3CXModule {
  getCallHistory(options?: CallHistoryOptions): Promise<PaginatedResponse<CallRecord>>;
  getAllCallHistory(options?: Omit<CallHistoryOptions, "page" | "pageSize">): Promise<CallRecord[]>;
  getActiveCalls(): Promise<ActiveCall[]>;
  getRecordings(options?: RecordingsOptions): Promise<PaginatedResponse<Recording>>;
  downloadRecording(recordingId: string): Promise<DownloadResult>;
  getTranscription(recordingId: string): Promise<Transcription>;
  getTranscriptions(options?: TranscriptionsOptions): Promise<{ list: Recording[]; totalCount: number }>;
  getSystemStatus(): Promise<SystemStatus>;
  getExtensions(): Promise<Extension[]>;
  listUsers(options?: ListUsersOptions): Promise<UserListResult>;
  runAccessAudit(): Promise<AccessAuditResult>;

  // ─── Chauffeurs (Controle Qualite) ─────────────────────────
  listDrivers(): Promise<Driver[]>;
  getDriver(driverId: string): Promise<Driver | null>;
  getDriverByPhone(phone: string): Promise<Driver | null>;
  createDriver(driverData: CreateDriverInput): Driver;
  updateDriver(driverId: string, updates: Partial<CreateDriverInput>): Driver | null;
  deleteDriver(driverId: string): boolean;
  getDriverDossier(driverId: string, options?: DriverDossierOptions): Promise<DriverDossier>;
  getDriverCommunicationsByPhone(phone: string, options?: DriverDossierOptions): Promise<DriverDossier>;
  getDriverRecentCommunications(driverId: string, minutes?: number): Promise<DriverDossier>;
}

// ─── Types utilises par l'interface ───────────────────────────────────

export interface CallHistoryOptions {
  startDate?: string;
  endDate?: string;
  caller?: string;
  callee?: string;
  phone?: string;
  driverId?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface RecordingsOptions {
  startDate?: string;
  endDate?: string;
  caller?: string;
  callee?: string;
  phone?: string;
  transcribed?: "true" | "false";
  page?: number;
  pageSize?: number;
}

export interface TranscriptionsOptions {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CallRecord {
  id: string;
  caller: string;
  callee: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  [key: string]: unknown;
}

export interface ActiveCall {
  [key: string]: unknown;
}

export interface Recording {
  id: string;
  [key: string]: unknown;
}

export interface Extension {
  id: string;
  number: string;
  name: string;
  status: string;
  [key: string]: unknown;
}

export interface SystemStatus {
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

export interface DownloadResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
}

export interface ListUsersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  enabledOnly?: boolean;
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

// ─── Chauffeurs ──────────────────────────────────────────────

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

export interface DriverDossierOptions {
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface DriverDossier {
  driver: Driver;
  calls: CallRecord[];
  recordings: Array<{ [key: string]: unknown }>;
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
