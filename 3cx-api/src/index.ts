import { env } from "./config/env";
import { init3CX } from "./config/3cx";
import app from "./app";

async function bootstrap() {
  await init3CX();

  app.listen(env.PORT, () => {
    console.log(`[API] Serveur demarre sur le port ${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("[Fatal]", err);
  process.exit(1);
});
