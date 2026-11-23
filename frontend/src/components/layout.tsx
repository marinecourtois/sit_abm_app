import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Activity, BarChart3, BookOpen, FlaskConical, Home, Layers, Menu, Play, Search, X, Download, Plus } from "../icons";
import { FieldLandscape, LeafMark, SeedlingIcon } from "../illustrations";
import { api, type ActiveRun } from "../lib/api";
import { useMeta } from "../lib/meta";
import { fmtDuration } from "../lib/format";
import { Button } from "./ui";

const CommandPalette = lazy(() => import("./CommandPalette").then((m) => ({ default: m.CommandPalette })));
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Exécutions en cours sur le serveur : interrogé toutes les 2 s s'il y en a, 8 s sinon, jamais onglet masqué. */
export function useActiveRuns() {
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  useEffect(() => {
    let t: number | undefined, alive = true, n = 0;
    const tick = async () => {
      if (!document.hidden) {
        try { const r = await api.queue(); n = r.active.length; if (alive) setRuns(r.active); } catch { /* serveur indisponible : réessai */ }
      }
      if (alive) t = window.setTimeout(tick, n ? 2000 : 8000);
    };
    tick();
    const wake = () => { if (!document.hidden) { clearTimeout(t); tick(); } };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("tis:run-started", wake);
    return () => { alive = false; clearTimeout(t); document.removeEventListener("visibilitychange", wake); window.removeEventListener("tis:run-started", wake); };
  }, []);
  return runs;
}

