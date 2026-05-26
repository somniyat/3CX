import threecx from "@omniyat/3cx-module";
import { env } from "./env";

let initialized = false;

export async function init3CX(): Promise<void> {
  if (initialized) return;

  threecx.init({
    baseUrl: env.THREECX_BASE_URL,
    clientId: env.THREECX_CLIENT_ID,
    clientSecret: env.THREECX_CLIENT_SECRET,
    timeout: 30000,
  });

  initialized = true;
  console.log("[3CX] Module initialise avec OAuth2 client_credentials");
}

export { threecx };
