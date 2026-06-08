import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
  redact: {
    paths: [
      "req.headers['x-3cx-client-secret']",
      "req.headers['x-api-key']",
    ],
    censor: "[REDACTED]",
  },
});
