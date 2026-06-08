import { env } from "./config/env";
import { init3CX } from "./config/3cx";
import { logger } from "./config/logger";
import app from "./app";

async function bootstrap() {
  await init3CX();

  app.listen(env.PORT, () => {
    logger.info(`Serveur demarre sur le port ${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  logger.fatal(err, "Erreur fatale au demarrage");
  process.exit(1);
});
