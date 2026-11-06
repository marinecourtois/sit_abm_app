import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BotanicalSpeciesCard } from "./science";
import { META } from "../test/meta";
import type { Meta } from "../lib/api";

const withCrop = (patch: Record<string, number | boolean>): Meta =>
  ({ ...META, crops: { ...META.crops, strawberry: { ...META.crops.strawberry, params: { ...META.crops.strawberry.params, ...patch } } } }) as Meta;

describe("cartes botaniques : texte généré depuis les paramètres du modèle", () => {
  it("fraise : récolte, production et prophylaxie lues dans CropParameters", () => {
    const p = META.crops.strawberry.params as Record<string, number>;
    render(<BotanicalSpeciesCard crop="strawberry" meta={META} />);
    expect(screen.getByText(new RegExp(`Récolte tous les ${p.harvest_frequency} j`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${p.season_length} j\\)`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Prophylaxie tous les ${p.prophylaxis_frequency} j`))).toBeInTheDocument();
  });
  it("cerise : récolte unique au dernier jour et stock fermé", () => {
    const p = META.crops.cherry.params as Record<string, number>;
    render(<BotanicalSpeciesCard crop="cherry" meta={META} />);
    expect(screen.getByText(`Récolte unique à J${p.season_length - 1}`)).toBeInTheDocument();
    expect(screen.getByText("Stock fermé")).toBeInTheDocument();
  });
  it("suit une modification des paramètres (aucun texte figé)", () => {
    render(<BotanicalSpeciesCard crop="strawberry" meta={withCrop({ harvest_frequency: 5, prophylaxis_frequency: 0 })} />);
    expect(screen.getByText(/Récolte tous les 5 j/)).toBeInTheDocument();
    expect(screen.queryByText(/Prophylaxie/)).toBeNull();
    expect(screen.getByText(/Maturation en/)).toBeInTheDocument();
  });
});
