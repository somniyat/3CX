/**
 * Donnees statiques realistes qui imitent les reponses de l'API 3CX.
 * Utilisees a la fois par le Fake module et les handlers mock HTTP.
 */
import { Readable } from "stream";
import type {
  CallRecord,
  ActiveCall,
  Recording,
  Extension,
  SystemStatus,
  Transcription,
} from "../../types/i3cx-module";

// ─── Call History ────────────────────────────────────────────────────

export const callRecords: CallRecord[] = [
  {
    id: "c-001",
    caller: "101",
    callee: "201",
    startTime: "2026-04-18T09:12:00Z",
    endTime: "2026-04-18T09:18:30Z",
    duration: 390,
    status: "answered",
    direction: "outbound",
  },
  {
    id: "c-002",
    caller: "202",
    callee: "101",
    startTime: "2026-04-18T10:00:00Z",
    endTime: "2026-04-18T10:02:15Z",
    duration: 135,
    status: "answered",
    direction: "inbound",
  },
  {
    id: "c-003",
    caller: "301",
    callee: "101",
    startTime: "2026-04-18T11:30:00Z",
    endTime: "2026-04-18T11:30:00Z",
    duration: 0,
    status: "missed",
    direction: "inbound",
  },
];

// ─── Active Calls ───────────────────────────────────────────────────

export const activeCalls: ActiveCall[] = [
  { id: "ac-001", caller: "101", callee: "202", status: "Connected", duration: 45 },
  { id: "ac-002", caller: "303", callee: "101", status: "Ringing", duration: 0 },
];

// ─── Recordings ─────────────────────────────────────────────────────

export const recordings: Recording[] = [
  {
    id: "rec-001",
    callId: "c-001",
    caller: "101",
    callee: "201",
    date: "2026-04-18T09:12:00Z",
    duration: 390,
    size: 624000,
  },
  {
    id: "rec-002",
    callId: "c-002",
    caller: "202",
    callee: "101",
    date: "2026-04-18T10:00:00Z",
    duration: 135,
    size: 216000,
  },
];

/**
 * Cree un ReadableStream factice simulant un fichier audio.
 */
export function createFakeAudioStream(): Readable {
  const stream = new Readable({ read() {} });
  stream.push(Buffer.from("fake-audio-content"));
  stream.push(null);
  return stream;
}

// ─── Transcriptions ─────────────────────────────────────────────────

export const transcription: Transcription = {
  transcription:
    "Bonjour, je vous appelle au sujet de votre dossier. " +
    "D'accord, je vous ecoute. " +
    "Votre demande a ete validee, vous recevrez un mail de confirmation.",
  segments: [
    { speaker: "Agent", text: "Bonjour, je vous appelle au sujet de votre dossier.", startTime: 0, endTime: 4.2 },
    { speaker: "Client", text: "D'accord, je vous ecoute.", startTime: 4.5, endTime: 6.1 },
    {
      speaker: "Agent",
      text: "Votre demande a ete validee, vous recevrez un mail de confirmation.",
      startTime: 6.5,
      endTime: 11.8,
    },
  ],
};

export const recordingsWithTranscription: Recording[] = [recordings[0]];

// ─── Extensions ─────────────────────────────────────────────────────

export const extensions: Extension[] = [
  { id: "ext-101", number: "101", name: "Alice Martin", status: "Available" },
  { id: "ext-102", number: "102", name: "Bob Dupont", status: "Busy" },
  { id: "ext-103", number: "103", name: "Claire Leroy", status: "Away" },
  { id: "ext-104", number: "104", name: "David Moreau", status: "Offline" },
];

// ─── System Status ──────────────────────────────────────────────────

export const systemStatus: SystemStatus = {
  Fqdn: "omniyat.3cx.fr",
  Version: "20.0.3.806",
  Activated: true,
  MaxSimCalls: 32,
  CurrentCalls: 2,
  ExtensionsRegistered: 24,
  TrunksRegistered: 2,
  HasNotRunningServices: false,
  Ip: "192.168.1.100",
};
