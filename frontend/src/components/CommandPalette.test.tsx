import { describe, expect, it } from "vitest";
import { filterItems, type PaletteItem } from "./CommandPalette";

const items: PaletteItem[] = [
  { id: "1", group: "Pages", label: "Vue d’ensemble", to: "/" },
  { id: "2", group: "Pages", label: "Résultats et analyses", to: "/resultats", keywords: "factoriel heatmap" },
  { id: "3", group: "Expériences", label: "Étude de référence — Fraise vs Cerise", to: "/simulation/x", hint: "TIS-AB12CD34 · Terminée" },
];

describe("palette de commandes : filtrage", () => {
  it("sans requête : tout, dans l'ordre", () => expect(filterItems(items, "").map((i) => i.id)).toEqual(["1", "2", "3"]));
  it("insensible aux accents et à la casse", () => {
    expect(filterItems(items, "resultats").map((i) => i.id)).toEqual(["2"]);
    expect(filterItems(items, "ETUDE cerise").map((i) => i.id)).toEqual(["3"]);
  });
  it("cherche aussi dans l'identifiant et les mots-clés", () => {
    expect(filterItems(items, "ab12").map((i) => i.id)).toEqual(["3"]);
    expect(filterItems(items, "heatmap").map((i) => i.id)).toEqual(["2"]);
  });
  it("tous les mots doivent correspondre", () => expect(filterItems(items, "fraise pareto")).toEqual([]));
});
