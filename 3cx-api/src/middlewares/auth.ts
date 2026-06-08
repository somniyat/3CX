import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.header("x-api-key");

  if (key && env.API_KEY && key === env.API_KEY) {
    next();
    return;
  }

  const clientSecret = req.header("x-3cx-client-secret");
  if (clientSecret && clientSecret === env.THREECX_CLIENT_SECRET) {
    next();
    return;
  }

  res.status(401).json({ error: "Clé API invalide ou manquante" });
}
