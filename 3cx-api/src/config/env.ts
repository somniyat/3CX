import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3002),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_KEY: z.string().optional(),
  THREECX_BASE_URL: z.string().url().optional(),
  THREECX_CLIENT_ID: z.string().optional(),
  THREECX_CLIENT_SECRET: z.string().optional(),

  // CORS : liste d'origines séparées par des virgules (ex: "http://localhost:5173,https://app.example.com")
  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),   // 1 minute
  RATE_LIMIT_MAX: z.coerce.number().default(100),             // 100 req/min

  // Logging
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuration invalide :", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
