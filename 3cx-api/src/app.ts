import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { apiKeyAuth } from "./middlewares/auth";
import { errorHandler } from "./middlewares/error";
import healthRouter from "./routes/health";
import callsRouter, { createCallsRouter } from "./routes/calls";
import recordingsRouter, { createRecordingsRouter } from "./routes/recordings";
import systemRouter, { createSystemRouter } from "./routes/system";
import transcriptionsRouter, { createTranscriptionsRouter } from "./routes/transcriptions";
import usersRouter, { createUsersRouter } from "./routes/users";
import diagnosticRouter, { createDiagnosticRouter } from "./routes/diagnostic";
import driversRouter, { createDriversRouter } from "./routes/drivers";
import type { I3CXModule } from "./types/i3cx-module";

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
    if (!key || key !== expected) {
      res.status(401).json({ error: "Clé API invalide ou manquante" });
      return;
    }
    next();
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
app.use(cors());
app.use(express.json());
app.use(morgan("short"));

app.use("/health", healthRouter);

app.use("/api/calls", apiKeyAuth, callsRouter);
app.use("/api/recordings", apiKeyAuth, recordingsRouter);
app.use("/api/system", apiKeyAuth, systemRouter);
app.use("/api/transcriptions", apiKeyAuth, transcriptionsRouter);
app.use("/api/users", apiKeyAuth, usersRouter);
app.use("/api/diagnostic", apiKeyAuth, diagnosticRouter);
app.use("/api/drivers", apiKeyAuth, driversRouter);

app.use(errorHandler);

export default app;
