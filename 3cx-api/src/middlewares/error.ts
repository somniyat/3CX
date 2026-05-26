import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error("[Erreur]", err.message);

  // Axios timeout ou erreur réseau (pas de .response)
  if ((err as any).code === "ECONNABORTED" || err.message?.includes("timeout")) {
    res.status(504).json({ error: "Le serveur 3CX n'a pas répondu à temps" });
    return;
  }

  const axiosStatus = (err as any).response?.status;
  const status = (err as any).status ?? axiosStatus ?? 500;

  if (status === 403) {
    res.status(403).json({ error: "Accès interdit — la clé API n'a pas les permissions requises" });
    return;
  }

  res.status(status).json({
    error: status === 500 ? "Erreur interne du serveur" : err.message,
  });
}
