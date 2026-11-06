import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import * as RSelect from "@radix-ui/react-select";
import * as RTooltip from "@radix-ui/react-tooltip";
import * as RCollapsible from "@radix-ui/react-collapsible";
import katex from "katex";
import { Check, ChevronDown, ChevronUp, CircleHelp, Loader2, X } from "../icons";
import { STATUS_LABEL } from "../lib/format";
import type { Status } from "../lib/api";

/* ---------------------------------------------------------------- Boutons */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; icon?: ReactNode };
export function Button({ variant = "outline", size = "md", icon, className = "", children, ...rest }: BtnProps) {
  const v = {
    primary: "bg-forest text-white hover:bg-[#0F4A32] border border-forest shadow-[0_1px_0_rgba(0,0,0,0.08)]",
    outline: "bg-white text-ink border border-[#AEB8AE] hover:border-ink",
    ghost: "text-ink hover:bg-sage-soft border border-transparent",
    danger: "bg-white text-cherry border border-cherry/40 hover:bg-blush",
  }[variant];
  const s = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-[14px] gap-2", lg: "h-[46px] px-6 text-[15px] gap-2.5" }[size];
  return (
    <button type="button" className={`inline-flex items-center justify-center rounded-[5px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${v} ${s} ${className}`} {...rest}>
      {icon}{children}
    </button>
  );
}

