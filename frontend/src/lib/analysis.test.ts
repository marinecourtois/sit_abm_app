import { describe, expect, it } from "vitest";
import type { Experiment, ExperimentConfig, Meta, Results, Scenario } from "./api";
import { METRIC_COLUMN, activeExtensions, datasetFromReference, datasetFromResults, invasionCounts, invasionFor, invasionLabel, invasionShort, normalizeLoadedConfig, paretoFront, planSize, presetInvasion, scenarioLabel, synthesize } from "./analysis";
import { INDICATOR } from "./indicators";
import metaJson from "../test/fixtures/meta.json";

const meta = metaJson as unknown as Meta;
const config: ExperimentConfig = {
  crops: ["strawberry"], strategies: [{ key: "every_3" }], invasion: { preset: "moyenne", wild: 300, females: 300 },
  budget: 9000, remating: "preference", replicates: 2, seed: 42, include_control: true, biology: {},
};
const metrics = (base: number) => Object.fromEntries(Object.keys(METRIC_COLUMN).map((k, i) => {
  const values = [base + i, base + i + 1];
  return [k, { mean: base + i + 0.5, sd: 0.7, min: values[0], max: values[1], n: 2, values }];
}));
const scenario = (over: Partial<Scenario>): Scenario => ({
  key: "strawberry::every_3", crop: "strawberry", strategy: { key: "every_3" }, strategy_key: "every_3", strategy_label: "J+3",
  is_control: false, budget: 9000, schedule: {}, seeds: [42, 1042], metrics: metrics(10), series: { Time: [] } as unknown as Scenario["series"], events: [], ...over,
});

describe("jeu de données d'analyse d'une expérience", () => {
  it("une ligne par saison, aux colonnes du CSV du notebook, valeurs non modifiées", () => {
    const res = { scenarios: [scenario({ key: "strawberry::no_tis", strategy: { key: "no_tis" }, strategy_key: "no_tis", strategy_label: "Témoin (sans TIS)", is_control: true, budget: 0, metrics: metrics(50) }), scenario({})] } as unknown as Results;
    const d = datasetFromResults(res, { config } as Experiment, meta);
    expect(d.rows).toHaveLength(4);
    expect(d.nRep).toBe(2);
    expect(d.budgets).toEqual([0, 9000]);
    expect(d.invasions).toEqual(["Modéré (300 W : 300 F)"]);
    expect(d.regimes).toEqual(["preference"]);
    expect(d.strategies.map((s) => [s.id, s.control])).toEqual([["no_tis", true], ["every_3", false]]);
    const r = d.rows.find((x) => x.Strategy === "every_3" && x.Replicate === 1)!;
    expect(r["Harvested - clean (%)"]).toBe(res.scenarios[1].metrics.harvested_clean_pct.values[1]);
    expect(r.Seed).toBe(1042);
    // l'indicateur « fruits infestés » se recalcule à l'identique depuis les colonnes
    const m = res.scenarios[1].metrics;
    expect(INDICATOR.larval_damage_pct.value(r)).toBeCloseTo(m.harvested_larvae_pct.values[1] + m.rotten_larvae_pct.values[1] + m.remaining_larvae_pct.values[1]);
  });

  it("un plan garde l'invasion et le régime propres à chaque scénario", () => {
    const res = { scenarios: [
      scenario({ key: "strawberry::inv=90:90::rem=first::b=4500::every_3", budget: 4500, invasion: { preset: "faible", wild: 90, females: 90 }, remating: "first" }),
      scenario({ key: "strawberry::inv=300:300::rem=preference::b=9000::every_3", invasion: { preset: "moyenne", wild: 300, females: 300 }, remating: "preference" }),
    ] } as unknown as Results;
    const d = datasetFromResults(res, { config } as Experiment, meta);
    expect(d.invasions).toEqual(["Faible (90 W : 90 F)", "Modéré (300 W : 300 F)"]);
    expect(d.regimes).toEqual(["preference", "first"]);
    expect(d.budgets).toEqual([4500, 9000]);
    expect(d.strategies).toHaveLength(1);   // même stratégie dans toutes les cellules
  });

  it("deux variantes d'une même clé de stratégie restent distinctes, couleurs différentes", () => {
    const res = { scenarios: [
      scenario({ key: "strawberry::periodic|interval=4", strategy_key: "periodic", strategy_id: "periodic|interval=4", strategy_label: "J+4" }),
      scenario({ key: "strawberry::periodic|interval=5", strategy_key: "periodic", strategy_id: "periodic|interval=5", strategy_label: "J+5" }),
    ] } as unknown as Results;
    const d = datasetFromResults(res, { config } as Experiment, meta);
    expect(d.strategies.map((s) => s.label)).toEqual(["J+4", "J+5"]);
    expect(new Set(d.strategies.map((s) => s.color)).size).toBe(2);
  });
});

