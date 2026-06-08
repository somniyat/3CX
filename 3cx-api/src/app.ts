import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { resolve3cx } from "./middlewares/resolve3cx";
import { errorHandler } from "./middlewares/error";
import healthRouter from "./routes/health";
import { createCallsRouter } from "./routes/calls";
import { createRecordingsRouter } from "./routes/recordings";
import { createSystemRouter } from "./routes/system";
import { createTranscriptionsRouter } from "./routes/transcriptions";
import { createUsersRouter } from "./routes/users";
import { createDiagnosticRouter } from "./routes/diagnostic";
import { createDriversRouter } from "./routes/drivers";
import type { I3CXModule } from "./types/i3cx-module";

// ─── CORS : whitelist d'origines ────────────────────────────
const allowedOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Autoriser les requêtes sans origin (curl, health checks, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origine CORS non autorisée : ${origin}`));
    }
  },
  credentials: true,
};

// ─── Rate limiter ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes — réessayez plus tard" },
});

/**
 * Factory : construit une app Express en injectant le module 3CX.
 * Utilise par les tests pour injecter un Fake, sans toucher au wiring de prod.
 */
export function createApp(module: I3CXModule): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use("/health", healthRouter);

  const testApiKeyAuth: express.RequestHandler = (req, res, next) => {
    const key = req.header("x-api-key");
    const expected = process.env.API_KEY || "test-api-key-1234";
    if (key && key === expected) {
      next();
      return;
    }

    const clientSecret = req.header("x-3cx-client-secret");
    const expectedSecret = process.env.THREECX_CLIENT_SECRET || "";
    if (clientSecret && clientSecret === expectedSecret) {
      next();
      return;
    }

    res.status(401).json({ error: "Clé API invalide ou manquante" });
  };

  app.use("/api/calls", testApiKeyAuth, createCallsRouter(module));
  app.use("/api/recordings", testApiKeyAuth, createRecordingsRouter(module));
  app.use("/api/system", testApiKeyAuth, createSystemRouter(module));
  app.use("/api/transcriptions", testApiKeyAuth, createTranscriptionsRouter(module));
  app.use("/api/users", testApiKeyAuth, createUsersRouter(module));
  app.use("/api/diagnostic", testApiKeyAuth, createDiagnosticRouter(module));
  app.use("/api/drivers", testApiKeyAuth, createDriversRouter(module));

  app.use(errorHandler);

  return app;
}

// ─── App par defaut pour la prod ──────────────────────────────
const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(limiter);
app.use(pinoHttp({ logger }));

app.use("/health", healthRouter);

// resolve3cx sert a la fois d'auth et de resolution dynamique du module 3CX
app.use("/api/calls", resolve3cx, createCallsRouter());
app.use("/api/recordings", resolve3cx, createRecordingsRouter());
app.use("/api/system", resolve3cx, createSystemRouter());
app.use("/api/transcriptions", resolve3cx, createTranscriptionsRouter());
app.use("/api/users", resolve3cx, createUsersRouter());
app.use("/api/drivers", resolve3cx, createDriversRouter());

// Diagnostic : desactive en production, protege par resolve3cx sinon
if (env.NODE_ENV !== "production") {
  app.use("/api/diagnostic", resolve3cx, createDiagnosticRouter());
} else {
  app.use("/api/diagnostic", (_req, res) => {
    res.status(404).json({ error: "Endpoint indisponible en production" });
  });
}

app.use(errorHandler);

export default app;
