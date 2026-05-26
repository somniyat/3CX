import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.ts"],
    // Charge .env.test au lieu de .env pour ne jamais dependre de la config de prod
    env: {
      PORT: "3999",
      API_KEY: "test-api-key-1234",
      THREECX_BASE_URL: "http://mock-3cx.local",
      THREECX_EXTENSION: "100",
      THREECX_PASSWORD: "test-pass",
    },
  },
});
