import type { ReactNode } from "react";
import { useMeta } from "../lib/meta";
import { fmtInt } from "../lib/format";
import type { Meta } from "../lib/api";
import { StudyHeader, StudyTabs } from "../components/layout";
import { Panel, Tex } from "../components/ui";
import { ResearchAnnotation } from "../components/science";

const SECTIONS = [["hypotheses", "Hypothèses"], ["parametres", "Paramètres"], ["modele", "Modèle"], ["methodologie", "Méthodologie"], ["limites", "Limites"], ["references", "Références"]];

function Sec({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 print-page">
      <h2 className="flex items-baseline gap-3 font-serif text-[26px] font-semibold"><span className="font-serif text-[15px] text-botanic">{String(n).padStart(2, "0")}</span>{title}</h2>
      <div className="mt-3 space-y-3 font-serif text-[16px] leading-[1.65] text-ink">{children}</div>
    </section>
  );
}

export function ProtocolViewer({ meta }: { meta: Meta }) {
  const s = meta.crops.strawberry.params as Record<string, number>, c = meta.crops.cherry.params as Record<string, number>;
  return (
    <div className="space-y-12">
      <Sec id="hypotheses" n={1} title="Hypothèses">
        <p>Le modèle est un modèle individu-centré (agent-based) à pas de temps journalier, sans structure spatiale : tous les insectes et tous les fruits d’une parcelle simulée interagissent (mélange homogène). Il représente une parcelle de {fmtInt(s.total_fruits)} fruits.</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Quatre types d’agents : mâles sauvages (W), mâles stériles (S), femelles (F) et larves (L). Les fruits sont des objets passifs portant au plus <Tex>K</Tex> pontes.</li>
          <li>Une femelle choisit son partenaire au prorata des effectifs de mâles, les mâles stériles étant pondérés par leur compétitivité <Tex>\eta</Tex>.</li>
          <li>Un accouplement stérile produit des pontes non viables : le fruit est piqué (et peut pourrir) mais aucune larve n’en sort.</li>
          <li>Les femelles peuvent se réaccoupler ; le sperme utilisé dépend du régime (préférence, premier, dernier ou mélange).</li>
          <li><strong>Fraise</strong> : production continue de {fmtInt(s.daily_fruit_production)} fruits/jour pendant {s.season_length} jours, maturation en {s.maturation_min}–{s.maturation_max} j, récolte de {Math.round((meta.biology_defaults.harvest_fraction ?? 0.9) * 100)} % des fruits mûrs et prophylaxie tous les {s.harvest_frequency} jours.</li>
          <li><strong>Cerise</strong> : stock fermé de {fmtInt(c.initial_fruits)} fruits présents à J0, maturation en {c.maturation_min}–{c.maturation_max} j, saison de {c.season_length} jours et récolte unique au jour {c.season_length - 1}, sans prophylaxie.</li>
        </ul>
        <ResearchAnnotation tone="warning">Ces descriptions des cultures sont des hypothèses de modélisation issues du notebook ; elles ne constituent pas une caractérisation agronomique des cultures réelles.</ResearchAnnotation>
      </Sec>

      <Sec id="parametres" n={2} title="Paramètres">
        <p className="text-[15px]">Paramètres exposés à l’application (modifiables en Mode Avancé). Les plages admises sont des bornes de validité technique, pas des plages d’incertitude biologique.</p>
        <div className="scroll-x rounded border border-line bg-white font-sans">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead><tr className="border-b border-line bg-[#F6F7F3] text-left text-[11.5px] text-muted"><th className="px-3 py-2 font-medium">Nom</th><th className="px-3 py-2 font-medium">Symbole</th><th className="px-3 py-2 font-medium">Unité</th><th className="px-3 py-2 text-right font-medium">Valeur</th><th className="px-3 py-2 font-medium">Plage admise</th><th className="px-3 py-2 font-medium">Source</th></tr></thead>
            <tbody>
              {meta.biology.map((p) => (
                <tr key={p.name} className="border-b border-line/70 last:border-0">
                  <td className="px-3 py-1.5">{p.description.split(".")[0]}<div className="font-mono text-[10.5px] text-muted">{p.name}</div></td>
                  <td className="px-3 py-1.5"><Tex>{p.symbol}</Tex></td><td className="px-3 py-1.5 text-muted">{p.unit}</td>
                  <td className="px-3 py-1.5 text-right tnum">{String(p.default).replace(".", ",")}</td><td className="px-3 py-1.5 tnum text-muted">[{p.min} ; {p.max}]</td>
                  <td className="px-3 py-1.5 font-mono text-[10.5px] text-muted">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="pt-2 font-serif text-[18px] font-semibold">Constantes fixes du modèle</h3>
        <div className="scroll-x rounded border border-line bg-white font-sans">
          <table className="w-full min-w-[640px] text-[12.5px]"><tbody>
            {meta.fixed_constants.map((k) => (
              <tr key={k.name} className="border-b border-line/70 last:border-0"><td className="px-3 py-1.5">{k.name}</td><td className="px-3 py-1.5"><Tex>{k.symbol}</Tex></td><td className="px-3 py-1.5 tnum">{k.value}</td><td className="px-3 py-1.5 text-muted">{k.unit}</td><td className="px-3 py-1.5 font-mono text-[10.5px] text-muted">{k.source}</td></tr>
            ))}
          </tbody></table>
        </div>
        <h3 className="pt-2 font-serif text-[18px] font-semibold">Paramètres des cultures <span className="font-sans text-[12px] font-normal text-muted">(CropParameters, cellule 2)</span></h3>
        <div className="scroll-x rounded border border-line bg-white font-sans">
          <table className="w-full min-w-[560px] text-[12.5px]">
            <thead><tr className="border-b border-line bg-[#F6F7F3] text-left text-[11.5px] text-muted"><th className="px-3 py-2 font-medium">Champ</th><th className="px-3 py-2 text-right font-medium">Fraise</th><th className="px-3 py-2 text-right font-medium">Cerise</th><th className="px-3 py-2 font-medium">Unité</th></tr></thead>
            <tbody>{Object.keys(s).filter((k) => k !== "name").map((k) => (
              <tr key={k} className="border-b border-line/70 last:border-0"><td className="px-3 py-1.5 font-mono text-[11px]">{k}</td><td className="px-3 py-1.5 text-right tnum">{fmtInt(s[k])}</td><td className="px-3 py-1.5 text-right tnum">{fmtInt(c[k])}</td>
                <td className="px-3 py-1.5 text-muted">{/fruits|production/.test(k) ? (k === "daily_fruit_production" ? "fruits / jour" : "fruits") : /frequency/.test(k) ? "jours (0 = aucune)" : "jours"}</td></tr>))}</tbody>
          </table>
        </div>
      </Sec>

      <Sec id="modele" n={3} title="Modèle">
        <h3 className="font-serif text-[18px] font-semibold">Accouplement</h3>
        <p>Lorsqu’elle est réceptive, une femelle s’accouple avec un mâle sauvage avec la probabilité</p>
        <Tex block>{"P(\\text{accouplement fertile}) = \\frac{W}{W + \\eta\\, S}"}</Tex>
        <p>puis observe une période réfractaire <Tex>{"R_f \\sim \\mathcal{U}\\{3,\\dots,12\\}"}</Tex> jours (fertile) ou <Tex>{"R_s \\sim \\mathcal{U}\\{4,\\dots,10\\}"}</Tex> jours (stérile). En régime « préférence », chaque œuf est fécondé par du sperme fertile avec la probabilité</p>
        <Tex block>{"P(\\text{œuf fertile}) = \\frac{n_f}{n_f + \\eta_s\\, n_s}"}</Tex>
        <p>où <Tex>n_f</Tex> et <Tex>n_s</Tex> sont les nombres d’accouplements fertiles et stériles de la femelle.</p>
        <h3 className="font-serif text-[18px] font-semibold">Ponte</h3>
        <p>Chaque jour, une femelle pond <Tex>{"N = \\min(\\mathrm{Poisson}(6),\\,6)"}</Tex> œufs répartis sur <Tex>{"\\min(\\mathcal{U}\\{1..6\\}, N)"}</Tex> fruits tirés parmi ceux qui ont de la place. Une ponte réussit avec la probabilité <Tex>p_y</Tex> sur un fruit jeune, 1 sur un fruit mûr et <Tex>p_r</Tex> sur un fruit pourri.</p>
        <h3 className="font-serif text-[18px] font-semibold">Pourrissement</h3>
        <p>Un fruit pourrit si l’une des trois conditions est remplie : sénescence naturelle (âge ≥ durée de vie tirée uniformément), déclenchement par piqûre, ou charge larvaire. La probabilité journalière de pourrissement par piqûre est</p>
        <Tex block>{"P = 1 - e^{-h}, \\qquad h = \\begin{cases} h_f & \\text{si au moins une ponte fertile} \\\\ h_s & \\text{si uniquement des pontes stériles}\\end{cases}"}</Tex>
        <p>et le score larvaire, sur l’ensemble <Tex>V</Tex> des larves fertiles vivantes nées aux dates <Tex>c_i</Tex>,</p>
        <Tex block>{"S(t) = \\sum_{i \\in V} \\big[\\,1 + w\\,(t - c_i)\\,\\big], \\qquad \\text{pourri si } S(t) \\ge \\theta"}</Tex>
        <h3 className="font-serif text-[18px] font-semibold">Survie et développement</h3>
        <p>Les durées de vie adultes suivent une loi normale tronquée à 1 jour : <Tex>{"T \\sim \\mathcal{N}(\\bar T, (CV_T\\,\\bar T)^2),\\ T \\ge 1"}</Tex>, arrondie au jour. À J0, les adultes initiaux reçoivent un âge <Tex>{"\\mathcal{U}\\{0..T-1\\}"}</Tex>. Les larves meurent selon une suite de tirages séquentiels (0,132 ; 0,087 ; 0,048 ; 0,100 ; 0,056) ou émergent après <Tex>{"\\mathcal{U}\\{6..11\\}"}</Tex> jours, mâles ou femelles avec un sex-ratio de 0,5.</p>
        <h3 className="font-serif text-[18px] font-semibold">Calendriers de lâchers</h3>
        <p>Pour un budget <Tex>B</Tex> et une saison de <Tex>L</Tex> jours :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>Quotidien</strong> : <Tex>{"\\lfloor B/L \\rfloor"}</Tex> stériles par jour, +1 pour les <Tex>{"B \\bmod L"}</Tex> premiers jours.</li>
          <li><strong>J+3 / J+7</strong> : même répartition sur les jours <Tex>{"0, k, 2k, \\dots < L"}</Tex>.</li>
          <li><strong>70 % initial + maintenance</strong> : <Tex>{"\\mathrm{round}(0{,}7\\,B)"}</Tex> à J0, le reste réparti tous les 7 jours à partir de J7.</li>
          <li><strong>100 % initial</strong> : <Tex>B</Tex> à J0.</li>
        </ul>
        <h3 className="font-serif text-[18px] font-semibold">Ordre des opérations d’une journée</h3>
        <ol className="list-decimal space-y-1 pl-6">
          <li>Production des nouveaux fruits (fraise), puis lâcher des stériles prévus ce jour.</li>
          <li>Activation de tous les agents dans un ordre aléatoire (mort, émergence, accouplement, ponte).</li>
          <li>Mise à jour de l’état de chaque fruit (un tirage de pourrissement par jour).</li>
          <li>Récolte et prophylaxie selon le calendrier de la culture.</li>
          <li>Enregistrement de l’état : la valeur « jour t » est l’état au matin du jour t.</li>
        </ol>
      </Sec>

      <Sec id="methodologie" n={4} title="Méthodologie">
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>Plan factoriel du notebook</strong> : 2 cultures × 3 pressions d’invasion ({Object.values(meta.invasions).map((i) => i.label).join(", ")}) × budgets {meta.budget_presets.map(fmtInt).join(" / ")} × 2 régimes (preference, first) × stratégies × 3 répétitions, soit 576 saisons. Le témoin n’est simulé qu’au budget 0.</li>
          <li><strong>Graines</strong> : dans le plan du notebook, <Tex>{"s = 42 + 1000\\,r + 7B + 13\\,|\\text{stratégie}| + 19\\,|\\text{invasion}|"}</Tex>. Dans l’application, la répétition <Tex>r</Tex> utilise <Tex>{"s_0 + 1000\\,r"}</Tex> pour tous les scénarios d’une même expérience (nombres aléatoires communs), ce qui permet une comparaison appariée au témoin.</li>
          <li><strong>Générateur</strong> : Mersenne Twister (<code className="font-mono text-[13px]">modelly.FastRandom</code>), identique tirage pour tirage à <code className="font-mono text-[13px]">random.Random(seed)</code>.</li>
          <li><strong>Indicateurs</strong> : en % des {fmtInt(s.total_fruits)} fruits produits — récoltés (sains, piqûres stériles seules, avec larves), pourris (avec larves, piqûres stériles seules, sénescence), restés sur la plante ; larves produites. L’application ajoute les dommages larvaires (fruits avec ≥ 1 ponte fertile, quel que soit leur devenir) et la part des pontes stériles.</li>
          <li><strong>Extraction et validation</strong> : le moteur Python de l’application est extrait des cellules 2 à 5 du notebook sans modification des équations. Les tests de non-régression reproduisent à l’identique (égalité binaire des flottants) un échantillon du plan factoriel, les dynamiques journalières et la sortie de la cellule de test rapide.</li>
        </ul>
      </Sec>

      <Sec id="limites" n={5} title="Limites">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Trois répétitions par scénario dans le plan du notebook : les écarts-types sont des estimations grossières et aucun test statistique n’est appliqué.</li>
          <li>Absence d’espace : pas de dispersion, de migration, d’hétérogénéité de parcelle ni d’immigration de ravageurs en cours de saison.</li>
          <li>Le budget est exprimé en nombre de mâles stériles lâchés ; aucun coût de production ou de logistique n’est modélisé.</li>
          <li>L’origine bibliographique des valeurs numériques des paramètres n’est pas documentée dans le notebook ; ces valeurs doivent être considérées comme des hypothèses de travail.</li>
          <li>Les populations sont simulées à l’échelle 30 (cellule 2) ; le modèle raisonnant en rapports, les moyennes varient peu avec l’échelle mais la variabilité entre répétitions diminue.</li>
          <li>Les résultats sont propres aux hypothèses de culture du modèle et ne se transposent pas directement à des vergers ou des parcelles réelles.</li>
        </ul>
      </Sec>

      <Sec id="references" n={6} title="Références">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Notebook source : <em>Notebook_ABM_TIS_Optimise_Modelly.ipynb</em> — « ABM — Comparaison Fraises × Cerises : Pression d’Invasion, Budgets TIS et Réaccouplement ». Fichiers de résultats : sha256 974eab8e7659… (plan factoriel) et cb01eac6d360… (dynamiques).</li>
          <li>Labbetoul et al. (2025) — cité dans le notebook (cellule 19) à propos de l’inoculation de pathogènes par les piqûres stériles. La référence complète n’est pas fournie dans le notebook.</li>
          <li>Modelly {String(meta.versions.modelly_version)} (paquet <code className="font-mono text-[13px]">modelly-abm</code>), portage du modèle initialement écrit pour Mesa 2.3.</li>
        </ul>
        <p className="font-sans text-[12px] text-muted">Aucune autre référence n’est mentionnée par le notebook ; l’application n’en ajoute pas.</p>
      </Sec>
    </div>
  );
}

export function Protocol() {
  const meta = useMeta();
  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Étude 01" title="Protocole scientifique" subtitle="Hypothèses, paramètres, équations et traçabilité du modèle" />
      <StudyTabs />
      <div className="mt-6 grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Sommaire" className="no-print lg:sticky lg:top-6 lg:self-start">
          <ol className="space-y-1 text-[13.5px]">{SECTIONS.map(([id, l], i) => <li key={id}><a href={`#${id}`} className="flex gap-2 rounded px-2 py-1 hover:bg-sage-soft"><span className="text-muted tnum">{i + 1}.</span>{l}</a></li>)}</ol>
          <div className="mt-4 rounded border border-line bg-white px-3 py-2 text-[11.5px] text-muted">Moteur {meta?.engine_version}<br />Paramètres {meta?.params_version}<br />Schéma v{meta?.schema_version}</div>
        </nav>
        <Panel className="px-6 py-8 sm:px-10">{meta ? <ProtocolViewer meta={meta} /> : <div className="skeleton h-96" />}</Panel>
      </div>
    </>
  );
}
