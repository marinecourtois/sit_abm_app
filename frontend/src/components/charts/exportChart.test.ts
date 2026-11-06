import { describe, expect, it } from "vitest";
import { toCsv } from "./exportChart";

describe("export CSV des figures", () => {
  it("échappe les virgules, guillemets et retours à la ligne", () => {
    expect(toCsv([["a", 'b"c', "d,e"], [1, null, "x\ny"]])).toBe('a,"b""c","d,e"\n1,,"x\ny"');
  });
  it("conserve la précision des nombres (aucun arrondi à l'export)", () => {
    expect(toCsv([[0.1 + 0.2, 1e-9]])).toBe("0.30000000000000004,1e-9");
  });
});
