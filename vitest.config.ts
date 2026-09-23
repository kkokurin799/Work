import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgres://work:work@127.0.0.1:5432/work",
      SESSION_SECRET: "test-session-secret",
      OWNER_EMAIL: "owner@example.com",
      OWNER_PASSWORD: "work-owner-pass",
      APP_BASE_URL: "http://localhost:3000",
      TZ: "Europe/Moscow",
      WORKER_DISABLED: "1",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
