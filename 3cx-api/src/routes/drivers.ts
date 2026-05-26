import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { threecx } from "../config/3cx";
import type { I3CXModule } from "../types/i3cx-module";

// ─── Schemas de validation ──────────────────────────────────────

const createDriverSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Le nom est requis"),
  phone: z.string().optional(),
  extension: z.string().min(1, "L'extension est requise"),
  threecxUserId: z.string().optional(),
  email: z.string().email().optional(),
  active: z.boolean().optional(),
});

const updateDriverSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  extension: z.string().min(1).optional(),
  threecxUserId: z.string().optional(),
  email: z.string().email().optional(),
  active: z.boolean().optional(),
});

const dossierQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const recentQuerySchema = z.object({
  minutes: z.coerce.number().int().positive().max(10080).default(60),
});

export function createDriversRouter(module: I3CXModule): Router {
  const router = Router();

  // ─── Liste des chauffeurs ────────────────────────────────────

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const drivers = await module.listDrivers();
      res.json({ data: drivers, total: drivers.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Creer un chauffeur ──────────────────────────────────────

  router.post("/", (req: Request, res: Response) => {
    const parsed = createDriverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Donnees invalides",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const driver = module.createDriver(parsed.data);
      res.status(201).json(driver);
    } catch (err: any) {
      res.status(409).json({ error: err.message });
    }
  });

  // ─── Recherche par numero de telephone ───────────────────────

  router.get("/by-phone/:phone", async (req: Request, res: Response) => {
    const phone = req.params.phone as string;
    const driver = await module.getDriverByPhone(phone);
    if (!driver) {
      res.status(404).json({ error: `Aucun chauffeur avec le numero ${phone}` });
      return;
    }
    res.json(driver);
  });

  // ─── Communications par telephone ────────────────────────────

  router.get("/by-phone/:phone/communications", async (req: Request, res: Response) => {
    const phone = req.params.phone as string;
    const parsed = dossierQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Parametres invalides", details: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const dossier = await module.getDriverCommunicationsByPhone(phone, parsed.data);
      res.json(dossier);
    } catch (err: any) {
      if (err.message.includes("introuvable") || err.message.includes("Aucun")) {
        res.status(404).json({ error: err.message });
      } else {
        throw err;
      }
    }
  });

  // ─── Detail d'un chauffeur ───────────────────────────────────

  router.get("/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const driver = await module.getDriver(id);
    if (!driver) {
      res.status(404).json({ error: `Chauffeur ${id} introuvable` });
      return;
    }
    res.json(driver);
  });

  // ─── Modifier un chauffeur ───────────────────────────────────

  router.put("/:id", (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsed = updateDriverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Donnees invalides",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const driver = module.updateDriver(id, parsed.data);
      if (!driver) {
        res.status(404).json({ error: `Chauffeur ${id} introuvable` });
        return;
      }
      res.json(driver);
    } catch (err: any) {
      res.status(409).json({ error: err.message });
    }
  });

  // ─── Supprimer un chauffeur ──────────────────────────────────

  router.delete("/:id", (req: Request, res: Response) => {
    const id = req.params.id as string;
    const deleted = module.deleteDriver(id);
    if (!deleted) {
      res.status(404).json({ error: `Chauffeur ${id} introuvable` });
      return;
    }
    res.json({ success: true });
  });

  // ─── Dossier complet d'un chauffeur ──────────────────────────

  router.get("/:id/dossier", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsed = dossierQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Parametres invalides", details: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const dossier = await module.getDriverDossier(id, parsed.data);
      res.json(dossier);
    } catch (err: any) {
      if (err.message.includes("introuvable")) {
        res.status(404).json({ error: err.message });
      } else {
        throw err;
      }
    }
  });

  // ─── Communications recentes (par duree en minutes) ──────────

  router.get("/:id/recent", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsed = recentQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Parametres invalides", details: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const dossier = await module.getDriverRecentCommunications(id, parsed.data.minutes);
      res.json(dossier);
    } catch (err: any) {
      if (err.message.includes("introuvable")) {
        res.status(404).json({ error: err.message });
      } else {
        throw err;
      }
    }
  });

  return router;
}

export default createDriversRouter(threecx as unknown as I3CXModule);
