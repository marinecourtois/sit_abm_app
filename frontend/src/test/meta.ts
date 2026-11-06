// Registre réel du backend (GET /api/meta), figé dans fixtures/meta.json.
// Sa conformité au moteur est vérifiée côté Python par tests/test_frontend_contract.py.
import raw from "./fixtures/meta.json";
import type { Meta } from "../lib/api";
export const META = raw as unknown as Meta;
