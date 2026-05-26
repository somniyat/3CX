declare module "@omniyat/3cx-module" {
  interface InitOptions {
    baseUrl?: string;
    clientId?: string;
    clientSecret?: string;
    timeout?: number;
  }

  interface CallHistoryOptions {
    startDate?: string;
    endDate?: string;
    caller?: string;
    callee?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }

  interface RecordingsOptions {
    startDate?: string;
    endDate?: string;
    caller?: string;
    callee?: string;
    page?: number;
    pageSize?: number;
  }

  interface CallRecord {
    id: string;
    caller: string;
    callee: string;
    startTime: string;
    endTime: string;
    duration: number;
    status: string;
    [key: string]: unknown;
  }

  interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }

  interface Extension {
    id: string;
    number: string;
    name: string;
    status: string;
    [key: string]: unknown;
  }

  interface SystemStatus {
    [key: string]: unknown;
  }

  interface ActiveCall {
    [key: string]: unknown;
  }

  interface Recording {
    id: string;
    [key: string]: unknown;
  }

  interface TranscriptionSegment {
    speaker?: string;
    text: string;
    startTime?: number;
    endTime?: number;
    [key: string]: unknown;
  }

  interface Transcription {
    transcription: string;
    segments: TranscriptionSegment[];
  }

  interface TranscriptionsOptions {
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }

  interface ThreeCXModule {
    init(options?: InitOptions): ThreeCXModule;
    getCallHistory(options?: CallHistoryOptions): Promise<{ list: CallRecord[]; totalCount: number }>;
    getAllCallHistory(options?: Omit<CallHistoryOptions, "page" | "pageSize">): Promise<CallRecord[]>;
    getRecordings(options?: RecordingsOptions): Promise<{ list: Recording[]; totalCount: number }>;
    downloadRecording(recordingId: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string }>;
    getTranscription(recordingId: string): Promise<Transcription>;
    getTranscriptions(options?: TranscriptionsOptions): Promise<{ list: Recording[]; totalCount: number }>;
    getExtensions(): Promise<Extension[]>;
    getSystemStatus(): Promise<SystemStatus>;
    getActiveCalls(): Promise<ActiveCall[]>;
  }

  const module: ThreeCXModule;
  export = module;
}
