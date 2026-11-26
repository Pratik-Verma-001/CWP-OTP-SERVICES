import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    // Fake secrets only; tests never read .env.local and never contact real services.
    env: {
      API_KEY_PEPPER: "a".repeat(64), OTP_HMAC_SECRET: "b".repeat(64), ENCRYPTION_KEY: "c".repeat(64),
    },
  },
});
