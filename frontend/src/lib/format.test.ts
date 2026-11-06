import { describe, expect, it } from "vitest";
import { fmt, fmtDate, fmtInt, fmtPct, fmtSigned } from "./format";

const clean = (s: string) => s.replace(/[  ]/g, " ");

describe("formatage français des nombres", () => {
  it("utilise la virgule décimale et l'espace des milliers", () => {
    expect(clean(fmt(1234.5, 1))).toBe("1 234,5");
    expect(clean(fmtInt(90000))).toBe("90 000");
    expect(clean(fmtPct(12.345, 1))).toBe("12,3 %");
  });
  it("affiche un tiret pour une valeur absente plutôt qu'un zéro inventé", () => {
    expect(fmt(null)).toBe("—");
    expect(fmt(Number.NaN)).toBe("—");
    expect(fmtInt(undefined)).toBe("—");
    expect(fmtPct(null)).toBe("—");
    expect(fmtDate(null)).toBe("—");
  });
  it("signe explicitement les variations", () => {
    expect(fmtSigned(-88.4, 0)).toBe("−88");
    expect(fmtSigned(3.2, 1)).toBe("+3,2");
    expect(fmtSigned(0, 0)).toBe("0");
  });
});
