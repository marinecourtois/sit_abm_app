const nf = (d: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmt = (v: number | null | undefined, d = 1) => (v == null || Number.isNaN(v) ? "—" : nf(d).format(v));
export const fmtInt = (v: number | null | undefined) => (v == null ? "—" : new Intl.NumberFormat("fr-FR").format(Math.round(v)));
export const fmtPct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${fmt(v, d)} %`);
export const fmtSigned = (v: number | null | undefined, d = 0) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmt(Math.abs(v), d)}`);
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const CROP_LABEL: Record<string, string> = { strawberry: "Fraise", cherry: "Cerise" };
export const STATUS_LABEL: Record<string, string> = {
  ready: "Prête", queued: "En file", running: "En cours", completed: "Terminée", cancelled: "Interrompue", error: "En erreur",
};
