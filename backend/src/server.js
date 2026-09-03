import { createApp } from "./app.js";
import env from "./config/env.js";
import logger from "./lib/logger.js";
import { runMigrations } from "./db/migrate.js";
import { closePool } from "./lib/db.js";
import { purgeSessions } from "./modules/auth/service.js";
import { purger as purgerNotifications } from "./modules/notifications/service.js";
import { purgeExpired } from "./lib/cache.js";

const INTERVALLE_ENTRETIEN = 6 * 3600 * 1000;

const entretien = async () => {
  try {
    await Promise.all([purgeSessions(), purgerNotifications(), purgeExpired()]);
  } catch (err) {
    logger.warn({ err: err.message }, "Tache d'entretien en échec");
  }
};

const demarrer = async () => {
  await runMigrations();

  const app = createApp();
  const serveur = app.listen(env.PORT, () => {
    logger.info(
      `EduFlow API demarree sur http://localhost:${env.PORT}/api/v1 ` +
        `(env: ${env.NODE_ENV}, IA: ${env.aiEnabled ? "activee" : "desactivee"}, demo: ${env.ALLOW_DEMO_ACCOUNTS})`,
    );
  });

  const minuteur = setInterval(entretien, INTERVALLE_ENTRETIEN);
  entretien();

  const arreter = async (signal) => {
    logger.info(`${signal} recu, arret en cours...`);
    clearInterval(minuteur);
    serveur.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => arreter("SIGTERM"));
  process.on("SIGINT", () => arreter("SIGINT"));
};

demarrer().catch((err) => {
  logger.error({ err }, "Demarrage impossible");
  process.exit(1);
});
