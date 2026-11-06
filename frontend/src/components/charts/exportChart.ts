// Export des figures : SVG vectoriel, PNG haute résolution, « format publication ».
const EXPORT_FONT = "'Source Serif 4', Georgia, serif";
const EXPORT_SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export interface ExportMeta { title: string; caption?: string; filename: string }

/** Clone le SVG, inline les styles calculés utiles, ajoute titre + légende de figure. */
export function buildStandaloneSvg(svg: SVGSVGElement, meta: ExportMeta, opts: { publication?: boolean } = {}) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const w = svg.viewBox.baseVal?.width || svg.clientWidth;
  const h = svg.viewBox.baseVal?.height || svg.clientHeight;
  clone.querySelectorAll("[data-export-hide]").forEach((n) => n.remove());
  // texte : polices explicites (pas de dépendance aux feuilles de style)
  clone.querySelectorAll("text").forEach((t) => {
    const cs = getComputedStyle(svg.querySelector(`[data-tid="${t.getAttribute("data-tid")}"]`) ?? t);
    if (!t.getAttribute("font-family")) t.setAttribute("font-family", EXPORT_SANS);
    if (!t.getAttribute("font-size")) t.setAttribute("font-size", cs.fontSize || "11px");
    if (!t.getAttribute("fill")) t.setAttribute("fill", "#1B201C");
  });
  const top = 34;
  const capLines = meta.caption ? wrap(meta.caption, opts.publication ? 110 : 130) : [];
  const bottom = capLines.length ? 14 + capLines.length * 14 : 8;
  const W = w, H = h + top + bottom;
  const out = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  out.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  out.setAttribute("viewBox", `0 0 ${W} ${H}`);
  if (opts.publication) {
    // 170 mm (pleine largeur de colonne double)
    out.setAttribute("width", "170mm");
    out.setAttribute("height", `${(170 * H) / W}mm`);
  } else {
    out.setAttribute("width", String(W));
    out.setAttribute("height", String(H));
  }
  const bg = document.createElementNS(out.namespaceURI, "rect");
  bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "#FFFFFF");
  out.appendChild(bg);
  const title = document.createElementNS(out.namespaceURI, "text");
  title.setAttribute("x", "12"); title.setAttribute("y", "22");
  title.setAttribute("font-family", EXPORT_FONT); title.setAttribute("font-size", "15"); title.setAttribute("font-weight", "600");
  title.setAttribute("fill", "#1B201C");
  title.textContent = meta.title;
  out.appendChild(title);
  const g = document.createElementNS(out.namespaceURI, "g");
  g.setAttribute("transform", `translate(0 ${top})`);
  Array.from(clone.childNodes).forEach((n) => g.appendChild(n));
  out.appendChild(g);
  capLines.forEach((line, i) => {
    const t = document.createElementNS(out.namespaceURI, "text");
    t.setAttribute("x", "12"); t.setAttribute("y", String(top + h + 16 + i * 14));
    t.setAttribute("font-family", EXPORT_SANS); t.setAttribute("font-size", "10"); t.setAttribute("fill", "#4A544D");
    t.textContent = line;
    out.appendChild(t);
  });
  return { svg: new XMLSerializer().serializeToString(out), width: W, height: H };
}

function wrap(text: string, n: number) {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > n) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

export function exportSvg(svg: SVGSVGElement, meta: ExportMeta, publication = false) {
  const { svg: s } = buildStandaloneSvg(svg, meta, { publication });
  download(new Blob([s], { type: "image/svg+xml;charset=utf-8" }), `${meta.filename}${publication ? "-publication" : ""}.svg`);
}

export async function exportPng(svg: SVGSVGElement, meta: ExportMeta, opts: { publication?: boolean; scale?: number } = {}) {
  const { svg: s, width, height } = buildStandaloneSvg(svg, meta, { publication: false });
  // publication : 170 mm à 600 dpi ≈ 4016 px de large
  const targetW = opts.publication ? 4016 : width * (opts.scale ?? 3);
  const k = targetW / width;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([s], { type: "image/svg+xml;charset=utf-8" }));
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("Rendu PNG impossible")); img.src = url; });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * k); canvas.height = Math.round(height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png"));
  download(blob, `${meta.filename}${opts.publication ? "-publication-600dpi" : `@${opts.scale ?? 3}x`}.png`);
}

export function downloadText(content: string, filename: string, type = "text/csv") {
  download(new Blob([content], { type: `${type};charset=utf-8` }), filename);
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map((v) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}
