import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3002),
  API_KEY: z.string().min(1, "API_KEY est requis"),
  THREECX_BASE_URL: z.string().url("THREECX_BASE_URL doit etre une URL valide"),
  THREECX_CLIENT_ID: z.string().min(1, "THREECX_CLIENT_ID est requis"),
  THREECX_CLIENT_SECRET: z.string().min(1, "THREECX_CLIENT_SECRET est requis"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuration invalide :", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
