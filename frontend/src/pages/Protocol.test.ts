import { describe, expect, it } from "vitest";
import type { Meta } from "../lib/api";
import metaJson from "../test/fixtures/meta.json";
import { parametersJson } from "./Protocol";

const meta = metaJson as unknown as Meta;

describe("export JSON des paramètres", () => {
  it("contient chaque paramètre biologique avec sa valeur du notebook, sa plage et sa source", () => {
    const doc = JSON.parse(parametersJson(meta));
    expect(doc.format).toBe("modelly-tis-parameters");
    expect(doc.params_version).toBe(meta.params_version);
    expect(doc.biology).toHaveLength(meta.biology.length);
    for (const p of doc.biology) {
      const ref = meta.biology.find((b) => b.name === p.name)!;
      expect([p.default, p.min, p.max, p.unit, p.source]).toEqual([ref.default, ref.min, ref.max, ref.unit, ref.source]);
    }
    expect(Object.keys(doc.crops).sort()).toEqual(["cherry", "strawberry"]);
    expect(doc.fixed_constants).toEqual(meta.fixed_constants);
  });
});
