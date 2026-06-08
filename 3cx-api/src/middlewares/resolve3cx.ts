import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { getModuleForCredentials } from "../config/3cx";
import type { I3CXModule } from "../types/i3cx-module";

declare global {
  namespace Express {
    interface Request {
      threecx: I3CXModule;
    }
  }
}

/**
 * Middleware qui resout le module 3CX pour chaque requete.
 *
 * Les 3 credentials (baseUrl, clientId, clientSecret) sont obligatoires.
 * Chacun peut venir des headers HTTP ou du .env en fallback.
 * Headers attendus : x-3cx-base-url, x-3cx-client-id, x-3cx-client-secret
 * Si l'un des trois manque → 401.
 */
export function resolve3cx(req: Request, res: Response, next: NextFunction): void {
  const baseUrl =
    (req.header("x-3cx-base-url") as string) ||
    env.THREECX_BASE_URL;
  const clientId =
    (req.header("x-3cx-client-id") as string) ||
    env.THREECX_CLIENT_ID;
  const clientSecret =
    (req.header("x-3cx-client-secret") as string) ||
    env.THREECX_CLIENT_SECRET;

  if (!baseUrl || !clientId || !clientSecret) {
    const missing = [
      !baseUrl && "x-3cx-base-url",
      !clientId && "x-3cx-client-id",
      !clientSecret && "x-3cx-client-secret",
    ].filter(Boolean);

    res.status(401).json({
      error: "Credentials 3CX manquants",
      missing,
      hint: "Fournir x-3cx-base-url, x-3cx-client-id et x-3cx-client-secret en headers HTTP ou dans le .env",
    });
    return;
  }

  try {
    req.threecx = getModuleForCredentials(baseUrl, clientId, clientSecret) as unknown as I3CXModule;
    next();
  } catch (err: any) {
    res.status(400).json({ error: "Credentials 3CX invalides", details: err.message });
  }
}
