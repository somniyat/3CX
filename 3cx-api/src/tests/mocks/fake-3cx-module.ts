/**
 * Implementation fake de I3CXModule pour les tests unitaires/d'integration.
 *
 * Chaque methode retourne des donnees statiques issues des fixtures.
 * On peut aussi configurer une methode pour throw afin de tester les cas d'erreur.
 */
import type { I3CXModule, PaginatedResponse, CallRecord, Recording } from "../../types/i3cx-module";
import * as fixtures from "./fixtures";

export class Fake3CXModule implements I3CXModule {
  /**
   * Map de methodes qui doivent throw au prochain appel.
   * Ex: fake.failOn("getCallHistory") => le prochain appel lance une erreur.
   */
  private _failures = new Map<string, Error>();

  /**
   * Si true, toutes les methodes retournent des listes vides (cas limite).
   */
  empty = false;

  failOn(method: keyof I3CXModule, error?: Error): void {
    this._failures.set(method, error ?? new Error(`Erreur simulee sur ${method}`));
  }

  clearFailures(): void {
    this._failures.clear();
  }

  private _throwIfFailing(method: string): void {
    const err = this._failures.get(method);
    if (err) {
      this._failures.delete(method);
      throw err;
    }
  }

  // ─── Call History ───────────────────────────────────────────────

  async getCallHistory(): Promise<PaginatedResponse<CallRecord>> {
    this._throwIfFailing("getCallHistory");
    const list = this.empty ? [] : fixtures.callRecords;
    return {
      data: list,
      total: list.length,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    };
  }

  async getAllCallHistory(): Promise<CallRecord[]> {
    this._throwIfFailing("getAllCallHistory");
    return this.empty ? [] : fixtures.callRecords;
  }

  async getActiveCalls() {
    this._throwIfFailing("getActiveCalls");
    return this.empty ? [] : fixtures.activeCalls;
  }

  // ─── Recordings ─────────────────────────────────────────────────

  async getRecordings(): Promise<PaginatedResponse<Recording>> {
    this._throwIfFailing("getRecordings");
    const list = this.empty ? [] : fixtures.recordings;
    return {
      data: list,
      total: list.length,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    };
  }

  async downloadRecording(_recordingId: string) {
    this._throwIfFailing("downloadRecording");
    return {
      stream: fixtures.createFakeAudioStream(),
      contentType: "audio/wav",
    };
  }

  // ─── Transcriptions ────────────────────────────────────────────

  async getTranscription(_recordingId: string) {
    this._throwIfFailing("getTranscription");
    if (this.empty) return { transcription: "", segments: [] };
    return fixtures.transcription;
  }

  async getTranscriptions() {
    this._throwIfFailing("getTranscriptions");
    const list = this.empty ? [] : fixtures.recordingsWithTranscription;
    return { list, totalCount: list.length };
  }

  // ─── System ─────────────────────────────────────────────────────

  async getSystemStatus() {
    this._throwIfFailing("getSystemStatus");
    return this.empty ? {} : fixtures.systemStatus;
  }

  async getExtensions() {
    this._throwIfFailing("getExtensions");
    return this.empty ? [] : fixtures.extensions;
  }
}
