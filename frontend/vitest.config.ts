import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Tests unitaires et de contrat du frontend (exécutés par Vitest, sélectionnés par SmartTest).
export default defineConfig({
  // racine fixée au dossier frontend : les motifs ci-dessous restent valides quand Vitest est lancé
  // depuis la racine du dépôt (SmartTest) ou depuis frontend/ (npm test)
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // SmartTest partage les cœurs entre Vitest et pytest (--maxWorkers=n) : sans minimum explicite,
    // Vitest 2 garde un minimum par défaut (cœurs − 1) supérieur à n et refuse de démarrer.
    minWorkers: 1,
  },
});
