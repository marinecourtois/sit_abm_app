import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ExperimentStatus, NumberField, Segmented } from "./ui";

function Seg() {
  const [v, setV] = useState<"a" | "b" | "c">("a");
  return <><Segmented label="Stratégie" value={v} onChange={setV} options={[{ value: "a", label: "Quotidien" }, { value: "b", label: "J+3" }, { value: "c", label: "J+7" }]} /><output>{v}</output></>;
}
function Num({ start = 5 }: { start?: number }) {
  const [v, setV] = useState(start);
  return <><NumberField label="Budget" value={v} onChange={setV} min={0} max={10} step={4} /><output>{v}</output></>;
}

describe("contrôles", () => {
  it("Segmented : clic et flèches du clavier, état ARIA cohérent", () => {
    render(<Seg />);
    fireEvent.click(screen.getByRole("radio", { name: "J+7" }));
    expect(screen.getByRole("radio", { name: "J+7" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(screen.getByText("a", { selector: "output" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowLeft" });
    expect(screen.getByText("c", { selector: "output" })).toBeInTheDocument();
  });

  it("NumberField : les boutons ± respectent les bornes (pas de valeur hors plage)", () => {
    render(<Num start={8} />);
    fireEvent.click(screen.getByRole("button", { name: "Augmenter Budget" }));
    expect(screen.getByText("10", { selector: "output" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Diminuer Budget" }));
    fireEvent.click(screen.getByRole("button", { name: "Diminuer Budget" }));
    fireEvent.click(screen.getByRole("button", { name: "Diminuer Budget" }));
    expect(screen.getByText("0", { selector: "output" })).toBeInTheDocument();
  });

  it("ExperimentStatus : libellé français et progression uniquement en cours", () => {
    const { rerender } = render(<ExperimentStatus status="running" progress={0.42} />);
    expect(screen.getByText(/En cours · 42 %/)).toBeInTheDocument();
    rerender(<ExperimentStatus status="completed" progress={1} />);
    expect(screen.getByText("Terminée")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
