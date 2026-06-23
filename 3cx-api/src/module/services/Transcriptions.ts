import type { AxiosInstance } from "axios";

export interface TranscriptionResult {
  id: string;
  transcription: string;
  summary: string;
  sentimentScore: number;
  isTranscribed: boolean;
  segments: Array<{ speaker: string; text: string }>;
}

export interface TranscriptionsOptions {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export async function getTranscription(
  http: AxiosInstance,
  recordingId: string,
): Promise<TranscriptionResult> {
  if (!recordingId) throw new Error("recordingId est requis.");

  const { data } = await http.get(`/xapi/v1/Recordings(${recordingId})`, {
    params: { $select: "Id,Transcription,Summary,SentimentScore,IsTranscribed" },
  });

  return {
    id: data.Id?.toString() || recordingId,
    transcription: data.Transcription || "",
    summary: data.Summary || "",
    sentimentScore: data.SentimentScore ?? 0,
    isTranscribed: data.IsTranscribed ?? false,
    segments: parseTranscriptionSegments(data.Transcription),
  };
}

export async function getTranscriptions(
  http: AxiosInstance,
  options: TranscriptionsOptions = {},
): Promise<{ list: any[]; totalCount: number }> {
  const params: Record<string, any> = {
    $top: options.pageSize || 50,
    $skip: (options.page || 0) * (options.pageSize || 50),
    $count: true,
    $orderby: "StartTime desc",
    $filter: "IsTranscribed eq true",
  };

  if (options.startDate || options.endDate) {
    const filters = ["IsTranscribed eq true"];
    if (options.startDate) {
      filters.push(`StartTime ge ${options.startDate}T00:00:00Z`);
    }
    if (options.endDate) {
      filters.push(`StartTime le ${options.endDate}T23:59:59Z`);
    }
    params.$filter = filters.join(" and ");
  }

  const { data } = await http.get("/xapi/v1/Recordings", { params });

  const list = (data.value || []).map((raw: any) => ({
    id: raw.Id?.toString() || "",
    startTime: raw.StartTime || "",
    endTime: raw.EndTime || "",
    caller: raw.FromCallerNumber || raw.FromDisplayName || "",
    callee: raw.ToCallerNumber || raw.ToDisplayName || "",
    isTranscribed: raw.IsTranscribed ?? false,
    transcription: raw.Transcription || "",
    summary: raw.Summary || "",
  }));

  return {
    list,
    totalCount: data["@odata.count"] ?? list.length,
  };
}

function parseTranscriptionSegments(text: string | null | undefined): Array<{ speaker: string; text: string }> {
  if (!text) return [];

  const lines = text.split("\n").filter(Boolean);
  return lines.map((line) => {
    const match = line.match(/^(.+?):\s*(.+)$/);
    if (match) {
      return { speaker: match[1].trim(), text: match[2].trim() };
    }
    return { speaker: "", text: line.trim() };
  });
}
