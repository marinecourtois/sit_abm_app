import { describe, expect, it } from "vitest";
import { mergeLive, type LiveState } from "./api";
import { fmtDuration } from "./format";

const st = (live: LiveState["live"], seq: number): LiveState => ({ status: "running", progress: 0.1, live, seq, log: [], plan: [] });
const row = (d: number) => ({ Wild_males: d });

describe("flux en direct incrémental", () => {
  it("première réponse : prise telle quelle", () => {
    const a = st({ s1: { day: 2, from: 0, rows: [row(1), row(2)] } }, 2);
    expect(mergeLive(null, a)).toBe(a);
  });
  it("ajoute les nouvelles lignes à la position indiquée par `from`", () => {
    const a = st({ s1: { day: 2, from: 0, rows: [row(1), row(2)] } }, 2);
    const b = st({ s1: { day: 4, from: 2, rows: [row(3), row(4)] }, s2: { day: 1, from: 0, rows: [row(1)] } }, 5);
    const m = mergeLive(a, b);
    expect(m.live.s1.rows.map((r) => r.Wild_males)).toEqual([1, 2, 3, 4]);
    expect(m.live.s1.day).toBe(4);
    expect(m.live.s2.rows).toHaveLength(1);
    expect(m.seq).toBe(5);
  });
  it("conserve les scénarios absents de la réponse et ne duplique jamais une ligne", () => {
    const a = st({ s1: { day: 2, from: 0, rows: [row(1), row(2)] } }, 2);
    const again = st({ s1: { day: 2, from: 1, rows: [row(2)] } }, 2);   // réponse redondante (course entre deux sondages)
    expect(mergeLive(a, again).live.s1.rows.map((r) => r.Wild_males)).toEqual([1, 2]);
    expect(mergeLive(a, st({}, 2)).live.s1.rows).toHaveLength(2);
  });
});

describe("durées", () => {
  it("formate secondes, minutes et heures", () => {
    expect(fmtDuration(8.4)).toBe("8 s");
    expect(fmtDuration(125)).toBe("2 min 05 s");
    expect(fmtDuration(3780)).toBe("1 h 03 min");
    expect(fmtDuration(null)).toBe("—");
  });
});
