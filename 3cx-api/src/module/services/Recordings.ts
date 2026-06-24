import type { AxiosInstance } from "axios";

export interface RecordingsOptions {
  startDate?: string;
  endDate?: string;
  caller?: string;
  callee?: string;
  phone?: string;
  transcribed?: string;
  page?: number;
  pageSize?: number;
}

export interface NormalizedRecording {
  id: string;
  callId: string;
  startTime: string;
  date: string;
  endTime: string;
  caller: string;
  callerName: string;
  callee: string;
  calleeName: string;
  duration: number;
  isTranscribed: boolean;
  transcription: string;
  summary: string;
  sentimentScore: number;
  recordingUrl: string;
  isArchived: boolean;
}

export async function getRecordings(
  http: AxiosInstance,
  options: RecordingsOptions = {},
): Promise<{ list: NormalizedRecording[]; totalCount: number }> {
  const params: Record<string, any> = {
    $top: options.pageSize || 50,
    $skip: Math.max((options.page || 1) - 1, 0) * (options.pageSize || 50),
    $count: true,
    $orderby: "StartTime desc",
  };

  // Only date filters are sent as OData $filter — caller/callee/phone/transcribed
  // filtering is handled client-side because the 3CX OData API does not reliably
  // support contains() on these fields.
  const filters: string[] = [];
  if (options.startDate) {
    filters.push(`StartTime ge ${formatDateTimeBoundary(options.startDate, "start")}`);
  }
  if (options.endDate) {
    filters.push(`StartTime le ${formatDateTimeBoundary(options.endDate, "end")}`);
  }
  if (filters.length) {
    params.$filter = filters.join(" and ");
  }

  const { data } = await http.get("/xapi/v1/Recordings", { params });

  const list = (data.value || []).map(normalizeRecording);

  return {
    list,
    totalCount: data["@odata.count"] ?? list.length,
  };
}

export async function downloadRecording(
  http: AxiosInstance,
  recordingId: string,
): Promise<{ stream: NodeJS.ReadableStream; contentType: string }> {
  if (!recordingId) throw new Error("recordingId est requis.");

  const { data, headers } = await http.get(
    `/xapi/v1/Recordings/Pbx.DownloadRecording(recId=${recordingId})`,
    { responseType: "stream" },
  );

  return {
    stream: data,
    contentType: String(headers["content-type"] || "audio/wav"),
  };
}

function normalizeRecording(raw: any): NormalizedRecording {
  const startTime = raw.StartTime || raw.RecordingStartTime || raw.CreatedAt || raw.Date || raw.CreationTime || "";
  const endTime = raw.EndTime || raw.RecordingEndTime || "";
  const explicitDuration = parseDuration(
    raw.Duration ?? raw.RecordingDuration ?? raw.CallDuration ?? raw.TalkingDuration ?? raw.CallTime ?? raw.TalkingTime,
  );
  // Compute from StartTime/EndTime when no explicit duration field exists
  const duration = explicitDuration || computeDurationFromDates(startTime, endTime);

  return {
    id: raw.Id?.toString() || raw.RecordingId?.toString() || raw.RecId?.toString() || "",
    callId: raw.CallId?.toString() || raw.HistoryId?.toString() || "",
    startTime,
    date: startTime,
    endTime,
    caller: raw.FromCallerNumber || raw.FromCallerId || raw.FromDisplayName || raw.SourceCallerId || "",
    callerName: raw.FromDisplayName || raw.SourceDisplayName || raw.FromCallerId || "",
    callee: raw.ToCallerNumber || raw.ToCallerId || raw.ToDisplayName || raw.DestinationCallerId || "",
    calleeName: raw.ToDisplayName || raw.DestinationDisplayName || raw.ToCallerId || "",
    duration,
    isTranscribed: raw.IsTranscribed ?? Boolean(raw.Transcription),
    transcription: raw.Transcription || "",
    summary: raw.Summary || "",
    sentimentScore: raw.SentimentScore ?? 0,
    recordingUrl: raw.RecordingUrl || raw.Url || "",
    isArchived: raw.IsArchived ?? false,
  };
}

function escapeOData(value: string): string {
  return String(value).replace(/'/g, "''");
}

function parseDuration(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.max(0, Math.round(value));
  if (typeof value === "object") {
    return parseDuration(value.Duration ?? value.TotalSeconds ?? value.Seconds ?? value.Value);
  }
  const text = String(value).trim();
  if (!text || text === "P" || text === "PT") return 0;
  const iso = text.match(/^(-)?P(?:(\d+(?:\.\d+)?)D)?(?:T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (iso) {
    const seconds =
      parseFloat(iso[2] || "0") * 86400 +
      parseFloat(iso[3] || "0") * 3600 +
      parseFloat(iso[4] || "0") * 60 +
      parseFloat(iso[5] || "0");
    return Math.max(0, Math.round(iso[1] ? -seconds : seconds));
  }
  const time = text.match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (time) return parseInt(time[1] || "0") * 86400 + parseInt(time[2] || "0") * 3600 + parseInt(time[3] || "0") * 60 + parseInt(time[4] || "0");
  const numeric = Number(text);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function formatDateTimeBoundary(value: string, boundary: "start" | "end"): string {
  const text = String(value);
  if (text.includes("T")) return text;
  return `${text}${boundary === "start" ? "T00:00:00Z" : "T23:59:59Z"}`;
}

function computeDurationFromDates(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.max(0, Math.round((e - s) / 1000));
}

function addSecondsToDate(value: string, seconds: number): string {
  if (!value || !seconds) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + seconds * 1000).toISOString();
}
