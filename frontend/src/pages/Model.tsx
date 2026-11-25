import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMeta } from "../lib/meta";
import type { Meta } from "../lib/api";
import { fmtInt } from "../lib/format";
import { StudyHeader, StudyTabs } from "../components/layout";
import { Badge, Panel, Tex } from "../components/ui";
import { ResearchAnnotation } from "../components/science";
import { Activity, Bug, Leaf, Play, Settings, Worm } from "../icons";

const dec = (x: number) => String(x).replace(".", ",");

/** Valeur d'un paramètre biologique telle que le moteur l'utilise par défaut. */
const bio = (meta: Meta, k: string) => meta.biology_defaults[k];

interface AgentCard {
  key: string; name: string; engine: string; icon: ReactNode; tone: string;
  role: string; state: string[]; daily: ReactNode[]; params: [string, ReactNode][];
}

function agents(meta: Meta): AgentCard[] {
  const c = meta.model_constants;
  return [
    {
      key: "S", name: "Mâle stérile (S)", engine: "SterileMales_Agent", icon: <Bug size={20} />, tone: "#547B91",
      role: "Lâché selon le calendrier de la stratégie. Il n’a pas d’autre effet que d’être compté dans S : il entre en compétition avec les mâles sauvages pour les accouplements.",
      state: ["date de naissance", "date de mort"],
      daily: ["Meurt à sa date de mort, sinon reste disponible pour les accouplements."],
      params: [["Durée de vie moyenne", <><Tex>{"\\bar{T}_S"}</Tex> = {dec(bio(meta, "lifespan_sterile"))} j</>], ["Compétitivité", <><Tex>{"\\eta"}</Tex> = {dec(bio(meta, "eta"))}</>]],
    },
    {
      key: "W", name: "Mâle sauvage (W)", engine: "WildMales_Agent", icon: <Bug size={20} />, tone: "#145A3D",
      role: "Présent dès J0 (invasion) puis issu des larves qui émergent (une sur deux en moyenne). Compté dans W.",
      state: ["date de naissance", "date de mort"],
      daily: ["Meurt à sa date de mort, sinon reste disponible pour les accouplements."],
      params: [["Durée de vie moyenne", <><Tex>{"\\bar{T}_W"}</Tex> = {dec(bio(meta, "lifespan_wild"))} j</>], ["Sex-ratio à l’émergence", <>{dec(c.sex_ratio)} mâle</>]],
    },
    {
      key: "F", name: "Femelle (F)", engine: "Females_Agent", icon: <Bug size={20} />, tone: "#A83D36",
      role: "S’accouple, se réaccouple après une période réfractaire et pond dans les fruits. Le régime de réaccouplement fixe quel sperme féconde les œufs.",
      state: ["accouplements fertiles et stériles", "premier et dernier partenaire", "jours avant le prochain accouplement", "œufs pondus"],
      daily: [
        <>Si elle est réceptive : accouplement fertile avec la probabilité <Tex>{"W / (W + \\eta S)"}</Tex>, sinon stérile, puis période réfractaire.</>,
        <>Ponte : <Tex>{`\\min(\\mathrm{Poisson}(${c.eggs_poisson_mean}),\\ ${c.eggs_max_per_day})`}</Tex> œufs répartis sur 1 à {c.fruits_per_clutch_max} fruits qui ont de la place.</>,
        "Chaque œuf est fécondé ou non selon le régime ; un œuf fécondé crée une larve dans le fruit.",
      ],
      params: [
        ["Durée de vie moyenne", <><Tex>{"\\bar{T}_F"}</Tex> = {dec(bio(meta, "lifespan_female"))} j</>],
        ["Réfractaire (fertile)", `${c.refractory_fertile[0]}–${c.refractory_fertile[1]} j`],
        ["Réfractaire (stérile)", `${c.refractory_sterile[0]}–${c.refractory_sterile[1]} j`],
        ["Poids du sperme stérile", <><Tex>{"\\eta_s"}</Tex> = {dec(bio(meta, "eta_sperm_choice"))}</>],
      ],
    },
    {
      key: "L", name: "Larve (L)", engine: "Larvae_Agent", icon: <Worm size={20} />, tone: "#BF532E",
      role: "Née d’un œuf fécondé, elle vit dans son fruit, peut mourir, et émerge en adulte sauvage. Sa présence fait monter le score de pourrissement du fruit.",
      state: ["fruit hôte", "date de mort tirée", "date d’émergence"],
      daily: ["Meurt à sa date de mort éventuelle.", "À l’émergence : devient mâle sauvage ou femelle (sex-ratio)."],
      params: [["Émergence", `${c.larval_emergence[0]}–${c.larval_emergence[1]} j`],
        ["Mortalité", c.larval_mortality.map((m) => `${dec(m.p)} → J+${m.days[0]}${m.days[1] !== m.days[0] ? `…${m.days[1]}` : ""}`).join(" ; ")]],
    },
    {
      key: "fruit", name: "Fruit", engine: "Fruit_Agent", icon: <Leaf size={20} />, tone: "#347A55",
      role: "Objet passif : jeune, puis mûr (récoltable), puis pourri. Il reçoit les pontes tant qu’il a de la place.",
      state: ["âge de maturité et durée de vie tirés", "pontes fertiles et stériles", "larves vivantes", "statut"],
      daily: [
        <>Une ponte réussit avec la probabilité <Tex>{"p_y"}</Tex> sur un fruit jeune, 1 sur un fruit mûr, <Tex>{"p_r"}</Tex> sur un fruit pourri.</>,
        "Pourrit par sénescence, après une piqûre (taux journalier h) ou quand la charge larvaire dépasse le seuil θ.",
      ],
      params: [
        ["Pontes max par fruit", `${bio(meta, "fruit_capacity")}`],
        ["Réussite sur fruit jeune", <><Tex>{"p_y"}</Tex> = {dec(bio(meta, "young_puncture_probability"))}</>],
        ["Pourrissement après piqûre", <><Tex>{"h_f"}</Tex> = {dec(bio(meta, "rot_hazard_fertile"))}, <Tex>{"h_s"}</Tex> = {dec(bio(meta, "rot_hazard_sterile"))} j⁻¹</>],
        ["Seuil larvaire", <><Tex>{"\\theta"}</Tex> = {dec(bio(meta, "rotten_threshold"))}</>],
      ],
    },
  ];
}

