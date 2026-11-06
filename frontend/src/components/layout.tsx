import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, FlaskConical, Home, Layers, Menu, Play, X, Download, Plus } from "../icons";
import { FieldLandscape, LeafMark, SeedlingIcon } from "../illustrations";
import { Button } from "./ui";

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
    <div className="flex items-center gap-2.5">
      <LeafMark width={44} height={44} aria-hidden />
      <div className="leading-none">
        <div className="font-serif text-[30px] font-semibold tracking-[-0.01em] text-ink">Modelly</div>
        <div className="mt-1 font-serif text-[15px] text-muted">TIS Research</div>
      </div>
    </div>
  );
}

export function ResearchSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigation principale" className="flex h-full flex-col bg-[linear-gradient(180deg,#F4F5EF_0%,#EFF2EA_55%,#E4ECE0_100%)]">
      <div className="px-7 pt-7 pb-10"><Logo /></div>
      <ul className="flex flex-col gap-2 px-3.5">
        {NAV.map((n) => (
          <li key={n.to}>
            <NavLink to={n.to} end={n.to === "/"} onClick={onNavigate}
              className={({ isActive }) => `flex items-center gap-3.5 rounded-[7px] px-3.5 py-2.5 text-[16px] transition-colors ${isActive ? "bg-sage text-forest font-medium" : "text-ink hover:bg-[#E8EDE6]"}`}>
              <n.icon size={23} strokeWidth={1.45} aria-hidden />
              {n.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="relative mt-auto">
        <FieldLandscape className="pointer-events-none block h-[430px] w-full" preserveAspectRatio="xMaxYMax slice" aria-hidden />
        <div className="absolute inset-x-3.5 bottom-4 rounded-md border border-line bg-white/92 px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-[2px]">
          <div className="flex items-start gap-2.5">
            <SeedlingIcon width={22} height={22} className="mt-0.5 text-forest" aria-hidden />
            <div>
              <div className="text-[13.5px] font-semibold text-forest">Modélisation TIS</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-muted">Dynamique des populations et optimisation des lâchers</div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
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
      <main id="main" className="lg:pl-[243px] print:!pl-0">
        <div className="mx-auto w-full max-w-[1640px] px-4 pb-8 pt-6 sm:px-6 lg:px-[30px] lg:pt-[14px] 2xl:px-10 print:max-w-none print:px-0">{children}</div>
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
