import demoProvider from "./demo/provider.js";
import ecoleDirecteProvider from "./ecoledirecte/provider.js";
import env from "../config/env.js";
import { badRequest } from "../lib/errors.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import { query } from "../lib/db.js";

const REGISTRE = {
  demo: demoProvider,
  ecoledirecte: ecoleDirecteProvider,
};

export const getProvider = (nom) => {
  const provider = REGISTRE[nom];
  if (!provider) throw badRequest(`Source de données inconnue : ${nom}.`);
  if (nom === "demo" && !env.ALLOW_DEMO_ACCOUNTS) {
    throw badRequest("Les comptes de démonstration sont desactives sur cette instance.");
  }
  return provider;
};

export const providersDisponibles = () =>
  Object.values(REGISTRE)
    .filter((p) => p.nom !== "demo" || env.ALLOW_DEMO_ACCOUNTS)
    .map((p) => ({ nom: p.nom, libelle: p.libelle }));

/**
 * Construit le contexte d'appel d'un provider pour un utilisateur donne.
 * Le jeton amont est dechiffre a la volee et re-chiffre s'il tourne.
 */
export const buildContext = (user) => ({
  compteId: user.provider_account_id,
  token: decrypt(user.provider_token_enc),
  meta: user.provider_meta ?? {},
  userId: user.id,
  onToken: async (nouveauToken) => {
    await query("UPDATE users SET provider_token_enc = $2, provider_synced_at = now() WHERE id = $1", [
      user.id,
      encrypt(nouveauToken),
    ]);
  },
});

export { demoProvider, ecoleDirecteProvider };
