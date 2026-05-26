import threecx from "@omniyat/3cx-module";
import { env } from "./env";

const { ThreeCXModule } = threecx as any;

let initialized = false;

export async function init3CX(): Promise<void> {
  if (initialized) return;

  if (env.THREECX_BASE_URL && env.THREECX_CLIENT_ID && env.THREECX_CLIENT_SECRET) {
    threecx.init({
      baseUrl: env.THREECX_BASE_URL,
      clientId: env.THREECX_CLIENT_ID,
      clientSecret: env.THREECX_CLIENT_SECRET,
      timeout: 30000,
    });
    initialized = true;
    console.log("[3CX] Module initialise avec OAuth2 client_credentials");
  } else {
    console.log("[3CX] Pas de credentials .env — mode dynamique (credentials via URL)");
  }
}

// Cache des instances par combo baseUrl+clientId+clientSecret
const moduleCache = new Map<string, any>();

export function getModuleForCredentials(baseUrl: string, clientId: string, clientSecret: string) {
  const key = `${baseUrl}|${clientId}|${clientSecret}`;
  let instance = moduleCache.get(key);
  if (!instance) {
    instance = new ThreeCXModule();
    instance.init({ baseUrl, clientId, clientSecret, timeout: 30000 });
    moduleCache.set(key, instance);
  }
  return instance;
}

export { threecx };
