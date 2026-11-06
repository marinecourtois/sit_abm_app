import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as Icons from "./index";

const all = Object.entries(Icons).filter(([, v]) => typeof v === "function") as [string, (p: object) => JSX.Element][];

describe("jeu d'icônes sur mesure", () => {
  it.each(all)("%s : grille 24×24, trait currentColor, décorative par défaut", (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.children.length).toBeGreaterThan(0);
  });
  it("devient une image nommée quand on lui donne un aria-label", () => {
    const { container } = render(<Icons.Leaf aria-label="Feuille" size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.hasAttribute("aria-hidden")).toBe(false);
  });
});
