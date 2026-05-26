import { describe, it, expect, beforeEach } from "vitest";
import { createTestContext, authHeader } from "../helpers";
import * as fixtures from "../mocks/fixtures";

describe("GET /api/calls/history", () => {
  const ctx = createTestContext();

  beforeEach(() => {
    ctx.fake.clearFailures();
    ctx.fake.empty = false;
  });

  it("200 — retourne l'historique des appels", async () => {
    const res = await ctx.request.get("/api/calls/history").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(fixtures.callRecords.length);
    expect(res.body.data[0]).toMatchObject({ id: "c-001", caller: "101" });
    expect(res.body.total).toBe(fixtures.callRecords.length);
  });

  it("200 — retourne une liste vide", async () => {
    ctx.fake.empty = true;
    const res = await ctx.request.get("/api/calls/history").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("401 — sans header x-api-key", async () => {
    const res = await ctx.request.get("/api/calls/history");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Clé API/);
  });

  it("401 — avec une cle invalide", async () => {
    const res = await ctx.request.get("/api/calls/history").set({ "x-api-key": "wrong" });
    expect(res.status).toBe(401);
  });

  it("500 — si le module 3CX echoue", async () => {
    ctx.fake.failOn("getCallHistory");
    const res = await ctx.request.get("/api/calls/history").set(authHeader());
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Erreur interne/);
  });
});

describe("GET /api/calls/history/all", () => {
  const ctx = createTestContext();

  beforeEach(() => {
    ctx.fake.clearFailures();
    ctx.fake.empty = false;
  });

  it("200 — retourne tout l'historique", async () => {
    const res = await ctx.request.get("/api/calls/history/all").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(fixtures.callRecords.length);
    expect(res.body.total).toBe(fixtures.callRecords.length);
  });

  it("200 — liste vide", async () => {
    ctx.fake.empty = true;
    const res = await ctx.request.get("/api/calls/history/all").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("401 — sans authentification", async () => {
    const res = await ctx.request.get("/api/calls/history/all");
    expect(res.status).toBe(401);
  });

  it("500 — erreur module", async () => {
    ctx.fake.failOn("getAllCallHistory");
    const res = await ctx.request.get("/api/calls/history/all").set(authHeader());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/calls/active", () => {
  const ctx = createTestContext();

  beforeEach(() => {
    ctx.fake.clearFailures();
    ctx.fake.empty = false;
  });

  it("200 — retourne les appels actifs", async () => {
    const res = await ctx.request.get("/api/calls/active").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(fixtures.activeCalls.length);
    expect(res.body.data[0]).toMatchObject({ caller: "101", status: "Connected" });
  });

  it("200 — aucun appel actif", async () => {
    ctx.fake.empty = true;
    const res = await ctx.request.get("/api/calls/active").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("401 — sans authentification", async () => {
    const res = await ctx.request.get("/api/calls/active");
    expect(res.status).toBe(401);
  });

  it("500 — erreur module", async () => {
    ctx.fake.failOn("getActiveCalls");
    const res = await ctx.request.get("/api/calls/active").set(authHeader());
    expect(res.status).toBe(500);
  });
});