interface Hyp { id: string; title: string; text: ReactNode; status: "notebook" | "extension" }
function hypotheses(meta: Meta): Hyp[] {
  const s = meta.crops.strawberry.params as Record<string, number>, c = meta.crops.cherry.params as Record<string, number>;
  return [
    { id: "H1", status: "notebook", title: "Parcelle homogène, sans espace, échelle 30",
      text: <>Tous les individus se rencontrent avec la même probabilité ; les effectifs sont ceux d’une parcelle de {fmtInt(s.total_fruits)} fruits (échelle {meta.model_constants.scale}).</> },
    { id: "H2", status: "notebook", title: "Compétition sexuelle proportionnelle aux effectifs",
      text: <>Une femelle réceptive s’accouple avec un mâle sauvage avec la probabilité <Tex>{"W / (W + \\eta S)"}</Tex> : les stériles comptent pour <Tex>{"\\eta"}</Tex> = {dec(bio(meta, "eta"))} sauvage.</> },
    { id: "H3", status: "notebook", title: "Réaccouplement et choix du sperme",
      text: "Les femelles se réaccouplent après une période réfractaire ; le régime (préférence, premier, dernier, mélange) fixe quel sperme féconde les œufs." },
    { id: "H4", status: "notebook", title: "Deux systèmes de culture contrastés",
      text: <>Fraise : {s.season_length} j, {fmtInt(s.daily_fruit_production)} fruits produits par jour, maturité en {s.maturation_min}–{s.maturation_max} j, récolte tous les {s.harvest_frequency} j. Cerise : {c.season_length} j, {fmtInt(c.initial_fruits)} fruits présents dès J0, maturité en {c.maturation_min}–{c.maturation_max} j, récolte unique en fin de saison.</> },
    { id: "H5", status: "notebook", title: "Budget exprimé en insectes",
      text: "Le budget est un nombre de mâles stériles lâchés par saison ; le modèle ne contient aucun coût monétaire." },
    { id: "H6", status: "extension", title: "Population fermée — ou immigration (option)",
      text: <>Dans le notebook, aucun insecte n’entre ni ne sort de la parcelle. Option hors notebook : immigration quotidienne (à partir de J1) de <Tex>{"m_W"}</Tex> mâles et <Tex>{"m_F"}</Tex> femelles fécondées (proposition de Marine : 15 / jour en fraise, 8 en cerise).</> },
    { id: "H7", status: "extension", title: "Pas de capacité de charge — ou plafond K_a (option)",
      text: <>Dans le notebook, rien ne limite la population d’adultes. Option hors notebook : une larve qui émerge alors que W + F ≥ <Tex>{"K_a"}</Tex> meurt (proposition : 3 000).</> },
    { id: "H8", status: "extension", title: "Deux stades de fruit — ou stade « tournant » (option)",
      text: <>Dans le notebook, un fruit est jeune (ponte réussie avec <Tex>{"p_y"}</Tex>) puis mûr (toujours réussie). Option hors notebook : les <Tex>{"d_t"}</Tex> derniers jours de la phase jeune, réussite avec <Tex>{"p_t"}</Tex>.</> },
  ];
}