/* ---------------------------------------------------------------- Select */
export function Select({ value, onChange, options, label, icon, id, className = "" }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string; icon?: ReactNode }[];
  label: string; icon?: ReactNode; id?: string; className?: string;
}) {
  const cur = options.find((o) => o.value === value);
  return (
    <RSelect.Root value={value} onValueChange={onChange}>
      <RSelect.Trigger id={id} aria-label={label}
        className={`inline-flex h-9 w-full items-center justify-between gap-2 rounded-[5px] border border-line bg-white px-2.5 text-[13.5px] text-ink hover:border-[#AEB8AE] data-[state=open]:border-botanic ${className}`}>
        <span className="flex min-w-0 items-center gap-2 truncate">{cur?.icon ?? icon}<RSelect.Value /></span>
        <RSelect.Icon><ChevronDown size={15} className="text-ink" /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content position="popper" sideOffset={4} className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line bg-white shadow-lg">
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item key={o.value} value={o.value} className="relative flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 pl-7 text-[13.5px] outline-none data-[highlighted]:bg-sage-soft">
                <RSelect.ItemIndicator className="absolute left-2"><Check size={13} /></RSelect.ItemIndicator>
                {o.icon}<RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

/* ---------------------------------------------------------------- Segmented */
export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-[5px] border border-line bg-white p-[3px]"
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value);
        if (e.key === "ArrowRight") onChange(options[(i + 1) % options.length].value);
        if (e.key === "ArrowLeft") onChange(options[(i - 1 + options.length) % options.length].value);
      }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onChange(o.value)}
            className={`flex-1 rounded-[4px] ${size === "sm" ? "h-7 text-[12.5px]" : "h-8 text-[13px]"} px-2 transition-colors ${on ? "bg-botanic text-white shadow-sm" : "text-ink hover:bg-sage-soft"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- NumberField */
export function NumberField({ value, onChange, min, max, step = 1, label, icon, unit, id, invalid, thousands }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string;
  icon?: ReactNode; unit?: string; id?: string; invalid?: boolean; thousands?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const pretty = thousands && !focused && Number.isFinite(value);
  const clampStep = (d: number) => {
    const nv = Number((value + d).toFixed(6));
    onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, nv)));
  };
  return (
    <div className={`flex h-9 w-full items-center rounded-[5px] border bg-white ${invalid ? "border-cherry" : "border-line focus-within:border-botanic"}`}>
      {icon && <span className="pl-2.5 text-ink">{icon}</span>}
      <input id={id} aria-label={label} aria-invalid={invalid || undefined} type={pretty ? "text" : "number"} inputMode="decimal"
        value={pretty ? new Intl.NumberFormat("fr-FR").format(value) : Number.isFinite(value) ? value : ""}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        min={min} max={max} step={step}
        onChange={(e) => { const raw = e.target.value.replace(/[\s\u202f\u00a0]/g, "").replace(",", "."); onChange(raw === "" ? NaN : Number(raw)); }}
        className="tnum h-full min-w-0 flex-1 bg-transparent px-2.5 text-[13.5px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      {unit && <span className="pr-1 text-[12px] text-muted whitespace-nowrap">{unit}</span>}
      <div className="flex h-full flex-col border-l border-line">
        <button type="button" tabIndex={-1} aria-label={`Augmenter ${label}`} onClick={() => clampStep(step)} className="flex flex-1 items-center px-1.5 hover:bg-sage-soft"><ChevronUp size={12} /></button>
        <button type="button" tabIndex={-1} aria-label={`Diminuer ${label}`} onClick={() => clampStep(-step)} className="flex flex-1 items-center px-1.5 hover:bg-sage-soft"><ChevronDown size={12} /></button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Tooltip scientifique */
export function ScientificTooltip({ children, content, side = "top" }: { children?: ReactNode; content: ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <RTooltip.Root delayDuration={150}>
      <RTooltip.Trigger asChild>
        {children ?? <button type="button" aria-label="Aide" className="inline-flex text-muted hover:text-forest"><CircleHelp size={13} /></button>}
      </RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} className="z-50 max-w-72 rounded-md border border-line bg-white px-3 py-2 text-[12px] leading-relaxed text-ink shadow-lg">
          {content}
          <RTooltip.Arrow className="fill-white" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/* ---------------------------------------------------------------- Formules */
export function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = useMemo(() => katex.renderToString(children, { displayMode: block, throwOnError: false, output: "html" }), [children, block]);
  return <span className={block ? "block overflow-x-auto py-1" : ""} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------------------------------------------------------------- Statut */
const STATUS_STYLE: Record<Status, string> = {
  ready: "bg-[#EEF1EC] text-muted border-line",
  queued: "bg-[#EAF1F5] text-analytic border-[#C9D8E1]",
  running: "bg-sage text-forest border-[#B9D3BF]",
  completed: "bg-white text-forest border-[#B9D3BF]",
  cancelled: "bg-[#F7F1E6] text-[#7A5A1F] border-[#E5D3AE]",
  error: "bg-blush text-cherry border-[#EBC2B8]",
};
export function ExperimentStatus({ status, progress }: { status: Status; progress?: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${STATUS_STYLE[status]}`}>
      {status === "running" || status === "queued" ? <Loader2 size={11} className="animate-spin" aria-hidden /> :
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status === "completed" ? "bg-botanic" : status === "error" ? "bg-cherry" : status === "cancelled" ? "bg-[#B8862B]" : "bg-muted"}`} />}
      {STATUS_LABEL[status]}{status === "running" && progress != null ? ` · ${Math.round(progress * 100)} %` : ""}
    </span>
  );
}

/* ---------------------------------------------------------------- Panneaux */
export function Panel({ children, className = "", as: As = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return <As className={`panel ${className}`} {...rest}>{children}</As>;
}
export function PanelTitle({ children, icon, right, sub }: { children: ReactNode; icon?: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5 text-ink">{icon}</span>}
        <div>
          <h2 className="font-serif text-[21px] font-semibold leading-tight tracking-[-0.005em] text-ink">{children}</h2>
          {sub && <p className="mt-0.5 font-serif text-[13.5px] text-muted">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Collapsible({ title, children, defaultOpen = false, badge }: { title: string; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <RCollapsible.Root open={open} onOpenChange={setOpen} className="border-t border-line">
      <RCollapsible.Trigger className="flex w-full items-center justify-between py-3 text-left text-[13.5px] font-medium text-ink hover:text-forest">
        <span className="flex items-center gap-2">{title}{badge}</span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </RCollapsible.Trigger>
      <RCollapsible.Content className="pb-4">{children}</RCollapsible.Content>
    </RCollapsible.Root>
  );
}

export function EmptyState({ title, children, action, illustration }: { title: string; children?: ReactNode; action?: ReactNode; illustration?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      {illustration}
      <h3 className="font-serif text-[18px] font-semibold">{title}</h3>
      {children && <div className="max-w-md text-[13.5px] leading-relaxed text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "terracotta" | "blue" | "demo" }) {
  const t = { neutral: "bg-[#EEF1EC] text-muted", green: "bg-sage text-forest", terracotta: "bg-blush text-[#8E3519]", blue: "bg-[#EAF1F5] text-analytic", demo: "bg-[#FFF3D6] text-[#7A5A1F]" }[tone];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}

/* ---------------------------------------------------------------- Notifications */
interface Toast { id: number; msg: string; tone: "info" | "success" | "error" }
const ToastCtx = createContext<(msg: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 no-print" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`flex max-w-sm items-start gap-2 rounded-md border bg-white px-3.5 py-2.5 text-[13px] shadow-lg ${t.tone === "error" ? "border-cherry/40" : t.tone === "success" ? "border-botanic/40" : "border-line"}`}>
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${t.tone === "error" ? "bg-cherry" : t.tone === "success" ? "bg-botanic" : "bg-analytic"}`} />
            <span className="flex-1">{t.msg}</span>
            <button aria-label="Fermer" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-muted hover:text-ink"><X size={13} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
