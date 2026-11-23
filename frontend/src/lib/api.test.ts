import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

const reply = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status, statusText: "X" }));

afterEach(() => vi.restoreAllMocks());

describe("client de l'API", () => {
  it("remonte le message français du backend", async () => {
    reply(409, { detail: "Expérience terminée et immuable : dupliquez-la pour la relancer." });
    await expect(api.run("x")).rejects.toThrow("immuable");
  });
  it("assemble les erreurs de validation (422)", async () => {
    reply(422, { detail: { errors: ["Budget négatif.", "Répétitions hors plage."] } });
    await expect(api.create({ name: "x", config: {} as never })).rejects.toThrow("Budget négatif. · Répétitions hors plage.");
  });
  it("envoie la configuration telle quelle au moteur", async () => {
    const spy = reply(200, { ok: true });
    const cfg = { crops: ["cherry"], budget: 1234, seed: 7 } as never;
    await api.validate(cfg);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("/api/validate");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual(cfg);
  });
  it("construit les URL d'export", () => {
    expect(api.exportUrl("abc", "csv-metrics")).toBe("/api/experiments/abc/export?format=csv-metrics");
    expect(api.exportUrl("abc", "archive")).toBe("/api/experiments/abc/export?format=archive");
  });
  it("flux en direct : ne demande que les lignes postérieures au curseur", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ live: {} }), { status: 200 }));
    await api.live("abc", 0);
    await api.live("abc", 42);
    expect(spy.mock.calls.map((c) => c[0])).toEqual(["/api/experiments/abc/live", "/api/experiments/abc/live?since=42"]);
  });
});
