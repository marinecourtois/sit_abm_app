import { describe, expect, it } from "vitest";
import { INDICATORS, diffUnit, stats } from "./indicators";

const row = { "Harvested - clean (%)": 80, "Harvested - larvae (%)": 1, "Rotten - larvae (%)": 2, "Remaining - larvae (%)": 0.5,
  "Rotten (%)": 9, "Rotten - sterile only (%)": 3, "Larvae produced": 1234 };

describe("indicateurs du plan factoriel", () => {
  it("chaque indicateur a une définition explicite de son dénominateur", () => {
    for (const i of INDICATORS) {
      expect(i.definition.length).toBeGreaterThan(40);
      if (i.unit.startsWith("%")) expect(i.definition).toMatch(/% (de tous les|des) fruits produits/);
    }
  });
  it("les fruits infestés additionnent récoltés, pourris et restés avec larves", () => {
    expect(INDICATORS.find((i) => i.key === "larval_damage_pct")!.value(row)).toBeCloseTo(3.5);
  });
  it("un écart entre pourcentages s'exprime en points de %", () => {
    expect(diffUnit(INDICATORS[0])).toBe("points de %");
    expect(diffUnit(INDICATORS.find((i) => i.key === "larvae_produced")!)).toBe("larves (nombre)");
  });
  it("écart-type corrigé (n − 1)", () => {
    expect(stats([1, 2, 3]).sd).toBeCloseTo(1);
    expect(stats([5]).sd).toBe(0);
  });
});
