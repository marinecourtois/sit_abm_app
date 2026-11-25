import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MetaContext } from "../lib/meta";
import { META } from "../test/meta";
import { Model } from "./Model";

describe("page Modèle : agents et hypothèses lus dans le registre du moteur", () => {
  it("cinq agents, avec les classes du moteur et leurs valeurs du notebook", () => {
    render(<MetaContext.Provider value={META}><MemoryRouter><Model /></MemoryRouter></MetaContext.Provider>);
    for (const cls of ["SterileMales_Agent", "WildMales_Agent", "Females_Agent", "Larvae_Agent", "Fruit_Agent"]) expect(screen.getByText(cls)).toBeInTheDocument();
    const c = META.model_constants;
    expect(screen.getByText(`${c.larval_emergence[0]}–${c.larval_emergence[1]} j`)).toBeInTheDocument();
    expect(screen.getByText(`${c.refractory_fertile[0]}–${c.refractory_fertile[1]} j`)).toBeInTheDocument();
  });
  it("les mécanismes absents du notebook sont marqués comme options", () => {
    render(<MetaContext.Provider value={META}><MemoryRouter><Model /></MemoryRouter></MetaContext.Provider>);
    expect(screen.getAllByText("option hors notebook")).toHaveLength(2);   // capacité de charge, stade « tournant » (l'immigration fait partie du modèle)
    expect(screen.getAllByText("notebook").length).toBeGreaterThanOrEqual(5);
  });
});
