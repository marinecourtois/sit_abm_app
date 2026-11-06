/**
 * Tests de contrat frontend ↔ moteur : tout ce que l'interface affiche doit exister dans le
 * code du moteur Python. Évite les libellés orphelins ou les indicateurs inventés.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { METRICS, VARIABLES } from "./variables";
import { STRATEGY_COLOR, STRATEGY_ORDER } from "./colors";
import { META } from "../test/meta";

// Chemins littéraux : SmartTest relie ainsi ce test aux fichiers Python lus (une modification
// de runner.py ou jobs.py sélectionne aussi ce test frontend).
const runner = readFileSync(resolve(__dirname, "../../../backend/tis_engine/runner.py"), "utf8");
const jobs = readFileSync(resolve(__dirname, "../../../backend/app/jobs.py"), "utf8");

describe("contrat avec le moteur", () => {
  it("chaque indicateur affiché est calculé par runner.run_season", () => {
    for (const m of METRICS) expect(runner, `métrique ${m.key}`).toMatch(new RegExp(`["']${m.key}["']`));
  });
  it("chaque série affichée est enregistrée ou dérivée par le moteur", () => {
    for (const v of VARIABLES) expect(runner + jobs, `série ${v.key}`).toMatch(new RegExp(`["']${v.key}["']`));
  });
  it("chaque série a une unité et chaque indicateur une définition", () => {
    for (const v of VARIABLES) expect(v.unit.length).toBeGreaterThan(0);
    for (const m of METRICS) expect(m.definition.length).toBeGreaterThan(10);
  });
  it("les stratégies colorées sont exactement celles du registre", () => {
    expect(new Set(STRATEGY_ORDER)).toEqual(new Set(Object.keys(META.strategies)));
    for (const k of STRATEGY_ORDER) expect(STRATEGY_COLOR[k]).toMatch(/^#[0-9A-F]{6}$/i);
  });
  it("les descriptions de stratégies citent leurs paramètres réels", () => {
    for (const s of Object.values(META.strategies)) {
      for (const v of Object.values(s.params)) if (typeof v === "number" && v > 0 && v < 1) expect(s.description).toContain(`${Math.round(v * 100)} %`);
      if (s.params.interval) expect(s.description).toContain(`tous les ${s.params.interval} jours`);
    }
  });
});
