import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Activity, BarChart3, BookOpen, Bug, FileText, FlaskConical, Home, Layers, Play, Plus, Search, Settings } from "../icons";
import { api, type Experiment } from "../lib/api";
import { CROP_LABEL, STATUS_LABEL } from "../lib/format";

export interface PaletteItem { id: string; label: string; hint?: string; group: string; to: string; icon?: typeof Home; keywords?: string }

const PAGES: PaletteItem[] = [
  { id: "p-o", group: "Pages", label: "Vue d’ensemble", to: "/", icon: Home, hint: "g o" },
  { id: "p-e", group: "Pages", label: "Expériences", to: "/experiences", icon: FlaskConical, hint: "g e" },
  { id: "p-s", group: "Pages", label: "Nouvelle simulation", to: "/simulation", icon: Plus, hint: "n", keywords: "studio lancer créer" },
  { id: "p-c", group: "Pages", label: "Comparaison", to: "/comparaison", icon: BarChart3, hint: "g c" },
  { id: "p-r", group: "Pages", label: "Résultats et analyses", to: "/resultats", icon: Layers, hint: "g r", keywords: "factoriel heatmap pareto" },
  { id: "p-p", group: "Pages", label: "Publications", to: "/publications", icon: BookOpen, hint: "g p", keywords: "rapport pdf export" },
  { id: "p-pr", group: "Pages", label: "Protocole", to: "/protocole", icon: FileText, keywords: "équations hypothèses paramètres" },
  { id: "p-pa", group: "Pages", label: "Paramètres du modèle", to: "/parametres", icon: Settings, hint: "g a", keywords: "valeurs sources plages json immigration capacité" },
  { id: "p-mo", group: "Pages", label: "Modèle et hypothèses", to: "/modele", icon: Bug, hint: "g m", keywords: "agents architecture femelle larve fruit" },
  { id: "p-dy", group: "Pages", label: "Dynamiques des agents", to: "/dynamiques", icon: Activity, hint: "g d", keywords: "populations femelles fécondées témoin pics" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Filtre et ordonne : tous les mots de la requête doivent apparaître (sans accents ni casse). */
export function filterItems(items: PaletteItem[], q: string): PaletteItem[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items
    .map((it) => {
      const hay = norm(`${it.label} ${it.hint ?? ""} ${it.keywords ?? ""}`);
      if (!words.every((w) => hay.includes(w))) return null;
      return { it, score: norm(it.label).startsWith(words[0]) ? 0 : 1 };
    })
    .filter((x): x is { it: PaletteItem; score: number } => x !== null)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.it);
}

function experimentItem(e: Experiment): PaletteItem {
  return {
    id: e.id, group: "Expériences", to: `/simulation/${e.id}`, icon: Play,
    label: e.name, hint: `${e.short_id} · ${STATUS_LABEL[e.status] ?? e.status}`,
    keywords: `${e.short_id} ${e.project} ${e.config.crops.map((c) => CROP_LABEL[c]).join(" ")} ${e.tags.join(" ")}`,
  };
}

/** Palette de commandes (Ctrl/⌘ + K) : pages et expériences, au clavier. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [exps, setExps] = useState<Experiment[]>([]);
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ(""); setIdx(0);
    api.experiments().then(setExps).catch(() => setExps([]));
  }, [open]);

  const items = useMemo(() => filterItems([...PAGES, ...exps.map(experimentItem)], q).slice(0, 40), [q, exps]);
  useEffect(() => setIdx(0), [q]);
  useEffect(() => { listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" }); }, [idx]);

  const go = (it?: PaletteItem) => { if (!it) return; onOpenChange(false); nav(it.to); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(items[idx]); }
  };

  let lastGroup = "";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[1px]" />
        <Dialog.Content aria-describedby={undefined} onKeyDown={onKey}
          className="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-white shadow-2xl">
          <Dialog.Title className="sr-only">Palette de commandes</Dialog.Title>
          <label className="flex items-center gap-2.5 border-b border-line px-4">
            <Search size={17} className="text-muted" aria-hidden />
            <span className="sr-only">Rechercher une page ou une expérience</span>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Aller à une page, une expérience (nom, identifiant, culture)…"
              role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={items[idx] ? `pal-${items[idx].id}` : undefined}
              className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
            <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-muted">Échap</kbd>
          </label>
          <ul id="palette-list" ref={listRef} role="listbox" aria-label="Résultats" className="max-h-[52vh] overflow-auto py-1.5">
            {items.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted">Aucun résultat pour « {q} ».</li>}
            {items.map((it, i) => {
              const head = it.group !== lastGroup ? (lastGroup = it.group) : null;
              const Icon = it.icon;
              return (
                <li key={it.id} role="presentation">
                  {head && <div className="px-4 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted">{head}</div>}
                  <div id={`pal-${it.id}`} role="option" aria-selected={i === idx} data-idx={i}
                    onMouseMove={() => setIdx(i)} onClick={() => go(it)}
                    className={`mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] ${i === idx ? "bg-sage text-forest" : "text-ink"}`}>
                    {Icon && <Icon size={17} aria-hidden />}
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {it.hint && <span className="shrink-0 font-mono text-[11px] text-muted">{it.hint}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-4 border-t border-line bg-[#F8F9F5] px-4 py-2 text-[11px] text-muted">
            <span><kbd className="font-mono">↑ ↓</kbd> parcourir</span><span><kbd className="font-mono">Entrée</kbd> ouvrir</span><span className="ml-auto"><kbd className="font-mono">Ctrl K</kbd> / <kbd className="font-mono">⌘ K</kbd></span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
