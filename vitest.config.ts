// Contournement d'un défaut de SmartTest 1.1.1 : quand le dépôt contient plusieurs projets
// (frontend Vitest + backend pytest), l'adaptateur Vitest passe `--config <racine>/vitest.config.ts`
// au lieu de `frontend/vitest.config.ts`. Ce fichier ne fait que réexporter la vraie configuration
// (dont `root` est fixé au dossier frontend). À supprimer quand SmartTest sera corrigé.
export { default } from "./frontend/vitest.config";