describe("plan factoriel de référence", () => {
  it("les noms de stratégie du notebook deviennent les clés du moteur", () => {
    const d = datasetFromReference([{ Crop: "cherry", Invasion: "Forte (900 W : 900 F)", Budget: 0, Remating: "first", Strategy: "No TIS", Replicate: 0 },
      { Crop: "cherry", Invasion: "Faible (90 W : 90 F)", Budget: 4500, Remating: "first", Strategy: "Every 3 days", Replicate: 1 }], meta);
    expect(d.strategies.map((s) => s.id)).toEqual(["no_tis", "every_3"]);
    expect(d.invasions).toEqual(["Faible (90 W : 90 F)", "Fort (900 W : 900 F)"]);   // noms du notebook → noms de l'application, mêmes effectifs
    expect(d.nRep).toBe(2);
  });
});

describe("plan et libellés", () => {
  it("planSize ramène les champs uniques en listes", () => {
    expect(planSize(config)).toEqual({ budgets: [9000], invasions: [config.invasion], rematings: ["preference"] });
    expect(planSize({ ...config, budgets: [4500, 9000] }).budgets).toEqual([4500, 9000]);
  });
  it("le libellé ne mentionne que les dimensions qui varient", () => {
    const p = { crop: "strawberry", strategy_label: "J+3", is_control: false, budget: 4500, invasion: { preset: "faible", wild: 90, females: 90 }, remating: "first" };
    expect(scenarioLabel(p, config, meta)).toBe("Fraise · J+3");
    expect(scenarioLabel(p, { ...config, budgets: [4500, 9000], rematings: ["preference", "first"] }, meta)).toBe("Fraise · J+3 · 4\u202f500 stériles · Monandrie");
  });
  it("front de Pareto : points non dominés seulement", () => {
    expect(paretoFront([{ id: "a", x: 1, y: 5 }, { id: "b", x: 2, y: 2 }, { id: "c", x: 3, y: 3 }, { id: "d", x: 5, y: 1 }])).toEqual(["a", "b", "d"]);
  });
});

describe("synthèse décisionnelle", () => {
  const S = (id: string, control = false) => ({ id, label: id, short: id, color: "#000", control });
  const rows = (crop: string, remating: string, strategy: string, budget: number, vals: number[]) =>
    vals.map((v, i) => ({ Crop: crop, Invasion: "Moyenne (300 W : 300 F)", Budget: budget, Remating: remating, Strategy: strategy, Replicate: i, "Harvested - clean (%)": v }));
  const data = {
    rows: [
      ...rows("strawberry", "preference", "no_tis", 0, [50, 52]), ...rows("strawberry", "preference", "every_3", 9000, [88, 90]), ...rows("strawberry", "preference", "front_100", 9000, [70, 72]),
      ...rows("cherry", "preference", "no_tis", 0, [30, 30]), ...rows("cherry", "preference", "every_3", 9000, [60, 61]), ...rows("cherry", "preference", "front_100", 9000, [66, 67]),
      ...rows("strawberry", "first", "no_tis", 0, [50, 52]), ...rows("strawberry", "first", "every_3", 9000, [80, 82]), ...rows("strawberry", "first", "front_100", 9000, [81, 82]),
      ...rows("strawberry", "preference", "every_3", 4500, [99, 99]),
    ],
    strategies: [S("no_tis", true), S("every_3"), S("front_100")],
    crops: ["strawberry", "cherry"], invasions: ["Moyenne (300 W : 300 F)"], budgets: [0, 4500, 9000], regimes: ["preference", "first"], nRep: 2,
  };
  const syn = synthesize(data, INDICATOR.harvested_clean_pct.value, true, "Moyenne (300 W : 300 F)", 9000, (c) => c, (r) => r);

  it("classe les stratégies au budget choisi et mesure l'écart au témoin", () => {
    const fr = syn.cells.find((c) => c.crop === "strawberry" && c.remating === "preference")!;
    expect(fr.ranking.map((r) => r.strategy.id)).toEqual(["every_3", "front_100"]);
    expect(fr.gain).toBeCloseTo(89 - 51);
    expect(fr.clear).toBe(true);
    expect(fr.bestAnyBudget?.budget).toBe(4500);   // meilleure combinaison, tous budgets confondus
  });
  it("répond aux deux questions de l'étude à partir des données", () => {
    expect(syn.byCrop).toBe("Stratégie en tête différente : strawberry → every_3 ; cherry → front_100.");
    expect(syn.byRegime).toContain("strawberry : every_3 en preference, front_100 en first");
  });
  it("signale un écart inférieur à la variabilité entre répétitions", () => {
    const mono = syn.cells.find((c) => c.crop === "strawberry" && c.remating === "first")!;
    expect(mono.clear).toBe(false);   // 81,5 contre 81 : écart < somme des écarts-types
  });
  it("le sens de l'indicateur est respecté (plus bas = meilleur)", () => {
    const low = synthesize(data, INDICATOR.harvested_clean_pct.value, false, "Moyenne (300 W : 300 F)", 9000, (c) => c, (r) => r);
    expect(low.cells.find((c) => c.crop === "strawberry" && c.remating === "preference")!.ranking[0].strategy.id).toBe("front_100");
  });
});

