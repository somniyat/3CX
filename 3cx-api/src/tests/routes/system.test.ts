import { describe, it, expect, beforeEach } from "vitest";
import { createTestContext, authHeader } from "../helpers";
import * as fixtures from "../mocks/fixtures";

describe("GET /api/system/status", () => {
  const ctx = createTestContext();

  beforeEach(() => {
    ctx.fake.clearFailures();
    ctx.fake.empty = false;
  });

  it("200 — retourne le statut systeme", async () => {
    const res = await ctx.request.get("/api/system/status").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      Fqdn: "omniyat.3cx.fr",
      Version: "20.0.3.806",
      Activated: true,
    });
  });

  it("200 — statut vide", async () => {
    ctx.fake.empty = true;
    const res = await ctx.request.get("/api/system/status").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it("401 — sans authentification", async () => {
    const res = await ctx.request.get("/api/system/status");
    expect(res.status).toBe(401);
  });

  it("500 — erreur module", async () => {
    ctx.fake.failOn("getSystemStatus");
    const res = await ctx.request.get("/api/system/status").set(authHeader());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/system/extensions", () => {
  const ctx = createTestContext();

  beforeEach(() => {
    ctx.fake.clearFailures();
    ctx.fake.empty = false;
  });

  it("200 — retourne la liste des extensions", async () => {
    const res = await ctx.request.get("/api/system/extensions").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(fixtures.extensions.length);
    expect(res.body.data[0]).toMatchObject({
      number: "101",
      name: "Alice Martin",
      status: "Available",
    });
  });

  it("200 — aucune extension", async () => {
    ctx.fake.empty = true;
    const res = await ctx.request.get("/api/system/extensions").set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("401 — sans authentification", async () => {
    const res = await ctx.request.get("/api/system/extensions");
    expect(res.status).toBe(401);
  });

  it("401 — cle invalide", async () => {
    const res = await ctx.request.get("/api/system/extensions").set({ "x-api-key": "wrong-key" });
    expect(res.status).toBe(401);
  });

  it("500 — erreur module", async () => {
    ctx.fake.failOn("getExtensions");
    const res = await ctx.request.get("/api/system/extensions").set(authHeader());
    expect(res.status).toBe(500);
  });
});
