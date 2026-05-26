import { describe, it, expect, beforeEach } from "vitest";
import { createTestContext, authHeader } from "../helpers";
import * as fixtures from "../mocks/fixtures";

describe("GET /api/recordings", () => {
  const ctx = createTestContext();

  beforeEach(() => {
    ctx.fake.clearFailures();
    ctx.fake.empty = false;
  });

  it("200 — retourne la liste des enregistrements", async () => {
    const res = await ctx.request.get("/api/recordings").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(fixtures.recordings.length);
    expect(res.body.data[0]).toMatchObject({ id: "rec-001" });
  });

  it("200 — liste vide", async () => {
    ctx.fake.empty = true;
    const res = await ctx.request.get("/api/recordings").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("401 — sans header x-api-key", async () => {
    const res = await ctx.request.get("/api/recordings");
    expect(res.status).toBe(401);
  });

  it("401 — cle invalide", async () => {
    const res = await ctx.request.get("/api/recordings").set({ "x-api-key": "bad" });
    expect(res.status).toBe(401);
  });

  it("500 — erreur module", async () => {
    ctx.fake.failOn("getRecordings");
    const res = await ctx.request.get("/api/recordings").set(authHeader());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/recordings/:id/download", () => {
  const ctx = createTestContext();

  beforeEach(() => {
    ctx.fake.clearFailures();
    ctx.fake.empty = false;
  });

  it("200 — telecharge un enregistrement (stream)", async () => {
    const res = await ctx.request
      .get("/api/recordings/rec-001/download")
      .set(authHeader())
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("audio");
    expect(res.headers["content-disposition"]).toContain("rec-001");
    expect(res.body.toString()).toBe("fake-audio-content");
  });

  it("401 — sans authentification", async () => {
    const res = await ctx.request.get("/api/recordings/rec-001/download");
    expect(res.status).toBe(401);
  });

  it("500 — erreur module", async () => {
    ctx.fake.failOn("downloadRecording");
    const res = await ctx.request.get("/api/recordings/rec-001/download").set(authHeader());
    expect(res.status).toBe(500);
  });
});
