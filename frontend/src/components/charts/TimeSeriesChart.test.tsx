import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimeSeriesChart } from "./TimeSeriesChart";

const tickLabels = (c: HTMLElement) => Array.from(c.querySelectorAll("text")).map((t) => t.textContent ?? "");

describe("TimeSeriesChart", () => {
  it("trace une courbe par série et une bande d'incertitude quand l'écart-type existe", () => {
    const { container } = render(
      <TimeSeriesChart ariaLabel="test" xLabel="Jour" yLabel="Individus"
        series={[{ id: "a", label: "A", color: "#347A55", x: [0, 1, 2], y: [10, 5, 1], sd: [1, 1, 1] },
                 { id: "b", label: "B", color: "#BF532E", x: [0, 1, 2], y: [3, 4, 5] }]} />,
    );
    const paths = Array.from(container.querySelectorAll("path"));
    expect(paths.filter((p) => p.getAttribute("stroke") === "#347A55" && p.getAttribute("fill") === "none")).toHaveLength(1);
    expect(paths.filter((p) => p.getAttribute("stroke") === "#BF532E" && p.getAttribute("fill") === "none")).toHaveLength(1);
    expect(paths.filter((p) => p.getAttribute("fill") === "#347A55")).toHaveLength(1);   // bande ± sd
    expect(paths.filter((p) => p.getAttribute("fill") === "#BF532E")).toHaveLength(0);   // pas de sd → pas de bande
  });

  it("n'affiche jamais d'axe négatif pour des données positives, même avec une bande large", () => {
    const { container } = render(
      <TimeSeriesChart ariaLabel="t" xLabel="Jour" yLabel="Individus"
        series={[{ id: "a", label: "A", color: "#000000", x: [0, 1, 2, 3], y: [0, 200, 50, 0], sd: [0, 400, 300, 0] }]} />,
    );
    const ticks = tickLabels(container).filter((t) => /^[−-]?\d/.test(t));
    expect(ticks.some((t) => t.startsWith("-") || t.startsWith("−"))).toBe(false);
  });

  it("expose une étiquette accessible et reste focusable au clavier", () => {
    const { getByRole } = render(
      <TimeSeriesChart ariaLabel="Dynamique des populations" xLabel="Jour" yLabel="Y"
        series={[{ id: "a", label: "A", color: "#000", x: [0, 1], y: [1, 2] }]} />,
    );
    const svg = getByRole("img", { name: "Dynamique des populations" });
    expect(svg.getAttribute("tabindex")).toBe("0");
  });
});
