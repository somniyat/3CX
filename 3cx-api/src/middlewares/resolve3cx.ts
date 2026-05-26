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
 * Chacun peut venir de l'URL (query param) ou du .env en fallback.
 * Si l'un des trois manque → 401.
 */
export function resolve3cx(req: Request, res: Response, next: NextFunction): void {
  const baseUrl = (req.query.baseUrl as string) || env.THREECX_BASE_URL;
  const clientId = (req.query.clientId as string) || env.THREECX_CLIENT_ID;
  const clientSecret = (req.query.clientSecret as string) || env.THREECX_CLIENT_SECRET;

  if (!baseUrl || !clientId || !clientSecret) {
    const missing = [
      !baseUrl && "baseUrl",
      !clientId && "clientId",
      !clientSecret && "clientSecret",
    ].filter(Boolean);

    res.status(401).json({
      error: "Credentials 3CX manquants",
      missing,
      hint: "Fournir baseUrl, clientId et clientSecret en query params ou dans le .env",
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