describe("extensions hors notebook et libellés d'invasion", () => {
  it("activeExtensions ne signale rien aux valeurs par défaut", () => {
    expect(activeExtensions(meta.biology_defaults)).toEqual([]);
    expect(activeExtensions({ ...meta.biology_defaults, immigration_females: 8, turning_days: 3 })).toHaveLength(2);
  });
  it("chaque paramètre d'extension est désactivé par défaut et marqué comme tel", () => {
    const ext = meta.biology.filter((p) => p.extension);
    expect(ext.map((p) => p.name).sort()).toEqual(["carrying_capacity", "immigration_females", "immigration_wild_males", "turning_days", "turning_puncture_probability"]);
    for (const p of ext) expect(p.group).toBe("extensions");
  });
  it("deux invasions personnalisées gardent des noms courts distincts", () => {
    expect(invasionShort("Personnalisée (120 W : 150 F)")).toBe("120 W : 150 F");
    expect(invasionShort("Moyenne (300 W : 300 F)")).toBe("Moyenne");
  });
});


describe("inoculum de départ (1.10.0)", () => {
  it("l'inoculum fort porte des effectifs propres à chaque culture et un seul nom", () => {
    const fort = presetInvasion(meta, "forte");
    expect(fort.by_crop).toEqual(meta.invasions.forte.by_crop);
    expect(invasionFor(fort, "strawberry")).toEqual(meta.invasions.forte.by_crop!.strawberry);
    expect(invasionFor(fort, "cherry")).toEqual(meta.invasions.forte.by_crop!.cherry);
    // effectifs résolus d'un scénario (fraise ou cerise) : même libellé, donc une seule ligne dans les analyses
    expect(invasionLabel({ preset: "forte", ...meta.invasions.forte.by_crop!.strawberry }, meta)).toBe("Fort (pic du témoin)");
    expect(invasionLabel({ preset: "forte", ...meta.invasions.forte.by_crop!.cherry }, meta)).toBe("Fort (pic du témoin)");
    expect(invasionLabel({ preset: "moyenne", wild: 300, females: 300 }, meta)).toBe("Modéré (300 W : 300 F)");
    expect(invasionLabel({ preset: null, wild: 120, females: 150 }, meta)).toBe("Personnalisé (120 W : 150 F)");
    expect(invasionShort("Personnalisé (120 W : 150 F)")).toBe("120 W : 150 F");
  });
  it("l'immigration par culture est signalée comme extension active", () => {
    expect(activeExtensions(meta.biology_defaults, null)).toEqual([]);
    const on = activeExtensions(meta.biology_defaults, { strawberry: { wild: 15, females: 15 }, cherry: { wild: 8, females: 8 } });
    expect(on).toHaveLength(1);
    expect(on[0]).toContain("Fraise : 15 mâles et 15 femelles");
  });
});

describe("corrections de la revue 1.10.0", () => {
  it("l'inoculum fort s'affiche avec ses effectifs réels par culture", () => {
    const fort = presetInvasion(meta, "forte");
    const by = meta.invasions.forte.by_crop!;
    expect(invasionCounts(fort, ["strawberry", "cherry"])).toBe(`Fraise ${by.strawberry.wild} W : ${by.strawberry.females} F, Cerise ${by.cherry.wild} W : ${by.cherry.females} F`);
    expect(invasionCounts({ wild: 300, females: 300 }, ["strawberry"])).toBe("300 W : 300 F");
  });
  it("l'ancien « Fort » du notebook et l'inoculum fort actuel ont des noms courts distincts", () => {
    expect(invasionShort("Fort (900 W : 900 F)")).toBe("Fort 900 W : 900 F");
    expect(invasionShort("Fort (pic du témoin)")).toBe("Fort");
  });
  it("une configuration d'avant la 1.10.0 avec immigration globale devient l'immigration par culture équivalente", () => {
    const old = { crops: ["strawberry", "cherry"], strategies: [], invasion: { wild: 300, females: 300 }, budget: 9000, remating: "preference", replicates: 20, seed: 42, include_control: true,
      biology: { ...meta.biology_defaults, immigration_wild_males: 15, immigration_females: 8 } } as unknown as ExperimentConfig;
    const n = normalizeLoadedConfig(old, meta.biology_defaults);
    expect(n.immigration).toEqual({ strawberry: { wild: 15, females: 8 }, cherry: { wild: 15, females: 8 } });
    expect([n.biology.immigration_wild_males, n.biology.immigration_females]).toEqual([0, 0]);
  });
  it("l'immigration d'une culture non sélectionnée n'est pas signalée", () => {
    expect(activeExtensions(meta.biology_defaults, { cherry: { wild: 8, females: 8 } }, ["strawberry"])).toEqual([]);
  });
});
