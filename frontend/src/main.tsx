import React, { Suspense, lazy, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import * as RTooltip from "@radix-ui/react-tooltip";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/source-serif-4/opsz-italic.css";
import "katex/dist/katex.min.css";
import "./index.css";
import { api, type Meta } from "./lib/api";
import { MetaContext } from "./lib/meta";
import { AppShell } from "./components/layout";
import { EmptyState, Skeleton, ToastProvider } from "./components/ui";
const Overview = lazy(() => import("./pages/Overview").then((m) => ({ default: m.Overview })));
const Studio = lazy(() => import("./pages/Studio").then((m) => ({ default: m.Studio })));
const LiveSimulation = lazy(() => import("./pages/LiveSimulation").then((m) => ({ default: m.LiveSimulation })));
const Experiments = lazy(() => import("./pages/Experiments").then((m) => ({ default: m.Experiments })));
const Comparison = lazy(() => import("./pages/Comparison").then((m) => ({ default: m.Comparison })));
const Analytics = lazy(() => import("./pages/Analytics").then((m) => ({ default: m.Analytics })));
const Protocol = lazy(() => import("./pages/Protocol").then((m) => ({ default: m.Protocol })));
const Publications = lazy(() => import("./pages/Publications").then((m) => ({ default: m.Publications })));

function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.meta().then(setMeta).catch((e) => setErr(e.message)); }, []);
  return (
    <MetaContext.Provider value={meta}>
      <RTooltip.Provider>
        <ToastProvider>
          <AppShell>
            {err ? (
              <div className="mt-10"><EmptyState title="Moteur scientifique indisponible">
                Le serveur de simulation ne répond pas ({err}). Aucune donnée de démonstration n’est substituée : démarrez le backend (<code>make dev</code>) puis rechargez la page.
              </EmptyState></div>
            ) : (
              <Suspense fallback={<div className="mt-2 space-y-4" aria-busy="true" aria-label="Chargement"><Skeleton className="h-24" /><Skeleton className="h-[420px]" /></div>}>
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/experiences" element={<Experiments />} />
                <Route path="/simulation" element={<Studio />} />
                <Route path="/simulation/:id" element={<LiveSimulation />} />
                <Route path="/comparaison" element={<Comparison />} />
                <Route path="/resultats" element={<Analytics />} />
                <Route path="/protocole" element={<Protocol />} />
                <Route path="/publications" element={<Publications />} />
                <Route path="*" element={<div className="mt-10"><EmptyState title="Page introuvable" /></div>} />
              </Routes>
              </Suspense>
            )}
          </AppShell>
        </ToastProvider>
      </RTooltip.Provider>
    </MetaContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