export function Model() {
  const meta = useMeta();
  return (
    <>
      <StudyHeader crumb="Recherche agronomique / Modèle" title="Modèle et hypothèses" subtitle="Les agents, ce qu’ils font chaque jour, et les hypothèses du modèle" />
      <StudyTabs />
      {!meta ? <div className="skeleton mt-6 h-96" /> : (<>
        <div className="mt-4"><ResearchAnnotation>
          Modèle individu-centré journalier du notebook, exécuté tel quel (moteur {meta.engine_version}). Les valeurs affichées sont lues dans le registre
          du moteur ; les équations complètes sont dans le <Link className="text-forest underline" to="/protocole">Protocole</Link>.
        </ResearchAnnotation></div>

        <h2 className="mt-6 font-serif text-[22px] font-semibold">Les agents</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents(meta).map((a) => (
            <Panel key={a.key} className="px-5 py-4" style={{ borderTop: `3px solid ${a.tone}` }}>
              <div className="flex items-center gap-2.5" style={{ color: a.tone }}>{a.icon}<h3 className="font-serif text-[18px] font-semibold text-ink">{a.name}</h3></div>
              <div className="mt-0.5 font-mono text-[11px] text-muted">{a.engine}</div>
              <p className="mt-2 text-[13px] leading-snug">{a.role}</p>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">État</div>
              <p className="text-[12.5px]">{a.state.join(" · ")}</p>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Chaque jour</div>
              <ul className="list-disc space-y-0.5 pl-4 text-[12.5px] leading-snug">{a.daily.map((d, i) => <li key={i}>{d}</li>)}</ul>
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-line pt-2 text-[12px]">
                {a.params.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right tnum">{v}</dd></div>)}
              </dl>
            </Panel>
          ))}
        </div>

        <h2 className="mt-8 font-serif text-[22px] font-semibold">Une journée simulée</h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-5">
          {["Nouveaux fruits (fraise), lâchers de stériles prévus ce jour, immigration si l’option est active.",
            "Tous les insectes agissent dans un ordre tiré au hasard : mort, émergence, accouplement, ponte.",
            "Chaque fruit met à jour son état (un tirage de pourrissement au plus).",
            "Récolte et prophylaxie selon le calendrier de la culture.",
            "Enregistrement de l’état : la valeur « jour t » est l’état au matin du jour t."].map((t, i) => (
            <li key={i} className="rounded-md border border-line bg-white px-3 py-2.5 text-[12.5px] leading-snug">
              <span className="font-serif text-[20px] font-semibold text-botanic">{i + 1}</span><p className="mt-1">{t}</p></li>
          ))}
        </ol>

        <h2 className="mt-8 font-serif text-[22px] font-semibold">Hypothèses</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {hypotheses(meta).map((h) => (
            <div key={h.id} className="rounded-md border border-line bg-white px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[13.5px] font-semibold"><span className="mr-1.5 font-mono text-botanic">{h.id}</span>{h.title}</h3>
                {h.status === "notebook" ? <Badge tone="green">notebook</Badge> : <Badge tone="terracotta">option hors notebook</Badge>}
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-ink">{h.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/simulation" className="inline-flex h-9 items-center gap-1.5 rounded-[5px] bg-forest px-3.5 text-[13.5px] font-medium text-white hover:bg-[#0f4a32]"><Play size={15} />Lancer une simulation</Link>
          <Link to="/dynamiques" className="inline-flex h-9 items-center gap-1.5 rounded-[5px] border border-line bg-white px-3.5 text-[13.5px] font-medium hover:border-botanic/50"><Activity size={15} />Voir les dynamiques</Link>
          <Link to="/parametres" className="inline-flex h-9 items-center gap-1.5 rounded-[5px] border border-line bg-white px-3.5 text-[13.5px] font-medium hover:border-botanic/50"><Settings size={15} />Paramètres</Link>
        </div>
      </>)}
    </>
  );
}
