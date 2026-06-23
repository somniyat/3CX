import defaultInstance, { ThreeCXModule } from "../module";
import { LRUCache } from "lru-cache";
import { env } from "./env";
import { logger } from "./logger";

let initialized = false;

export async function init3CX(): Promise<void> {
  if (initialized) return;

  if (env.THREECX_BASE_URL && env.THREECX_CLIENT_ID && env.THREECX_CLIENT_SECRET) {
    defaultInstance.init({
      baseUrl: env.THREECX_BASE_URL,
      clientId: env.THREECX_CLIENT_ID,
      clientSecret: env.THREECX_CLIENT_SECRET,
      timeout: 30000,
    });
    initialized = true;
    logger.info("[3CX] Module initialise avec OAuth2 client_credentials");
  } else {
    logger.info("[3CX] Pas de credentials .env — mode dynamique (credentials via headers)");
  }
}

// LRU cache : max 50 instances, TTL 30 minutes
const moduleCache = new LRUCache<string, ThreeCXModule>({
  max: 50,
  ttl: 30 * 60 * 1000,
  dispose(_value, key) {
    logger.debug({ key: key.split("|")[0] }, "Instance 3CX module evictee du cache");
  },
});

export function getModuleForCredentials(baseUrl: string, clientId: string, clientSecret: string): ThreeCXModule {
  const key = `${baseUrl}|${clientId}|${clientSecret}`;
  let instance = moduleCache.get(key);
  if (!instance) {
    instance = new ThreeCXModule();
    instance.init({ baseUrl, clientId, clientSecret, timeout: 30000 });
    moduleCache.set(key, instance);
    logger.debug({ baseUrl }, "Nouvelle instance 3CX module creee");
  }
  return instance;
}

export { defaultInstance as threecx };
