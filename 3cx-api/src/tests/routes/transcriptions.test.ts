import { describe, it, expect, beforeEach } from "vitest";
import { createTestContext, authHeader } from "../helpers";
import * as fixtures from "../mocks/fixtures";

describe("GET /api/transcriptions", () => {
  const ctx = createTestContext();

  beforeEach(() => {
    ctx.fake.clearFailures();
    ctx.fake.empty = false;
  });

  it("200 — retourne les enregistrements avec transcription", async () => {
    const res = await ctx.request.get("/api/transcriptions").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.list).toHaveLength(fixtures.recordingsWithTranscription.length);
    expect(res.body.totalCount).toBe(fixtures.recordingsWithTranscription.length);
  });

  it("200 — liste vide", async () => {
    ctx.fake.empty = true;
    const res = await ctx.request.get("/api/transcriptions").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.list).toHaveLength(0);
    expect(res.body.totalCount).toBe(0);
  });

  it("401 — sans header x-api-key", async () => {
    const res = await ctx.request.get("/api/transcriptions");
    expect(res.status).toBe(401);
  });

  it("401 — cle invalide", async () => {
    const res = await ctx.request.get("/api/transcriptions").set({ "x-api-key": "nope" });
    expect(res.status).toBe(401);
  });

  it("500 — erreur module", async () => {
    ctx.fake.failOn("getTranscriptions");
    const res = await ctx.request.get("/api/transcriptions").set(authHeader());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/transcriptions/:id", () => {
  const ctx = createTestContext();

  beforeEach(() => {
    ctx.fake.clearFailures();
    ctx.fake.empty = false;
  });

  it("200 — retourne la transcription complete", async () => {
    const res = await ctx.request.get("/api/transcriptions/rec-001").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.transcription).toContain("Bonjour");
    expect(res.body.segments).toHaveLength(3);
    expect(res.body.segments[0]).toMatchObject({
      speaker: "Agent",
      text: expect.stringContaining("dossier"),
    });
    expect(res.body.segments[0].startTime).toBe(0);
    expect(res.body.segments[0].endTime).toBe(4.2);
  });

  it("200 — transcription vide (cas limite)", async () => {
    ctx.fake.empty = true;
    const res = await ctx.request.get("/api/transcriptions/rec-xxx").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.transcription).toBe("");
    expect(res.body.segments).toHaveLength(0);
  });

  it("401 — sans authentification", async () => {
    const res = await ctx.request.get("/api/transcriptions/rec-001");
    expect(res.status).toBe(401);
  });

  it("500 — erreur module", async () => {
    ctx.fake.failOn("getTranscription");
    const res = await ctx.request.get("/api/transcriptions/rec-001").set(authHeader());
    expect(res.status).toBe(500);
  });
});
