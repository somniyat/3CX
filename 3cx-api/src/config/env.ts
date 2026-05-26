import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3002),
  API_KEY: z.string().optional(),
  THREECX_BASE_URL: z.string().url().optional(),
  THREECX_CLIENT_ID: z.string().optional(),
  THREECX_CLIENT_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuration invalide :", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