export function ActivityIndicator({ onNavigate }: { onNavigate?: () => void }) {
  const runs = useActiveRuns();
  if (!runs.length) return null;
  return (
    <div className="mx-3.5 mt-6 rounded-md border border-[#B9D3BF] bg-white/85 px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-forest">
        <Activity size={15} aria-hidden />
        {runs.length === 1 ? "1 calcul en cours" : `${runs.length} calculs en cours`}
      </div>
      <ul className="mt-1.5 space-y-2">
        {runs.slice(0, 3).map((r) => (
          <li key={r.id}>
            <Link to={`/simulation/${r.id}`} onClick={onNavigate} className="block rounded px-0.5 hover:bg-sage-soft">
              <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                <span className="truncate font-mono text-muted">{r.short_id}</span>
                <span className="tnum text-ink">{r.status === "queued" ? "en file" : `${Math.round(r.progress * 100)} %`}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-line"><div className="h-full bg-botanic transition-[width] duration-700 ease-out" style={{ width: `${r.progress * 100}%` }} /></div>
              {r.eta_s != null && <div className="mt-0.5 text-[10.5px] text-muted tnum">reste ≈ {fmtDuration(r.eta_s)}</div>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const NAV = [
  { to: "/", label: "Vue d’ensemble", icon: Home, key: "g o" },
  { to: "/experiences", label: "Expériences", icon: FlaskConical, key: "g e" },
  { to: "/simulation", label: "Simulation", icon: Play, key: "g s" },
  { to: "/comparaison", label: "Comparaison", icon: BarChart3, key: "g c" },
  { to: "/resultats", label: "Résultats", icon: Layers, key: "g r" },
  { to: "/publications", label: "Publications", icon: BookOpen, key: "g p" },
];

export function Logo() {
  return (
    <div className="logo flex items-center gap-2.5">
      <LeafMark width={44} height={44} className="logo-leaf" aria-hidden />
      <div className="leading-none">
        <div className="font-serif text-[30px] font-semibold tracking-[-0.01em] text-ink">Modelly</div>
        <div className="mt-1 font-serif text-[15px] text-muted">TIS Research</div>
      </div>
    </div>
  );
}

function useActiveIndicator() {
  const listRef = useRef<HTMLUListElement>(null);
  const loc = useLocation();
  const [ind, setInd] = useState({ top: 0, height: 0, visible: false });
  const measure = useCallback(() => {
    const li = listRef.current?.querySelector<HTMLElement>("a.is-active")?.closest("li");
    if (!li) return setInd((i) => ({ ...i, visible: false }));
    setInd({ top: li.offsetTop, height: li.offsetHeight, visible: true });   // repère : la liste (ul relative)
  }, []);
  useLayoutEffect(measure, [loc.pathname, measure]);
  useEffect(() => { window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); }, [measure]);
  return { listRef, ind };
}

export function ResearchSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { listRef, ind } = useActiveIndicator();
  const meta = useMeta();
  return (
    <nav aria-label="Navigation principale" className="flex h-full flex-col bg-[linear-gradient(180deg,#F4F5EF_0%,#EFF2EA_55%,#E4ECE0_100%)]">
      <div className="px-7 pt-7 pb-6"><Logo /></div>
      <div className="px-3.5 pb-4">
        <button type="button" onClick={() => { onNavigate?.(); window.dispatchEvent(new Event("tis:palette")); }}
          className="flex w-full items-center gap-2.5 rounded-[7px] border border-line bg-white/70 px-3 py-2 text-left text-[13px] text-muted transition-colors hover:border-ink/30 hover:text-ink">
          <Search size={15} aria-hidden /><span className="flex-1">Rechercher…</span>
          <kbd className="rounded border border-line bg-white px-1.5 font-mono text-[10.5px]">{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
      </div>
      <ul ref={listRef} className="relative flex flex-col gap-2 px-3.5">
        {/* Indicateur de la section active : glisse d'un élément à l'autre */}
        <span aria-hidden className="nav-indicator pointer-events-none absolute inset-x-3.5 top-0 rounded-[7px] bg-sage shadow-[inset_0_0_0_1px_rgba(52,122,85,0.08)]"
          style={{ transform: `translateY(${ind.top}px)`, height: ind.height, opacity: ind.visible ? 1 : 0 }} />
        {NAV.map((n) => (
          <li key={n.to} className="relative">
            <NavLink to={n.to} end={n.to === "/"} onClick={onNavigate}
              className={({ isActive }) => `nav-link flex items-center gap-3.5 rounded-[7px] px-3.5 py-2.5 text-[16px] transition-colors duration-200 ${isActive ? "is-active text-forest font-medium" : "text-ink hover:bg-[#E8EDE6]/80"}`}>
              <n.icon size={23} strokeWidth={1.45} aria-hidden />
              {n.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <ActivityIndicator onNavigate={onNavigate} />
      <div className="relative mt-auto">
        <FieldLandscape className="pointer-events-none block h-[430px] w-full" preserveAspectRatio="xMaxYMax slice" aria-hidden />
        <div className="absolute inset-x-3.5 bottom-4 rounded-md border border-line bg-white/92 px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-[2px]">
          <div className="flex items-start gap-2.5">
            <SeedlingIcon width={22} height={22} className="mt-0.5 text-forest" aria-hidden />
            <div>
              <div className="text-[13.5px] font-semibold text-forest">Modélisation TIS</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-muted">Dynamique des populations et optimisation des lâchers</div>
              {meta && <div className="mt-1 font-mono text-[10.5px] text-muted" title={`Application ${meta.versions.app_version} · moteur ${meta.versions.engine_version} · modelly ${meta.versions.modelly_version}`}>v{String(meta.versions.app_version)} · moteur {String(meta.versions.engine_version)}</div>}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  // Palette de commandes : Ctrl/⌘ + K partout (y compris dans un champ), ou bouton « Rechercher »
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); } };
    const ev = () => setPalette(true);
    window.addEventListener("keydown", k); window.addEventListener("tis:palette", ev);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("tis:palette", ev); };
  }, []);
  // Boucles ambiantes en pause quand l'onglet n'est pas visible
  useEffect(() => {
    const h = () => document.documentElement.classList.toggle("is-hidden", document.hidden);
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);
  // Raccourcis clavier : « g » puis lettre ; « n » = nouvelle simulation
  useEffect(() => {
    let g = false, t: number | undefined;
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable], [role=combobox]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (g) {
        const m = NAV.find((n) => n.key === `g ${e.key}`);
        if (m) { nav(m.to); e.preventDefault(); }
        g = false; return;
      }
      if (e.key === "g") { g = true; clearTimeout(t); t = window.setTimeout(() => (g = false), 900); }
      if (e.key === "n") { nav("/simulation"); e.preventDefault(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [nav]);
  return (
    <div className="min-h-screen bg-ivory">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[243px] border-r border-line lg:block"><ResearchSidebar /></aside>
      {/* mobile / tablette */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-[#F3F4EF]/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="scale-[0.72] origin-left"><Logo /></div>
        <button aria-label="Ouvrir la navigation" aria-expanded={open} onClick={() => setOpen(true)} className="rounded p-2 hover:bg-sage"><Menu size={22} /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[260px] border-r border-line shadow-xl">
            <button aria-label="Fermer la navigation" onClick={() => setOpen(false)} className="absolute right-2 top-2 z-10 rounded p-2 hover:bg-sage"><X size={20} /></button>
            <ResearchSidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      {palette && <Suspense fallback={null}><CommandPalette open={palette} onOpenChange={setPalette} /></Suspense>}
      <main id="main" className="lg:pl-[243px] print:!pl-0">
        <div className="mx-auto w-full max-w-[1640px] px-4 pb-8 pt-6 sm:px-6 lg:px-[30px] lg:pt-[14px] 2xl:px-10 print:max-w-none print:px-0"><div key={loc.pathname} className="m-route">{children}</div></div>
      </main>
    </div>
  );
}

export function StudyHeader({ crumb, title, subtitle, actions }: { crumb: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-4">
          <span className="eyebrow whitespace-nowrap">{crumb}</span>
          <span aria-hidden className="hidden h-px w-full max-w-[440px] bg-[#9AA59D] sm:block" />
        </div>
        <h1 className="mt-1.5 font-serif text-[32px] font-semibold leading-[1.08] tracking-[-0.012em] text-ink sm:text-[40px] lg:text-[44px]">{title}</h1>
        {subtitle && <p className="mt-1.5 font-serif text-[18px] tracking-[0.04em] text-ink sm:text-[21px]">{subtitle}</p>}
      </div>
      <div className="no-print flex shrink-0 flex-wrap gap-3 md:pt-6">
        {actions ?? (
          <>
            <Button size="lg" icon={<Download size={19} strokeWidth={1.6} />} onClick={() => nav("/publications")}>Exporter le rapport</Button>
            <Button size="lg" variant="primary" icon={<Plus size={20} strokeWidth={1.8} />} onClick={() => nav("/simulation")}>Nouvelle simulation</Button>
          </>
        )}
      </div>
    </header>
  );
}

const TABS = [
  { to: "/", label: "Vue d’ensemble" },
  { to: "/protocole", label: "Protocole" },
  { to: "/comparaison", label: "Comparaison" },
  { to: "/resultats", label: "Analyses" },
];
export function StudyTabs() {
  return (
    <nav aria-label="Sections de l'étude" className="no-print -mx-4 mt-4 overflow-x-auto border-b border-line px-4 pb-2.5 sm:mx-0 sm:px-0">
      <ul className="flex w-max items-center">
        {TABS.map((t, i) => (
          <li key={t.to} className="flex items-center">
            {i > 0 && <span aria-hidden className="mx-1 h-5 w-px bg-[#B9C2B8] sm:mx-2" />}
            <NavLink to={t.to} end
              className={({ isActive }) => `block whitespace-nowrap rounded-[5px] px-4 py-2 text-[15px] transition-colors sm:px-7 ${isActive ? "bg-botanic text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]" : "text-ink hover:bg-sage-soft"}`}>
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
